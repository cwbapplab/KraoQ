use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use serde::{Deserialize, Serialize};
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use tower_http::services::ServeDir;
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct QueueRequest {
    #[serde(rename = "videoId")]
    pub video_id: String,
    pub title: String,
    pub artists: Option<String>,
    pub thumbnail: Option<String>,
    pub singer: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
}

#[derive(Deserialize, Clone, Serialize)]
pub struct RemoveRequest {
    #[serde(rename = "videoId")]
    pub video_id: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
}

#[derive(Deserialize)]
pub struct InvokeRequest {
    pub cmd: String,
    pub args: serde_json::Value,
}

// Global active websocket channel to allow the app to broadcast down the WS
struct WsTx(std::sync::Mutex<Option<tokio::sync::mpsc::Sender<Message>>>);

#[tauri::command]
pub async fn start_party_mode(app: tauri::AppHandle, relay_url: String, jwt_token: String, party_name: String, party_id: String, token: String) -> Result<String, String> {
    // Step 1: Create or reclaim party via REST endpoint
    let http_client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let create_url = format!("{}/api/host/create", relay_url);
    let mut body = serde_json::json!({ "partyName": party_name });
    if !party_id.is_empty() && !token.is_empty() {
        body["partyId"] = serde_json::json!(party_id);
        body["token"] = serde_json::json!(token);
    }

    let response = http_client.post(&create_url)
        .header("Authorization", format!("Bearer {}", jwt_token))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to create party on relay: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("Relay rejected party creation: HTTP {} - {}", status, err_body));
    }

    let party_data: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse relay response: {}", e))?;

    let actual_party_id = party_data["partyId"].as_str()
        .ok_or("Missing partyId in relay response")?.to_string();
    let actual_token = party_data["token"].as_str()
        .ok_or("Missing token in relay response")?.to_string();
    let actual_name = party_data["partyName"].as_str()
        .unwrap_or(&party_name).to_string();

    println!("Rust: Party ready - name=\"{}\" id={}", actual_name, actual_party_id);

    // Step 2: Connect WebSocket with server-issued credentials + Host JWT
    let ws_url = format!("{}/api/ws?party_id={}&token={}&jwt={}&role=host", 
        relay_url.replace("http", "ws"), 
        actual_party_id, 
        actual_token,
        jwt_token
    );
    let (ws_stream, _) = connect_async(ws_url.clone()).await.map_err(|e| e.to_string())?;
    let (mut write, mut read) = futures_util::StreamExt::split(ws_stream);

    // Clear any existing connection state first
    if let Some(tx_arc) = app.try_state::<Arc<WsTx>>() {
        let mut tx_opt = tx_arc.0.lock().unwrap();
        *tx_opt = None; 
    }

    let (tx, mut rx) = tokio::sync::mpsc::channel::<Message>(100);
    
    if let Some(tx_arc) = app.try_state::<Arc<WsTx>>() {
        let mut tx_opt = tx_arc.0.lock().unwrap();
        *tx_opt = Some(tx.clone());
    } else {
        app.manage(Arc::new(WsTx(std::sync::Mutex::new(Some(tx.clone())))));
    }

    let app_clone = app.clone();
    let tx_pong = tx.clone();

    // Send task
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Build result to return to frontend before spawning the long-lived receive task
    let result = serde_json::json!({
        "partyId": actual_party_id,
        "partyName": actual_name,
        "token": actual_token
    });

    // Receive task
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            if let Ok(msg) = msg {
                match msg {
                    Message::Ping(payload) => {
                        let _ = tx_pong.send(Message::Pong(payload)).await;
                    },
                    Message::Text(text) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(text.as_str()) {
                    let msg_type = json["type"].as_str().unwrap_or("");
                    match msg_type {
                        "search" => {
                            let id = json["id"].as_str().unwrap_or("").to_string();
                            let query = json["query"].as_str().unwrap_or("").to_string();
                            let app_search_clone = app_clone.clone();
                            tokio::spawn(async move {
                                println!("Relay: Handling search for '{}'", query);
                                match crate::search(query, app_search_clone.clone()).await {
                                    Ok(res) => {
                                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&res) {
                                             send_ws_reply(&app_search_clone, id, val).await;
                                        }
                                    },
                                    Err(e) => {
                                        println!("Relay: Search error: {}", e);
                                        send_ws_reply(&app_search_clone, id, serde_json::json!({"error": e})).await;
                                    }
                                }
                            });
                        },
                        "suggestions" => {
                            let id = json["id"].as_str().unwrap_or("").to_string();
                            let query = json["query"].as_str().unwrap_or("").to_string();
                            let app_sug_clone = app_clone.clone();
                            tokio::spawn(async move {
                                println!("Relay: Handling suggestions for '{}'", query);
                                match crate::suggestions(query, app_sug_clone.clone()).await {
                                    Ok(res) => {
                                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&res) {
                                             send_ws_reply(&app_sug_clone, id, val).await;
                                        }
                                    },
                                    Err(e) => {
                                        println!("Relay: Suggestions error: {}", e);
                                        send_ws_reply(&app_sug_clone, id, serde_json::json!({"error": e})).await;
                                    }
                                }
                            });
                        },
                        "process_yt" => {
                            let id = json["id"].as_str().unwrap_or("").to_string();
                            let query = json["query"].as_str().unwrap_or("").to_string();
                            let app_proc_clone = app_clone.clone();
                            tokio::spawn(async move {
                                println!("Relay: Handling process_yt for '{}'", query);
                                match crate::process_yt(query, app_proc_clone.clone()).await {
                                    Ok(res) => {
                                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&res) {
                                             send_ws_reply(&app_proc_clone, id, val).await;
                                        }
                                    },
                                    Err(e) => {
                                        println!("Relay: Process error: {}", e);
                                        send_ws_reply(&app_proc_clone, id, serde_json::json!({"error": e})).await;
                                    }
                                }
                            });
                        },
                        "client_joined" => {
                             let state = app_clone.state::<crate::AppState>();
                             let q = state.party_queue.lock().unwrap().clone();
                             let msg = serde_json::json!({
                                 "type": "sync_queue",
                                 "queue": q
                             });
                             broadcast_ws(app_clone.clone(), msg, None).await;
                             
                             // Notify frontend so it can push a fresh sync_state
                             let _ = app_clone.emit("party_client_joined", {});
                        },
                        "queue_add" => {
                             if let Ok(req) = serde_json::from_value::<QueueRequest>(json["payload"].clone()) {
                                 let state = app_clone.state::<crate::AppState>();
                                 let updated_q = {
                                     let mut q = state.party_queue.lock().unwrap();
                                     if !q.iter().any(|item| item.video_id == req.video_id && item.device_id == req.device_id) {
                                         q.push(req.clone());
                                     }
                                     q.clone()
                                 };
                                 
                                 // Broadcast updated queue to everyone immediately
                                 let msg = serde_json::json!({
                                     "type": "sync_queue",
                                     "queue": updated_q
                                 });
                                 broadcast_ws(app_clone.clone(), msg, None).await;
                                 
                                 let _ = app_clone.emit("party_add_to_queue", req);
                             }
                        },
                        "queue_remove" => {
                             if let Ok(req) = serde_json::from_value::<RemoveRequest>(json["payload"].clone()) {
                                 let state = app_clone.state::<crate::AppState>();
                                 let updated_q = {
                                     let mut q = state.party_queue.lock().unwrap();
                                     q.retain(|item| !(item.video_id == req.video_id && item.device_id == req.device_id));
                                     q.clone()
                                 };
                                 
                                 // Broadcast updated queue to everyone immediately
                                 let msg = serde_json::json!({
                                     "type": "sync_queue",
                                     "queue": updated_q
                                 });
                                 broadcast_ws(app_clone.clone(), msg, None).await;
                                 
                                 let _ = app_clone.emit("party_remove_from_queue", req);
                             }
                        },
                        "recommendations" => {
                            let id = json["id"].as_str().unwrap_or("").to_string();
                            let app_rec_clone = app_clone.clone();
                            tokio::spawn(async move {
                                println!("Relay: Handling recommendations");
                                match crate::get_recommendations(app_rec_clone.clone()).await {
                                    Ok(res) => {
                                         send_ws_reply(&app_rec_clone, id, serde_json::json!(res)).await;
                                    },
                                    Err(e) => {
                                        println!("Relay: Recommendations error: {}", e);
                                        send_ws_reply(&app_rec_clone, id, serde_json::json!({"error": e})).await;
                                    }
                                }
                            });
                        }
                        _ => {}
                    }
                }
            },
            _ => {}
        }
    } else {
        break;
    }
}
        
println!("Rust: Party Relay connection lost.");
        if let Some(tx_arc) = app_clone.try_state::<Arc<WsTx>>() {
            let mut tx_opt = tx_arc.0.lock().unwrap();
            *tx_opt = None;
        }
        let _ = app_clone.emit("party_mode_disconnected", ());
    });

    Ok(result.to_string())
}

async fn send_ws_reply(app: &AppHandle, reply_to: String, payload: serde_json::Value) {
    let msg = serde_json::json!({
        "replyTo": reply_to,
        "payload": payload
    });
    broadcast_ws(app.clone(), msg, None).await;
}

#[tauri::command]
pub async fn broadcast_ws(app: AppHandle, payload: serde_json::Value, local_only: Option<bool>) {
    let msg_string = payload.to_string();
    let skip_relay = local_only.unwrap_or(false);

    // 1. Relay Broadcast (Tauri -> Relay -> Mobile)
    if !skip_relay {
        if let Some(tx_arc) = app.try_state::<Arc<WsTx>>() {
            let tx_opt = tx_arc.0.lock().unwrap().clone();
            if let Some(tx) = tx_opt {
                let _ = tx.try_send(Message::Text(msg_string.clone().into()));
            }
        }
    }

    // 2. Local Broadcast (Tauri -> Local Server -> Browser/TV)
    let state = app.state::<crate::AppState>();
    let mut clients = state.local_ws_clients.lock().await;
    let mut to_remove = Vec::new();

    for (i, tx) in clients.iter().enumerate() {
        if let Err(_) = tx.try_send(Message::Text(msg_string.clone().into())) {
            to_remove.push(i);
        }
    }

    if !to_remove.is_empty() {
        for i in to_remove.into_iter().rev() {
            clients.remove(i);
        }
    }
}

#[tauri::command]
pub fn remove_from_party_queue(app: AppHandle, video_id: String, device_id: String) {
    let state = app.state::<crate::AppState>();
    let mut q = state.party_queue.lock().unwrap();
    q.retain(|item| !(item.video_id == video_id && item.device_id == device_id));
    drop(q);
    let _ = app.emit("party_remove_from_queue", RemoveRequest { video_id, device_id });
}

#[tauri::command]
pub async fn stop_party_mode(app: AppHandle) -> Result<(), String> {
    if let Some(tx_arc) = app.try_state::<Arc<WsTx>>() {
        let mut tx_opt = tx_arc.0.lock().unwrap();
        *tx_opt = None; // This drops the sender, which closes the mpsc channel, breaking the write loop and closing WS.
    }
    Ok(())
}

// Serves the presentation UI. The frontend is embedded into the executable at
// build time, so it must be read through the asset resolver rather than from a
// `dist` folder on disk (which does not exist in a packaged build). In dev the
// resolver transparently falls back to reading the frontend dist directory.
async fn serve_asset(
    axum::extract::State(app): axum::extract::State<AppHandle>,
    uri: axum::http::Uri,
) -> axum::response::Response {
    let resolver = app.asset_resolver();

    let mut path = uri.path().trim_start_matches('/').to_string();
    if path.is_empty() {
        path = "index.html".to_string();
    }

    let asset = resolver
        .get(path)
        .or_else(|| resolver.get("index.html".to_string()));

    match asset {
        Some(asset) => {
            let mut builder = axum::response::Response::builder()
                .status(axum::http::StatusCode::OK)
                .header(axum::http::header::CONTENT_TYPE, asset.mime_type.clone());
            if let Some(csp) = &asset.csp_header {
                builder = builder.header("Content-Security-Policy", csp);
            }
            builder.body(axum::body::Body::from(asset.bytes)).unwrap()
        }
        None => axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_FOUND)
            .body(axum::body::Body::from("Presentation UI not found"))
            .unwrap(),
    }
}

#[tauri::command]
pub async fn start_http_server(app: tauri::AppHandle) -> Result<String, String> {
    let state = app.state::<crate::AppState>();
    
    // Check if already running
    {
        let tx = state.local_server_tx.lock().unwrap();
        if tx.is_some() {
            return Ok("Server already running".to_string());
        }
    }

    let uploads_dir = state.uploads_dir.clone();
    let separate_dir = state.app_data_dir.join("separate");
    
    println!("Local Presentation Mode: serving UI from embedded frontend assets");

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut state_tx = state.local_server_tx.lock().unwrap();
        *state_tx = Some(tx);
    }

    let addr = SocketAddr::from(([0, 0, 0, 0], 1425));
    
    let config = crate::get_config_internal(&app);
    let mut library_dir = config.raw_library_folder.clone();
    if library_dir.trim().is_empty() {
        library_dir = uploads_dir.clone().to_string_lossy().to_string();
    }

    tokio::spawn(async move {
        let router = axum::Router::new()
            .nest_service("/uploads", ServeDir::new(uploads_dir))
            .nest_service("/separate", ServeDir::new(separate_dir))
            .nest_service("/library", ServeDir::new(library_dir))
            .route("/invoke", axum::routing::post(handle_http_invoke))
            .route("/api/ws", axum::routing::get(handle_local_ws))
            .fallback(serve_asset)
            .layer(CorsLayer::permissive())
            .with_state(app.clone());

        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                println!("Failed to bind HTTP server: {}", e);
                return;
            }
        };

        println!("Local UI Server listening on http://{}", addr);
        if let Err(e) = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = rx.await;
                println!("HTTP Server shutting down");
            })
            .await {
                println!("HTTP Server error: {}", e);
            }
    });

    Ok(format!("http://{}:1425", get_local_ip_addr().unwrap_or("localhost".to_string())))
}

#[tauri::command]
pub fn stop_http_server(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let mut tx_opt = state.local_server_tx.lock().unwrap();
    if let Some(tx) = tx_opt.take() {
        let _ = tx.send(());
    }
    Ok(())
}

async fn handle_http_invoke(
    axum::extract::State(app): axum::extract::State<AppHandle>,
    axum::Json(req): axum::Json<InvokeRequest>,
) -> impl axum::response::IntoResponse {
    let cmd = req.cmd.as_str();
    let args = req.args;

    match cmd {
        "search" => {
            let q = args["query"].as_str().unwrap_or_default().to_string();
            match crate::search_internal(q, app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(res)).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "suggestions" => {
            let q = args["query"].as_str().unwrap_or_default().to_string();
            match crate::suggestions_internal(q, app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(res)).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "process_yt" => {
            let vid = args["videoId"].as_str().unwrap_or_default().to_string();
            match crate::process_yt_internal(vid, app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(res)).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "get_app_config" => {
            let config = crate::get_app_config_internal(app);
            axum::response::Response::builder()
                .header("Content-Type", "application/json")
                .body(axum::body::Body::from(serde_json::to_string(&config).unwrap())).unwrap()
        },
        "get_recommendations" => {
            match crate::get_recommendations_internal(app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(serde_json::to_string(&res).unwrap())).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "search_lrclib" => {
            let q = args["query"].as_str().unwrap_or_default().to_string();
            match crate::search_lrclib_internal(q).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(serde_json::to_string(&res).unwrap())).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "get_lyrics_status" => {
            let vid = args["videoId"].as_str().unwrap_or_default().to_string();
            match crate::get_lyrics_status_internal(vid, app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(serde_json::to_string(&res).unwrap())).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "check_gpu_status" => {
            match crate::check_gpu_status_internal(app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(serde_json::to_string(&res).unwrap())).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "apply_alternative_lyrics" => {
            let vid = args["videoId"].as_str().unwrap_or_default().to_string();
            let lyrics = args["lyricsText"].as_str().unwrap_or_default().to_string();
            let lrclib_id = args["lrclibId"].as_i64();
            match crate::apply_alternative_lyrics_internal(vid, lyrics, lrclib_id, app).await {
                Ok(res) => axum::response::Response::builder()
                    .header("Content-Type", "application/json")
                    .body(axum::body::Body::from(res)).unwrap(),
                Err(e) => axum::response::Response::builder()
                    .status(500)
                    .body(axum::body::Body::from(e)).unwrap(),
            }
        },
        "set_config" => {
            let config_val = args["config"].clone();
            if let Ok(config) = serde_json::from_value::<crate::AppConfig>(config_val) {
                match crate::set_config_internal(config, app) {
                    Ok(_) => axum::response::Response::builder()
                        .header("Content-Type", "application/json")
                        .body(axum::body::Body::from("null")).unwrap(),
                    Err(e) => axum::response::Response::builder()
                        .status(500)
                        .body(axum::body::Body::from(e)).unwrap(),
                }
            } else {
                axum::response::Response::builder()
                    .status(400)
                    .body(axum::body::Body::from("Invalid config payload")).unwrap()
            }
        },
        _ => axum::response::Response::builder()
            .status(404)
            .body(axum::body::Body::from("Command not found via HTTP proxy")).unwrap(),
    }
}

#[tauri::command]
pub fn get_local_ip_addr() -> Result<String, String> {
    use local_ip_address::local_ip;
    local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| e.to_string())
}

async fn handle_local_ws(
    ws: axum::extract::ws::WebSocketUpgrade,
    axum::extract::State(app): axum::extract::State<AppHandle>,
) -> impl axum::response::IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, app))
}

async fn handle_socket(socket: axum::extract::ws::WebSocket, app: AppHandle) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Message>(100);
    
    {
        let state = app.state::<crate::AppState>();
        let mut clients = state.local_ws_clients.lock().await;
        clients.push(tx);
        println!("Local Presentation: Client connected. Total clients: {}", clients.len());
    }

    // Notify host that a presentation client connected
    let _ = app.emit("party_client_joined", {});

    let app_read = app.clone();

    // Task: forward outbound messages to the browser client
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let axum_msg = match msg {
                Message::Text(t) => axum::extract::ws::Message::Text(t.as_str().into()),
                Message::Binary(b) => axum::extract::ws::Message::Binary(b.into()),
                Message::Ping(p) => axum::extract::ws::Message::Ping(p.into()),
                Message::Pong(p) => axum::extract::ws::Message::Pong(p.into()),
                _ => continue,
            };
            
            if ws_sender.send(axum_msg).await.is_err() {
                break;
            }
        }
    });

    // Task: read messages FROM the browser client and emit as Tauri events
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let axum::extract::ws::Message::Text(text) = msg {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    let msg_type = json["type"].as_str().unwrap_or("");
                    match msg_type {
                        "presentation_play" => {
                            println!("Local Presentation: Received play signal from presentation screen");
                            let _ = app_read.emit("presentation_play", {});
                        },
                        "presentation_pause" => {
                            println!("Local Presentation: Received pause signal from presentation screen");
                            let _ = app_read.emit("presentation_pause", {});
                        },
                        "sync_state" => {
                            println!("Local Presentation: Received sync_state from presentation screen");
                            let _ = app_read.emit("presentation_sync_state", json.clone());
                            if let Some(tx_arc) = app_read.try_state::<Arc<WsTx>>() {
                                let tx_opt = tx_arc.0.lock().unwrap().clone();
                                if let Some(tx) = tx_opt {
                                    let msg_string = json.to_string();
                            let _ = tx.try_send(Message::Text(msg_string.into()));
                                }
                            }
                        },
                        _ => {
                            println!("Local Presentation: Unknown message type: {}", msg_type);
                        }
                    }
                }
            }
        }
    });

    // Wait for either task to finish (connection closed)
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    println!("Local Presentation: Client disconnected.");
}

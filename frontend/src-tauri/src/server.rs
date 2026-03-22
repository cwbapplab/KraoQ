use axum::{
    routing::{get, post},
    Router,
    extract::{Query, State, ws::{WebSocketUpgrade, WebSocket, Message}},
    response::{Html, IntoResponse},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter, Listener};
use serde::Deserialize;
use local_ip_address::local_ip;

#[derive(Clone)]
pub struct ServerState {
    pub app: AppHandle,
    pub connected_clients: Arc<std::sync::Mutex<usize>>,
    pub force_disconnect_tx: tokio::sync::broadcast::Sender<()>,
    pub current_playback: Arc<std::sync::Mutex<Option<serde_json::Value>>>,
    pub force_takeover_active: Arc<std::sync::atomic::AtomicBool>,
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub query: String,
}

#[derive(Deserialize, serde::Serialize, Clone, Debug)]
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

#[derive(Deserialize, Clone, serde::Serialize)]
pub struct RemoveRequest {
    #[serde(rename = "videoId")]
    pub video_id: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
}




async fn handle_root() -> Html<&'static str> {
    Html(include_str!("party.html"))
}

async fn handle_search(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let app = state.app.clone();
    let query = params.query;
    match crate::search(query, app).await {
        Ok(res) => {
            if let Ok(v) = serde_json::from_str(&res) {
                 Ok(Json(v))
            } else {
                 Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn handle_suggestions(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let app = state.app.clone();
    let query = params.query;
    match crate::suggestions(query, app).await {
        Ok(res) => {
            if let Ok(v) = serde_json::from_str(&res) {
                 Ok(Json(v))
            } else {
                 Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn handle_process_yt(
    State(state): State<Arc<ServerState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let app = state.app.clone();
    let video_id = params.query;
    match crate::process_yt(video_id, app).await {
        Ok(res) => {
            if let Ok(v) = serde_json::from_str(&res) {
                 Ok(Json(v))
            } else {
                 Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

#[derive(Deserialize)]
pub struct WsParams {
    pub force: Option<String>,
}

async fn handle_ws(
    ws: WebSocketUpgrade,
    Query(params): Query<WsParams>,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    let force = params.force.as_deref() == Some("true");
    ws.on_upgrade(move |socket| handle_socket(socket, state, force))
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>, force: bool) {
    let app = state.app.clone();
    
    if force {
         state.force_takeover_active.store(true, std::sync::atomic::Ordering::SeqCst);
         let _ = state.force_disconnect_tx.send(());
         let _ = app.emit("force_takeover_happened", ());
         *state.current_playback.lock().unwrap() = None;
         for _ in 0..10 {
              if *state.connected_clients.lock().unwrap() == 0 {
                   break;
              }
              tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
         }
         state.force_takeover_active.store(false, std::sync::atomic::Ordering::SeqCst);
    }
    
    let is_locked = {
        let mut count = state.connected_clients.lock().unwrap();
        if *count >= 1 {
            true
        } else {
            *count += 1;
            let _ = app.emit("web_viewer_status", true);
            false
        }
    };

    if is_locked {
        let mut socket = socket;
        let _ = socket.send(Message::Text(r#"{"type":"error","message":"locked"}"#.to_string())).await;
        return;
    }

    let (tx_ws, mut rx_ws) = tokio::sync::mpsc::channel::<String>(100);
    
    {
        let cached = state.current_playback.lock().unwrap().clone();
        if let Some(payload) = cached {
             let _ = tx_ws.try_send(format!(r#"{{"type":"sync_state","payload":{}}}"#, payload.to_string()));
        }
    }
    
    let tx_add = tx_ws.clone();
    let id_add = app.listen_any("party_add_to_queue", move |event| {
         let _ = tx_add.try_send(format!(r#"{{"type":"add","payload":{}}}"#, event.payload().to_string()));
    });

    let tx_remove = tx_ws.clone();
    let id_remove = app.listen_any("party_remove_from_queue", move |event| {
         let _ = tx_remove.try_send(format!(r#"{{"type":"remove","payload":{}}}"#, event.payload().to_string()));
    });

    let mut force_rx_inner = state.force_disconnect_tx.subscribe();
    let send_task = tokio::spawn(async move {
         let mut socket = socket;
         let mut disconnected = false;
         loop {
              tokio::select! {
                  msg = rx_ws.recv() => {
                       if let Some(msg) = msg {
                            if socket.send(Message::Text(msg)).await.is_err() { break; }
                       } else { break; }
                  }
                  _ = force_rx_inner.recv() => {
                       let _ = socket.send(Message::Text(r#"{"type":"error","message":"disconnected_by_force","warning":"queue_desync_risk"}"#.to_string())).await;
                       tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                       disconnected = true;
                       break;
                  }
              }
         }
         (socket, disconnected)
    });

    let (mut socket_recv, disconnected) = send_task.await.unwrap();
    if !disconnected {
        let mut force_rx_outer = state.force_disconnect_tx.subscribe();
        tokio::select! {
             _ = async { 
                  while let Some(Ok(msg)) = socket_recv.recv().await {
                       if let Message::Text(text) = msg {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                                 if v["type"] == "sync_state" {
                                      *state.current_playback.lock().unwrap() = Some(v["payload"].clone());
                                 }
                            }
                       }
                  }
             } => {}
             _ = force_rx_outer.recv() => {
                  let _ = socket_recv.send(Message::Text(r#"{"type":"error","message":"disconnected_by_force","warning":"queue_desync_risk"}"#.to_string())).await;
             }
        }
    }

    let app_for_cleanup = app.clone();
    app_for_cleanup.unlisten(id_add);
    app_for_cleanup.unlisten(id_remove);

    let mut count = state.connected_clients.lock().unwrap();
    if *count > 0 { *count -= 1; }
    if *count == 0 {
         let _ = app_for_cleanup.emit("web_viewer_status", false);
         if !state.force_takeover_active.load(std::sync::atomic::Ordering::SeqCst) {
              *state.current_playback.lock().unwrap() = None;
         }
    }
}

async fn handle_get_queue(
    State(state): State<Arc<ServerState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let app = state.app.clone();
    let app_state = app.state::<crate::AppState>();
    let q = app_state.party_queue.lock().unwrap();
    
    let current_playback = state.current_playback.lock().unwrap().clone();

    let res_json = serde_json::json!({
        "queue": q.clone(),
        "currentPlayback": current_playback
    });

    Ok(Json(res_json))
}


async fn handle_queue(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<QueueRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let app = state.app.clone();
    let app_state = app.state::<crate::AppState>();
    
    let singer_clean = payload.singer.trim().to_lowercase();
    if singer_clean.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Singer name cannot be empty" }))));
    }

    let mut q = app_state.party_queue.lock().unwrap();
    if q.iter().any(|item| item.singer.trim().to_lowercase() == singer_clean) {
        return Err((StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "You already have a song in the queue!" }))));
    }

    q.push(payload.clone());
    drop(q);

    // Emit to tauri
    let _ = app.emit("party_add_to_queue", payload);
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn handle_client_remove_queue(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<RemoveRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let app = state.app.clone();
    let app_state = app.state::<crate::AppState>();
    let mut q = app_state.party_queue.lock().unwrap();
    let payload_clone = payload.clone();
    q.retain(|item| !(item.video_id == payload.video_id && item.device_id == payload.device_id));
    drop(q);
    
    let _ = app.emit("party_remove_from_queue", payload_clone);
    Ok(Json(serde_json::json!({ "success": true })))
}


#[tauri::command]
pub fn remove_from_party_queue(app: AppHandle, video_id: String, device_id: String) {
    println!("[Rust] remove_from_party_queue called with video_id: {}, device_id: {}", video_id, device_id);
    let state = app.state::<crate::AppState>();
    let mut q = state.party_queue.lock().unwrap();
    let old_len = q.len();
    q.retain(|item| !(item.video_id == video_id && item.device_id == device_id));
    println!("[Rust] Queue items retained. size: {} -> {}", old_len, q.len());
    drop(q);

    // Emit to WebSocket smartphones so they can remove it instantly over socket list update streams!
    let _ = app.emit("party_remove_from_queue", RemoveRequest { video_id: video_id.clone(), device_id: device_id.clone() });
}



#[tauri::command]
pub fn force_takeover(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Arc<ServerState>>();
    let _ = state.force_disconnect_tx.send(());
    *state.current_playback.lock().unwrap() = None;
    Ok(())
}

pub async fn start_server(app: AppHandle) -> Result<u16, String> {
    let uploads_dir = app.state::<crate::AppState>().uploads_dir.clone();
    let (force_tx, _) = tokio::sync::broadcast::channel(1);
    let shared_state = Arc::new(ServerState { 
        app: app.clone(),
        connected_clients: Arc::new(std::sync::Mutex::new(0)),
        force_disconnect_tx: force_tx,
        current_playback: Arc::new(std::sync::Mutex::new(None)),
        force_takeover_active: Arc::new(std::sync::atomic::AtomicBool::new(false)),
    });

    let app_router = Router::new()
        .route("/", get(handle_root))
        .route("/api/ws", get(handle_ws))
        .route("/api/search", get(handle_search))
        .route("/api/suggestions", get(handle_suggestions))
        .route("/api/process_yt", get(handle_process_yt))
        .route("/api/queue", get(handle_get_queue).post(handle_queue))
        .route("/api/remove_queue", post(handle_client_remove_queue))
        .with_state(shared_state.clone())
        .nest_service("/uploads", tower_http::services::ServeDir::new(uploads_dir))
        .layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any)
        );

    app.manage(shared_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:1425").await.map_err(|e| e.to_string())?;
    let port = listener.local_addr().unwrap().port();

    tokio::spawn(async move {
        let _ = axum::serve(listener, app_router).await;
    });

    Ok(port)
}

#[tauri::command]
pub fn get_party_url(app: AppHandle) -> Result<String, String> {
    let state = app.state::<crate::AppState>();
    let port_opt = state.party_port.lock().unwrap();
    if let Some(port) = *port_opt {
        if let Ok(ip) = local_ip().map(|ip_addr| ip_addr.to_string()) {
            return Ok(format!("http://{}:{}", ip, port));
        }
    }
    Err("Party server NOT running".to_string())
}

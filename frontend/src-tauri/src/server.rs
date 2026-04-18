use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use serde::{Deserialize, Serialize};
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

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

// Global active websocket channel to allow the app to broadcast down the WS
struct WsTx(std::sync::Mutex<Option<tokio::sync::mpsc::Sender<String>>>);

#[tauri::command]
pub async fn start_party_mode(app: tauri::AppHandle, relay_url: String, party_name: String, token: String) -> Result<(), String> {
    
    let ws_url = format!("{}/api/ws?party_id={}&token={}&role=host", relay_url.replace("http", "ws"), party_name, token);

    let (ws_stream, _) = connect_async(ws_url.clone()).await.map_err(|e| e.to_string())?;
    
    let (mut write, mut read) = futures_util::StreamExt::split(ws_stream);
    
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(100);
    app.manage(Arc::new(WsTx(std::sync::Mutex::new(Some(tx)))));

    let app_clone = app.clone();

    // Send task
    tokio::spawn(async move {
        while let Some(msg_string) = rx.recv().await {
            let msg = Message::Text(msg_string.into());
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Receive task
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            if let Ok(Message::Text(text)) = msg {
                
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
                             broadcast_ws(app_clone.clone(), msg).await;
                             
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
                                 broadcast_ws(app_clone.clone(), msg).await;
                                 
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
                                 broadcast_ws(app_clone.clone(), msg).await;
                                 
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
            }
        }
    });

    Ok(())
}

async fn send_ws_reply(app: &AppHandle, reply_to: String, payload: serde_json::Value) {
    let msg = serde_json::json!({
        "replyTo": reply_to,
        "payload": payload
    });
    broadcast_ws(app.clone(), msg).await;
}

#[tauri::command]
pub async fn broadcast_ws(app: AppHandle, payload: serde_json::Value) {
    if let Some(tx_arc) = app.try_state::<Arc<WsTx>>() {
        let tx_opt = tx_arc.0.lock().unwrap().clone();
        if let Some(tx) = tx_opt {
            let msg_string = payload.to_string();
            println!("Rust: Broadcasting to relay: {} chars", msg_string.len());
            let _ = tx.send(msg_string).await;
        } else {
            println!("Rust: broadcast_ws failed - Sender is None");
        }
    } else {
        println!("Rust: broadcast_ws failed - WsTx state not found");
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

#[tauri::command]
pub fn get_local_ip_addr() -> Result<String, String> {
    use local_ip_address::local_ip;
    local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| e.to_string())
}

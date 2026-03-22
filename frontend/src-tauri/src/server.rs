use axum::{
    routing::{get, post},
    Router,
    extract::{Query, State},
    response::Html,
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use serde::Deserialize;
use local_ip_address::local_ip;

#[derive(Clone)]
pub struct ServerState {
    pub app: AppHandle,
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

#[derive(Deserialize)]
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

async fn handle_get_queue(
    State(state): State<Arc<ServerState>>,
) -> Result<Json<Vec<QueueRequest>>, StatusCode> {
    let app = state.app.clone();
    let app_state = app.state::<crate::AppState>();
    let q = app_state.party_queue.lock().unwrap();
    Ok(Json(q.clone()))
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
    let app_state = state.app.state::<crate::AppState>();
    let mut q = app_state.party_queue.lock().unwrap();
    q.retain(|item| !(item.video_id == payload.video_id && item.device_id == payload.device_id));
    Ok(Json(serde_json::json!({ "success": true })))
}


#[tauri::command]
pub fn remove_from_party_queue(app: AppHandle, video_id: String) {
    let state = app.state::<crate::AppState>();
    let mut q = state.party_queue.lock().unwrap();
    q.retain(|item| item.video_id != video_id);
}



pub async fn start_server(app: AppHandle) -> Result<u16, String> {
    let shared_state = Arc::new(ServerState { app });
    let app_router = Router::new()
        .route("/", get(handle_root))
        .route("/api/search", get(handle_search))
        .route("/api/suggestions", get(handle_suggestions))
        .route("/api/queue", get(handle_get_queue))
        .route("/api/queue", post(handle_queue))
        .route("/api/remove_queue", post(handle_client_remove_queue))
        .with_state(shared_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:0").await.map_err(|e| e.to_string())?;
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

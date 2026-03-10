mod db;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_fs::FsExt;
use serde::{Serialize, Deserialize};

struct AppState {
    db_conn: Mutex<rusqlite::Connection>,
    python_dir: PathBuf,
    uploads_dir: PathBuf,
}

#[derive(Serialize)]
struct CommandResult<T> {
    data: Option<T>,
    error: Option<String>,
}

fn get_python_script_path(app: &AppHandle, script_name: &str) -> PathBuf {
    let state: State<AppState> = app.state();
    state.python_dir.join(script_name)
}

#[tauri::command]
async fn search(query: String, app: AppHandle) -> Result<String, String> {
    let script = get_python_script_path(&app, "search.py");
    let output = tokio::process::Command::new("python")
        .arg(&script)
        .arg(&query)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn suggestions(query: String, app: AppHandle) -> Result<String, String> {
    let script = get_python_script_path(&app, "suggestions.py");
    let output = tokio::process::Command::new("python")
        .arg(&script)
        .arg(&query)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[derive(Deserialize)]
struct ProcessResult {
    instrumental_url: String,
    title: String,
    artist: String,
    lrc: String,
    segments: Vec<Segment>
}

#[derive(Serialize, Deserialize, Clone)]
struct Segment {
    time: f64,
    text: String,
}

fn parse_lrc(content: &str) -> Vec<Segment> {
    let mut segments = Vec::new();
    for line in content.lines() {
        if let Some(start) = line.find('[') {
            if let Some(end) = line.find(']') {
                let time_str = &line[start + 1..end];
                let text = line[end + 1..].trim().to_string();
                let parts: Vec<&str> = time_str.split(':').collect();
                if parts.len() == 2 {
                    if let (Ok(minutes), Ok(seconds)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                        segments.push(Segment {
                            time: minutes * 60.0 + seconds,
                            text,
                        });
                    }
                }
            }
        }
    }
    segments
}

#[tauri::command]
async fn process_yt(video_id: String, app: AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();
    
    // Check Cache
    {
        let conn = state.db_conn.lock().unwrap();
        if let Ok(Some(cached)) = db::get_song(&conn, &video_id) {
            if !cached.missing_lyrics && std::path::Path::new(&cached.instrumental_path).exists() {
                        if let Ok(lrc_content) = std::fs::read_to_string(&cached.lrc_path) {
                    let segments = parse_lrc(&lrc_content);
                    let res = serde_json::json!({
                        "message": "Processing complete (Cached)",
                        "data": {
                            "segments": segments,
                            "lrc": lrc_content,
                            "instrumentalUrl": cached.instrumental_path,
                            "title": cached.title,
                            "artist": cached.artist
                        }
                    });
                    return Ok(res.to_string());
                }
            }
        }
    }

    let download_script = state.python_dir.join("download_pipeline.py");
    let separate_script = state.python_dir.join("separate.py");
    let uploads_dir = state.uploads_dir.to_string_lossy().to_string();
    
    // 1. Download Pipeline
    let dl_output = tokio::process::Command::new("python")
        .arg(&download_script)
        .arg(&video_id)
        .arg(&uploads_dir)
        .output()
        .await
        .map_err(|e| format!("Download failed execution: {}", e))?;
        
    let dl_stdout = String::from_utf8_lossy(&dl_output.stdout);
    let mut dl_result: Option<serde_json::Value> = None;
    for line in dl_stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            dl_result = Some(val);
        }
    }
    
    let dl_json = dl_result.ok_or_else(|| format!("Invalid response from download pipeline: {}", dl_stdout))?;
    
    if let Some(err) = dl_json.get("error") {
        return Err(err.as_str().unwrap_or("Unknown error").to_string());
    }
    
    let mp3_path = dl_json.get("mp3_path").unwrap().as_str().unwrap().to_string();
    let lrc_path = dl_json.get("lrc_path").unwrap().as_str().unwrap().to_string();
    let title = dl_json.get("title").unwrap().as_str().unwrap().to_string();
    let artist = dl_json.get("artist").unwrap().as_str().unwrap().to_string();

    // 2. Separate Audio
    let sep_output = tokio::process::Command::new("python")
        .arg(&separate_script)
        .arg(&mp3_path)
        .arg(&uploads_dir)
        .arg("UVR-MDX-NET-Inst_HQ_5.onnx")
        .output()
        .await
        .map_err(|e| format!("Separation failed execution: {}", e))?;
        
    let sep_stdout = String::from_utf8_lossy(&sep_output.stdout);
    let mut sep_result: Option<serde_json::Value> = None;
    for line in sep_stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            sep_result = Some(val);
        }
    }
    
    let sep_json = sep_result.ok_or_else(|| format!("Invalid response from audio separator: {}", sep_stdout))?;
    
    if let Some(err) = sep_json.get("error") {
        return Err(err.as_str().unwrap_or("Unknown error").to_string());
    }

    let raw_instrumental = sep_json.get("instrumental").unwrap().as_str().unwrap();
    let instrumental_path = PathBuf::from(&uploads_dir).join(raw_instrumental).to_string_lossy().to_string();
    
    let lrc_content = std::fs::read_to_string(&lrc_path).unwrap_or_default();
    let segments = parse_lrc(&lrc_content);
    
    let song = db::CachedSong {
        video_id: video_id.clone(),
        title: title.clone(),
        artist: artist.clone(),
        lrc_path: lrc_path.clone(),
        instrumental_path: instrumental_path.clone(),
        missing_lyrics: false,
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64,
    };
    
    {
        let conn = state.db_conn.lock().unwrap();
        let _ = db::insert_song(&conn, &song);
    }
    
    let res = serde_json::json!({
        "message": "Processing complete",
        "data": {
            "segments": segments,
            "lrc": lrc_content,
            "instrumentalUrl": instrumental_path,
            "title": title,
            "artist": artist
        }
    });

    Ok(res.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
            if !app_dir.exists() {
                std::fs::create_dir_all(&app_dir).unwrap();
            }
            let uploads_dir = app_dir.join("uploads");
            if !uploads_dir.exists() {
                std::fs::create_dir_all(&uploads_dir).unwrap();
            }
            let db_path = app_dir.join("kraoq.db");
            
            let python_dir = if cfg!(debug_assertions) {
                let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                p.push("python");
                p
            } else {
                app.path().resource_dir().unwrap_or_else(|_| PathBuf::from(".")).join("python")
            };
            
            let conn = db::init_db(&db_path.to_string_lossy()).unwrap();
            
            app.manage(AppState {
                db_conn: Mutex::new(conn),
                python_dir,
                uploads_dir,
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![search, suggestions, process_yt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

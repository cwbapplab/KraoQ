mod db;
mod setup;
mod server;




#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, Emitter};
use tauri_plugin_fs::FsExt;
use serde::{Serialize, Deserialize};
use tokio::sync::Mutex as AsyncMutex;
use tokio::sync::oneshot;

pub struct AppState {
    pub db_conn: Mutex<rusqlite::Connection>,
    pub python_dir: PathBuf,
    pub uploads_dir: PathBuf,
    pub app_data_dir: PathBuf,
    pub active_processes: Arc<AsyncMutex<HashMap<String, oneshot::Sender<()>>>>,
    pub party_port: Mutex<Option<u16>>,
    pub party_queue: Mutex<Vec<server::QueueRequest>>,
}



#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub gpu_enabled: bool,
    pub python_version: String,
    pub torch_version: String,
    pub cuda_version: String,
    pub ffmpeg_version: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self { 
            gpu_enabled: true,
            python_version: "3.11.8".to_string(),
            torch_version: "2.5.1".to_string(),
            cuda_version: "12.1".to_string(),
            ffmpeg_version: "latest".to_string(),
        }
    }
}

fn get_config_path(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json")
}


pub fn get_config_internal(app: &AppHandle) -> AppConfig {
    let path = get_config_path(app);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
fn set_config(config: AppConfig, app: AppHandle) -> Result<(), String> {
    let path = get_config_path(&app);
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_app_config(app: AppHandle) -> AppConfig {
    get_config_internal(&app)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuStatus {
    pub torch_version: String,
    pub torch_cuda_available: bool,
    pub torch_cuda_version: String,
    pub onnx_providers: Vec<String>,
    pub cuda_device_name: String,
    pub status: String, // "ok", "degraded", "unavailable"
    pub message: String,
}

#[tauri::command]
async fn check_gpu_status(app: AppHandle) -> Result<GpuStatus, String> {
    let python_exe = get_python_exe(&app);
    let script = r#"
import json, sys
try:
    import torch
    torch_version = torch.__version__
    cuda_available = torch.cuda.is_available()
    cuda_version = str(torch.version.cuda) if torch.version.cuda else ""
    device_name = torch.cuda.get_device_name(0) if cuda_available else ""
except Exception as e:
    torch_version = str(e)
    cuda_available = False
    cuda_version = ""
    device_name = ""

try:
    import onnxruntime as ort
    providers = ort.get_available_providers()
except Exception:
    providers = []

print(json.dumps({
    "torch_version": torch_version,
    "cuda_available": cuda_available,
    "cuda_version": cuda_version,
    "device_name": device_name,
    "providers": providers
}))
"#;
    let output = create_command(&python_exe)
        .arg("-c")
        .arg(script)
        .output()
        .await
        .map_err(|e| format!("Failed to check GPU: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Parse the last valid JSON line from stdout
    let mut parsed: Option<serde_json::Value> = None;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            parsed = Some(val);
        }
    }

    let json = parsed.ok_or_else(|| format!("Invalid GPU check output: {}", stdout))?;

    let torch_version = json["torch_version"].as_str().unwrap_or("unknown").to_string();
    let cuda_available = json["cuda_available"].as_bool().unwrap_or(false);
    let cuda_version = json["cuda_version"].as_str().unwrap_or("").to_string();
    let device_name = json["device_name"].as_str().unwrap_or("").to_string();
    let providers: Vec<String> = json["providers"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let has_cuda_provider = providers.iter().any(|p| p.contains("CUDA"));

    let (status, message) = if cuda_available && has_cuda_provider {
        ("ok".to_string(), format!("GPU fully active — {}", device_name))
    } else if has_cuda_provider && !cuda_available {
        ("degraded".to_string(), "ONNX has CUDA but PyTorch is CPU-only. Reinstall GPU Toolkit.".to_string())
    } else if cuda_available && !has_cuda_provider {
        ("degraded".to_string(), "PyTorch has CUDA but ONNX Runtime is missing GPU support. Reinstall GPU Toolkit.".to_string())
    } else {
        ("unavailable".to_string(), "No GPU acceleration detected. Install GPU Toolkit for faster processing.".to_string())
    };

    Ok(GpuStatus {
        torch_version,
        torch_cuda_available: cuda_available,
        torch_cuda_version: cuda_version,
        onnx_providers: providers,
        cuda_device_name: device_name,
        status,
        message,
    })
}

#[derive(Serialize)]
struct CommandResult<T> {
    data: Option<T>,
    error: Option<String>,
}

pub(crate) fn get_python_exe(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    app_dir.join("python_env").join("python.exe")
}

pub(crate) fn create_command<S: AsRef<std::ffi::OsStr>>(program: S) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    cmd.kill_on_drop(true);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

pub(crate) fn get_python_script_path(app: &AppHandle, script_name: &str) -> PathBuf {
    let state: State<AppState> = app.state();
    state.python_dir.join(script_name)
}


#[tauri::command]
async fn search(query: String, app: AppHandle) -> Result<String, String> {
    let script = get_python_script_path(&app, "search.py");
    let python_exe = get_python_exe(&app);
    let output = create_command(python_exe)
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
    let python_exe = get_python_exe(&app);
    let output = create_command(python_exe)
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Word {
    word: String,
    start: f64,
    end: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Segment {
    time: f64,
    text: String,
    #[serde(default)]
    words: Vec<Word>,
}

fn parse_timestamp(ts: &str) -> Option<f64> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() == 2 {
        if let (Ok(minutes), Ok(seconds)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
            return Some(minutes * 60.0 + seconds);
        }
    }
    None
}

fn parse_lrc(content: &str) -> Vec<Segment> {
    let mut segments = Vec::new();
    for line in content.lines() {
        if let Some(start) = line.find('[') {
            if let Some(end) = line.find(']') {
                let time_str = &line[start + 1..end];
                let text = line[end + 1..].trim();
                if let Some(line_time) = parse_timestamp(time_str) {
                    let mut words = Vec::new();
                    let mut cleaned_text = String::new();
                    
                    let tokens: Vec<&str> = text.split(|c| c == '<' || c == '>').collect();
                    if tokens.len() >= 4 {
                        let mut i = 1;
                        while i + 2 < tokens.len() {
                            let start_str = tokens[i].trim();
                            let word_text = tokens[i + 1].trim();
                            let end_str = tokens[i + 2].trim();
                            
                            if let (Some(s_time), Some(e_time)) = (parse_timestamp(start_str), parse_timestamp(end_str)) {
                                if !word_text.is_empty() {
                                    words.push(Word {
                                        word: word_text.to_string(),
                                        start: s_time,
                                        end: e_time,
                                    });
                                    if !cleaned_text.is_empty() {
                                        cleaned_text.push(' ');
                                    }
                                    cleaned_text.push_str(word_text);
                                }
                            }
                            i += 4;
                        }
                    }
                    
                    let final_text = if words.is_empty() {
                        text.to_string() // Fallback non-ELRC
                    } else {
                        cleaned_text
                    };

                    segments.push(Segment {
                        time: line_time,
                        text: final_text,
                        words,
                    });
                }
            }
        }
    }
    segments
}

#[derive(Clone, Serialize)]
struct ProcessStatus {
    video_id: String,
    step: String,
}

#[tauri::command]
async fn cancel_processing(video_id: String, app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut active_procs = state.active_processes.lock().await;
    if let Some(sender) = active_procs.remove(&video_id) {
        let _ = sender.send(());
        Ok(())
    } else {
        Err("Process not found or already completed".to_string())
    }
}

#[tauri::command]
async fn process_yt(video_id: String, app: AppHandle) -> Result<String, String> {
    let (tx, mut rx) = oneshot::channel::<()>();
    {
        let state = app.state::<AppState>();
        let mut active_procs = state.active_processes.lock().await;
        active_procs.insert(video_id.clone(), tx);
    }

    let emit = |step: &str| {
        let _ = app.emit("process_status", ProcessStatus {
            video_id: video_id.clone(),
            step: step.to_string(),
        });
    };

    let app_clone = app.clone();
    let vid_clone = video_id.clone();

    emit("Checking local library...");

    let process_future = async move {
        let app = app_clone;
        let video_id = vid_clone;
        let state = app.state::<AppState>();
        
        // Check Cache
        {
            let conn = state.db_conn.lock().unwrap();
            if let Ok(Some(cached)) = db::get_song(&conn, &video_id) {
                if !cached.missing_lyrics && std::path::Path::new(&cached.instrumental_path).exists() {
                    let mut final_lrc_path = cached.lrc_path.clone();
                    if final_lrc_path.ends_with(".lrc") {
                        let cand1 = format!("{}.elrc", final_lrc_path);
                        let cand2 = final_lrc_path.replace(".lrc", ".elrc");
                        if std::path::Path::new(&cand1).exists() {
                            final_lrc_path = cand1;
                        } else if std::path::Path::new(&cand2).exists() {
                            final_lrc_path = cand2;
                        }
                    }
                    if let Ok(lrc_content) = std::fs::read_to_string(&final_lrc_path) {
                        let mut vocals_path_found = String::new();
                        if let Some(parent) = std::path::Path::new(&cached.instrumental_path).parent() {
                            if let Some(inst_file) = std::path::Path::new(&cached.instrumental_path).file_name().and_then(|f| f.to_str()) {
                                let mut voc_file = inst_file.to_string();
                                if let Some(idx) = voc_file.find("_(Instrumental)_") {
                                    voc_file = format!("{}.mp3", &voc_file[..idx]);
                                } else if let Some(idx) = voc_file.find("_(Instrumental).mp3") {
                                    voc_file = format!("{}.mp3", &voc_file[..idx]);
                                }
                                let candidate = parent.join(&voc_file);
                                if candidate.exists() {
                                    vocals_path_found = candidate.to_string_lossy().to_string();
                                }
                            }
                        }

                        let segments = parse_lrc(&lrc_content);
                        let res = serde_json::json!({
                            "message": "Processing complete (Cached)",
                            "data": {
                                "segments": segments,
                                "lrc": lrc_content,
                                "instrumentalUrl": cached.instrumental_path,
                                "vocalsUrl": vocals_path_found,
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
        let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
        
        emit("Downloading audio & lyrics from YouTube...");
        // 1. Download Pipeline
        let python_exe = get_python_exe(&app);
        let dl_output = create_command(&python_exe)
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

        emit("Isolating vocals with AI (this takes a moment)...");
        // 2. Separate Audio
        let safe_id: String = video_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
        let result_filename = format!("{}_separate_result.json", safe_id);
        let result_file_path = PathBuf::from(&uploads_dir).join(&result_filename);
        let _ = std::fs::remove_file(&result_file_path);

        let config = get_config_internal(&app);
        let gpu_env = if config.gpu_enabled { "1" } else { "0" };

        let sep_output = create_command(&python_exe)
            .arg(&separate_script)
            .arg(&mp3_path)
            .arg(&uploads_dir)
            .arg("UVR-MDX-NET-Inst_HQ_5.onnx")
            .arg(&result_file_path)
            .env("APP_DATA_DIR", app_dir.to_string_lossy().to_string())
            .env("GPU_ENABLED", gpu_env)
            .output()
            .await
            .map_err(|e| format!("Separation failed execution: {}", e))?;
            
        let _sep_stdout = String::from_utf8_lossy(&sep_output.stdout);
        
        let mut sep_json: serde_json::Value = serde_json::json!({"error": "Unknown error processing separation result"});
        
        if let Ok(content) = std::fs::read_to_string(&result_file_path) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                sep_json = parsed;
            }
        } else if !sep_output.status.success() {
            let stderr = String::from_utf8_lossy(&sep_output.stderr);
            sep_json = serde_json::json!({"error": format!("Separator failed. Exit status: {}. Stderr: {}", sep_output.status, stderr)});
        }
        
        if let Some(err) = sep_json.get("error") {
            return Err(err.as_str().unwrap_or("Unknown error").to_string());
        }

        emit("Finalizing stage...");

        let raw_instrumental = sep_json.get("instrumental").unwrap().as_str().unwrap();
        let instrumental_path = PathBuf::from(&uploads_dir).join(raw_instrumental).to_string_lossy().to_string();
        
        let raw_vocals_opt = sep_json.get("vocals").and_then(|v| v.as_str());
        let vocals_path = if let Some(v) = raw_vocals_opt { 
            PathBuf::from(&uploads_dir).join(v).to_string_lossy().to_string() 
        } else { 
            mp3_path.clone() // fallback
        };

        // 3. Align ELRC
        emit("Generating Enhanced LRC (Word-level timestamps)...");
        let align_script = state.python_dir.join("align_elrc.py");
        let elrc_path = format!("{}.elrc", lrc_path);

        let align_output = create_command(&python_exe)
            .arg(&align_script)
            .arg(&vocals_path)
            .arg(&lrc_path)
            .arg(&elrc_path)
            .output()
            .await;
            
        if let Ok(out) = align_output {
            if !out.status.success() {
                println!("Word alignment failed stderr: {}", String::from_utf8_lossy(&out.stderr));
                println!("Word alignment failed stdout: {}", String::from_utf8_lossy(&out.stdout));
            } else {
                println!("Word alignment success stdout: {}", String::from_utf8_lossy(&out.stdout));
            }
        }
        
        // We will read from the ELRC file if we wanted, or fallback to standard lrc
        let mut final_lrc_path = elrc_path.clone();
        if !std::path::Path::new(&elrc_path).exists() {
            final_lrc_path = lrc_path.clone();
        }

        let lrc_content = std::fs::read_to_string(&final_lrc_path).unwrap_or_else(|_| std::fs::read_to_string(&lrc_path).unwrap_or_default());
        let segments = parse_lrc(&lrc_content);
        
        let song = db::CachedSong {
            video_id: video_id.clone(),
            title: title.clone(),
            artist: artist.clone(),
            lrc_path: final_lrc_path.clone(),
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
                "vocalsUrl": mp3_path,
                "title": title,
                "artist": artist
            }
        });

        Ok(res.to_string())
    };

    let result = tokio::select! {
        res = process_future => res,
        _ = &mut rx => {
            Err("Processing cancelled by user".to_string())
        }
    };

    {
        let state = app.state::<AppState>();
        let mut active_procs = state.active_processes.lock().await;
        active_procs.remove(&video_id);
    }
    
    result
}

#[tauri::command]
async fn reinstall_dependency(id: String, app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let app_dir = state.app_data_dir.clone();
    let python_exe = get_python_exe(&app);
    let bin_dir = app_dir.join("bin");
    let models_dir = app_dir.join("models");
    let req_path = state.python_dir.join("requirements.txt");

    let config = get_config_internal(&app);

    match id.as_str() {
        "python" => setup::install_python_runtime(&app, &app_dir, &python_exe, &config.python_version, 1).await?,
        "ffmpeg" => setup::install_ffmpeg(&app, &bin_dir, &config.ffmpeg_version, 2).await?,
        "models" => setup::install_ai_models(&app, &models_dir, 3).await?,
        "pip" => {
            setup::install_pip_modules(&app, &python_exe, &req_path, 4).await?;
            // Pip modules (audio-separator[gpu]) install CPU-only torch,
            // so we must re-run GPU acceleration to restore CUDA torch.
            let gpu_done_file = app_dir.join(".gpu_setup_done");
            let _ = std::fs::remove_file(&gpu_done_file);
            setup::install_gpu_acceleration(&app, &python_exe, &config.torch_version, &config.cuda_version, 5).await?;
        },
        "gpu" => setup::install_gpu_acceleration(&app, &python_exe, &config.torch_version, &config.cuda_version, 5).await?,
        _ => return Err("Unknown dependency ID".to_string()),
    }
    Ok(())
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
                app_data_dir: app_dir,
                active_processes: Arc::new(AsyncMutex::new(HashMap::new())),
                party_port: Mutex::new(None),
                party_queue: Mutex::new(Vec::new()),
            });

            
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {

                if let Ok(port) = server::start_server(app_handle.clone()).await {
                    let state = app_handle.state::<AppState>();
                    *state.party_port.lock().unwrap() = Some(port);
                    println!("Party Mode Server running on port {}", port);
                }
            });
            
            Ok(())

        })
        .invoke_handler(tauri::generate_handler![
            search, 
            suggestions, 
            process_yt, 
            cancel_processing,
            setup::setup_dependencies,
            set_config,
            get_app_config,
            check_gpu_status,
            reinstall_dependency,
            server::get_party_url,
            server::remove_from_party_queue,
            server::force_takeover

        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

}

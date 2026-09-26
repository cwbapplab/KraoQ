mod db;
mod setup;
mod server;

use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use serde::{Serialize, Deserialize};
use tokio::sync::Mutex as AsyncMutex;
use tokio::sync::oneshot;
use reqwest;

pub struct AppState {
    pub db_conn: Mutex<rusqlite::Connection>,
    pub python_dir: PathBuf,
    pub uploads_dir: PathBuf,
    pub app_data_dir: PathBuf,
    pub active_processes: Arc<AsyncMutex<HashMap<String, oneshot::Sender<()>>>>,
    pub party_port: Mutex<Option<u16>>,
    pub party_queue: Mutex<Vec<server::QueueRequest>>,
    pub local_server_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    pub local_ws_clients: Arc<AsyncMutex<Vec<tokio::sync::mpsc::Sender<tokio_tungstenite::tungstenite::Message>>>>,
}



#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub gpu_enabled: bool,
    pub python_version: String,
    pub torch_version: String,
    pub cuda_version: String,
    pub ffmpeg_version: String,
    #[serde(default = "default_instrumental_preset")]
    pub instrumental_preset: String,
    #[serde(default = "default_vocal_preset")]
    pub vocal_preset: String,
    #[serde(default = "default_isolate_vocals")]
    pub isolate_vocals: bool,
    #[serde(default)]
    pub gpu_choice_made: bool,
    #[serde(default)]
    pub active_plugin_path: String,
    #[serde(default)]
    pub raw_library_folder: String,
    #[serde(default)]
    pub relay_url: String,
    #[serde(default)]
    pub last_party_id: String,
    #[serde(default)]
    pub last_party_token: String,
    #[serde(default)]
    pub last_party_timestamp: i64,
    #[serde(default = "default_app_mode")]
    pub app_mode: String, // "standalone" or "presentation"
    #[serde(default)]
    pub user_token: String,
    #[serde(default)]
    pub username: String,
}

fn default_instrumental_preset() -> String { "instrumental_clean".to_string() }
fn default_vocal_preset() -> String { "vocal_clean".to_string() }
fn default_app_mode() -> String { "standalone".to_string() }
fn default_isolate_vocals() -> bool { true }

impl Default for AppConfig {
    fn default() -> Self {
        Self { 
            gpu_enabled: true,
            python_version: "3.11.8".to_string(),
            torch_version: "2.7.1".to_string(),
            cuda_version: "12.8".to_string(),
            ffmpeg_version: "7.1".to_string(),
            instrumental_preset: default_instrumental_preset(),
            vocal_preset: default_vocal_preset(),
            isolate_vocals: default_isolate_vocals(),
            gpu_choice_made: false,
            active_plugin_path: "".to_string(),
            raw_library_folder: "".to_string(),
            relay_url: "".to_string(),
            last_party_id: "".to_string(),
            last_party_token: "".to_string(),
            last_party_timestamp: 0,
            app_mode: default_app_mode(),
            user_token: "".to_string(),
            username: "".to_string(),
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
    set_config_internal(config, app)
}

pub(crate) fn set_config_internal(config: AppConfig, app: AppHandle) -> Result<(), String> {
    let path = get_config_path(&app);
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_app_config(app: AppHandle) -> AppConfig {
    get_app_config_internal(app)
}

pub(crate) fn get_app_config_internal(app: AppHandle) -> AppConfig {
    get_config_internal(&app)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuIssue {
    pub id: String,
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub fix_id: String,
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
    // Extended diagnostic detail (see python/check_gpu.py)
    pub onnx_runtime_version: String,
    pub onnx_cuda_active: bool,
    pub onnx_missing_dll: Option<String>,
    pub torch_cuda_major: Option<String>,
    pub onnx_cuda_major: Option<String>,
    pub invalid_models: Vec<String>,
    // Word-level lyric alignment (stable-ts/torchaudio) capability.
    pub alignment_ok: bool,
    pub torchaudio_version: String,
    pub issues: Vec<GpuIssue>,
}

#[tauri::command]
async fn check_gpu_status(app: AppHandle) -> Result<GpuStatus, String> {
    check_gpu_status_internal(app).await
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuSetupState {
    pub nvidia_detected: bool,
    pub nvidia_name: String,
    pub gpu_installed: bool,
}

#[tauri::command]
async fn get_gpu_setup_state(app: AppHandle) -> GpuSetupState {
    let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let gpu_installed = app_dir.join(".gpu_setup_done").exists();
    let (nvidia_detected, nvidia_name) = setup::detect_nvidia_gpu().await;
    GpuSetupState { nvidia_detected, nvidia_name, gpu_installed }
}

pub(crate) async fn check_gpu_status_internal(app: AppHandle) -> Result<GpuStatus, String> {
    let python_exe = get_python_exe(&app);
    let state = app.state::<AppState>();
    let script = state.python_dir.join("check_gpu.py");
    let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));

    let output = create_command(&python_exe)
        .arg(&script)
        .env("APP_DATA_DIR", app_dir.to_string_lossy().to_string())
        .env("APP_MODELS_DIR", app_dir.join("models").to_string_lossy().to_string())
        .output()
        .await
        .map_err(|e| format!("Failed to run GPU diagnostic: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // The diagnostic prints a single JSON object; pick the last parseable line.
    let mut parsed: Option<serde_json::Value> = None;
    for line in stdout.lines() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            parsed = Some(val);
        }
    }

    let json = parsed.ok_or_else(|| {
        format!(
            "Invalid GPU diagnostic output: {} {}",
            stdout,
            String::from_utf8_lossy(&output.stderr)
        )
    })?;

    Ok(gpu_status_from_json(&json))
}

fn gpu_status_from_json(json: &serde_json::Value) -> GpuStatus {
    let torch = &json["torch"];
    let onnx = &json["onnx"];
    let compat = &json["compat"];

    let torch_version = torch["version"].as_str().unwrap_or("unknown").to_string();
    let torch_cuda_available = torch["available"].as_bool().unwrap_or(false);
    let torch_cuda_version = torch["cuda_build"].as_str().unwrap_or("").to_string();
    let cuda_device_name = torch["device"].as_str().unwrap_or("").to_string();
    let kernel_ok = torch["kernel_ok"].as_bool().unwrap_or(false);

    let onnx_providers: Vec<String> = onnx["available_providers"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let onnx_runtime_version = onnx["package_version"].as_str().unwrap_or("").to_string();
    let onnx_cuda_active = onnx["cuda_active"].as_bool().unwrap_or(false);
    let onnx_missing_dll = onnx["missing_dll"].as_str().map(String::from);

    let invalid_models: Vec<String> = json["invalid_models"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let alignment = &json["alignment"];
    // Default to `true` when the probe is missing so we never raise a false alarm.
    let alignment_ok = alignment["ok"].as_bool().unwrap_or(true);
    let torchaudio_version = alignment["torchaudio_version"].as_str().unwrap_or("").to_string();

    let issues: Vec<GpuIssue> = json["issues"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|i| GpuIssue {
                    id: i["id"].as_str().unwrap_or("").to_string(),
                    severity: i["severity"].as_str().unwrap_or("warning").to_string(),
                    title: i["title"].as_str().unwrap_or("").to_string(),
                    detail: i["detail"].as_str().unwrap_or("").to_string(),
                    fix_id: i["fix_id"].as_str().unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    let status = json["status"].as_str().unwrap_or("unavailable").to_string();

    let message = if !issues.is_empty() {
        issues
            .iter()
            .map(|i| format!("{}: {}", i.title, i.detail))
            .collect::<Vec<_>>()
            .join(" | ")
    } else if kernel_ok && onnx_cuda_active {
        format!("GPU fully active — {}", cuda_device_name)
    } else if !torch_cuda_available {
        "No GPU acceleration detected. Install the GPU Toolkit for faster processing.".to_string()
    } else {
        "GPU status unknown".to_string()
    };

    GpuStatus {
        torch_version,
        torch_cuda_available,
        torch_cuda_version,
        onnx_providers,
        cuda_device_name,
        status,
        message,
        onnx_runtime_version,
        onnx_cuda_active,
        onnx_missing_dll,
        torch_cuda_major: compat["torch_cuda_major"].as_str().map(String::from),
        onnx_cuda_major: compat["onnx_cuda_major"].as_str().map(String::from),
        invalid_models,
        alignment_ok,
        torchaudio_version,
        issues,
    }
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

#[tauri::command]
async fn search(query: String, app: AppHandle) -> Result<String, String> {
    search_internal(query, app).await
}

pub(crate) async fn search_internal(query: String, app: AppHandle) -> Result<String, String> {
    let config = crate::get_config_internal(&app);
    let state: tauri::State<crate::AppState> = app.state();
    
    let mut program = get_python_exe(&app).to_string_lossy().to_string();
    let default_plugin = state.python_dir.parent().unwrap().join("youtube_plugin").join("main.py");
    let mut is_default = true;
    
    if !config.active_plugin_path.trim().is_empty() {
        program = config.active_plugin_path.clone();
        is_default = false;
    }

    let mut cmd = create_command(&program);
    if is_default {
        cmd.arg(&default_plugin);
    }

    let output = cmd
        .arg("search")
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
    suggestions_internal(query, app).await
}

pub(crate) async fn suggestions_internal(query: String, app: AppHandle) -> Result<String, String> {
    let config = crate::get_config_internal(&app);
    let state: tauri::State<crate::AppState> = app.state();
    
    let mut program = get_python_exe(&app).to_string_lossy().to_string();
    let default_plugin = state.python_dir.parent().unwrap().join("youtube_plugin").join("main.py");
    let mut is_default = true;
    
    if !config.active_plugin_path.trim().is_empty() {
        program = config.active_plugin_path.clone();
        is_default = false;
    }

    let mut cmd = create_command(&program);
    if is_default {
        cmd.arg(&default_plugin);
    }

    let output = cmd
        .arg("suggestions")
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
    cancel_processing_internal(video_id, app).await
}

pub(crate) async fn cancel_processing_internal(video_id: String, app: AppHandle) -> Result<(), String> {
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
    process_yt_internal(video_id, app).await
}

pub(crate) async fn process_yt_internal(video_id: String, app: AppHandle) -> Result<String, String> {
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
        let cached_song = {
            let conn = state.db_conn.lock().unwrap();
            db::get_song(&conn, &video_id).ok().flatten()
        };

        if let Some(cached) = cached_song {
            if !cached.missing_lyrics && std::path::Path::new(&cached.instrumental_path).exists() {
                // Locate the isolated vocals stem (alignment works best against it).
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

                // Prefer the enhanced (word-level) lyrics next to the base .lrc.
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

                // Cached without word-level timings (processed before alignment existed, or
                // a previous run failed): generate the ELRC now so lyrics highlight word by
                // word instead of silently falling back to plain line-level text.
                if final_lrc_path.ends_with(".lrc") {
                    emit("Adding word-level lyric timings...");
                    let align_script = state.python_dir.join("align_elrc.py");
                    let elrc_path = format!("{}.elrc", final_lrc_path);
                    let align_audio = if vocals_path_found.is_empty() {
                        cached.instrumental_path.clone()
                    } else {
                        vocals_path_found.clone()
                    };

                    let align_output = create_command(&get_python_exe(&app))
                        .arg(&align_script)
                        .arg(&align_audio)
                        .arg(&final_lrc_path)
                        .arg(&elrc_path)
                        .output()
                        .await;

                    match align_output {
                        Ok(out) if out.status.success() && std::path::Path::new(&elrc_path).exists() => {
                            final_lrc_path = elrc_path.clone();
                            // Persist so subsequent plays skip alignment.
                            let mut updated = cached.clone();
                            updated.lrc_path = elrc_path;
                            let conn = state.db_conn.lock().unwrap();
                            let _ = db::insert_song(&conn, &updated);
                        }
                        Ok(out) => println!(
                            "Word alignment failed (cached): {}", 
                            String::from_utf8_lossy(&out.stderr)
                        ),
                        Err(e) => println!("Word alignment failed to start (cached): {}", e),
                    }
                }

                if let Ok(lrc_content) = std::fs::read_to_string(&final_lrc_path) {
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

        let separate_script = state.python_dir.join("separate.py");
        let uploads_dir = state.uploads_dir.to_string_lossy().to_string();
        let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
        let config = get_config_internal(&app);

        let mut raw_lib_dir = config.raw_library_folder.clone();
        if raw_lib_dir.trim().is_empty() {
            raw_lib_dir = uploads_dir.clone();
        }

        emit("Sourcing audio & lyrics via plugin...");
        // 1. Download Pipeline (Plugin)
        let mut program = get_python_exe(&app).to_string_lossy().to_string();
        let default_plugin = state.python_dir.parent().unwrap().join("youtube_plugin").join("main.py");
        let mut is_default = true;
        
        if !config.active_plugin_path.trim().is_empty() {
            program = config.active_plugin_path.clone();
            is_default = false;
        }

        let mut dl_cmd = create_command(&program);
        if is_default {
            dl_cmd.arg(&default_plugin);
        }

        let dl_output = dl_cmd
            .arg("download")
            .arg(&video_id)
            .arg(&raw_lib_dir)
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
        
        let dl_json = dl_result.ok_or_else(|| format!("Invalid response from plugin: {}", dl_stdout))?;
        
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

        let gpu_env = if config.gpu_enabled { "1" } else { "0" };

        let python_exe = get_python_exe(&app);
        let sep_output = create_command(&python_exe)
            .arg(&separate_script)
            .arg(&mp3_path)
            .arg(&uploads_dir)
            .arg("UVR-MDX-NET-Inst_HQ_5.onnx")
            .arg(&result_file_path)
            .env("APP_DATA_DIR", app_dir.to_string_lossy().to_string())
            .env("GPU_ENABLED", gpu_env)
            .env("INST_PRESET", &config.instrumental_preset)
            .env("VOC_PRESET", &config.vocal_preset)
            .env("ISOLATE_VOCALS", if config.isolate_vocals { "1" } else { "0" })
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

    let config = get_config_internal(&app);
    let req_file = if config.gpu_enabled { "requirements-gpu.txt" } else { "requirements.txt" };
    let req_path = state.python_dir.join(req_file);

    match id.as_str() {
        "python" => setup::install_python_runtime(&app, &app_dir, &python_exe, &config.python_version, 1).await?,
        "ffmpeg" => setup::install_ffmpeg(&app, &bin_dir, &config.ffmpeg_version, 2).await?,
        "models" => setup::install_ai_models(&app, &models_dir, 3).await?,
        "pip" => {
            setup::install_pip_modules(&app, &python_exe, &req_path, 4).await?;
            if config.gpu_enabled {
                let gpu_done_file = app_dir.join(".gpu_setup_done");
                let _ = std::fs::remove_file(&gpu_done_file);
                setup::install_gpu_acceleration(&app, &python_exe, &config.torch_version, &config.cuda_version, 5).await?;
            }
        },
        "gpu" => setup::install_gpu_acceleration(&app, &python_exe, &config.torch_version, &config.cuda_version, 5).await?,
        _ => return Err("Unknown dependency ID".to_string()),
    }
    Ok(())
}

/// Runs the GPU diagnostic and repairs whatever it finds, returning the fresh
/// status. Each fix is driven by the `fixId` on the reported issues.
#[tauri::command]
async fn repair_gpu_stack(app: AppHandle) -> Result<GpuStatus, String> {
    let state = app.state::<AppState>();
    let app_dir = state.app_data_dir.clone();
    let python_exe = get_python_exe(&app);
    let models_dir = app_dir.join("models");
    let config = get_config_internal(&app);

    let before = check_gpu_status_internal(app.clone()).await?;
    let fix_ids: Vec<String> = before.issues.iter().map(|i| i.fix_id.clone()).collect();

    // Target the CUDA major PyTorch is actually built for.
    let torch_major = before
        .torch_cuda_version
        .split('.')
        .next()
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| config.cuda_version.split('.').next().unwrap_or("12").to_string());

    if fix_ids.iter().any(|f| f.as_str() == "onnxruntime") {
        setup::install_onnxruntime(&app, &python_exe, &torch_major, 4).await?;
    }

    // Reinstall the PyTorch stack when torch, its NVIDIA libs, or torchaudio (used
    // for word-level lyric alignment) are broken. torchaudio is pinned to torch so
    // the two stay ABI-compatible; the CUDA index is only used when GPU mode is on.
    let needs_torch_stack = fix_ids.iter().any(|f| matches!(f.as_str(), "torch" | "nvidia_libs" | "torchaudio"));
    if needs_torch_stack {
        let cuda = if config.gpu_enabled { Some(config.cuda_version.clone()) } else { None };
        setup::install_torch_stack(&app, &python_exe, &config.torch_version, cuda.as_deref(), 5).await?;
        if config.gpu_enabled {
            // Re-apply the matching ONNX Runtime in case torch pulled a new CUDA major.
            setup::install_onnxruntime(&app, &python_exe, &torch_major, 4).await?;
        }
    }

    if fix_ids.iter().any(|f| f.as_str() == "models") {
        for name in &before.invalid_models {
            let path = models_dir.join(name);
            if path.exists() {
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    // Dependency state may have changed — drop the cached markers.
    if !fix_ids.is_empty() {
        let _ = std::fs::remove_file(app_dir.join(".pip_setup_done"));
        let _ = std::fs::remove_file(app_dir.join(".gpu_setup_done"));
    }

    check_gpu_status_internal(app).await
}


#[tauri::command]
async fn search_lrclib(query: String) -> Result<Vec<LrcSearchResult>, String> {
    search_lrclib_internal(query).await
}

pub(crate) async fn search_lrclib_internal(query: String) -> Result<Vec<LrcSearchResult>, String> {
    let url = format!("https://lrclib.net/api/search?q={}", urlencoding::encode(&query));
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let results: Vec<LrcLibResult> = response.json().await.map_err(|e: reqwest::Error| e.to_string())?;

    let mut output = Vec::new();
    for res in results {
        let first_word_time = res.synced_lyrics.as_ref().and_then(|l| {
            // Find the first [mm:ss.xx]
            let re = regex::Regex::new(r"\[(\d+):(\d+\.\d+)\]").unwrap();
            if let Some(caps) = re.captures(l) {
                let mins: f64 = caps[1].parse().unwrap_or(0.0);
                let secs: f64 = caps[2].parse().unwrap_or(0.0);
                Some(mins * 60.0 + secs)
            } else {
                None
            }
        });

        output.push(LrcSearchResult {
            id: res.id,
            lrc_name: format!("{} - {}", res.track_name, res.artist_name),
            song_length: res.duration,
            first_word_time,
            synced_lyrics: res.synced_lyrics,
            plain_lyrics: res.plain_lyrics,
        });
    }

    Ok(output)
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct LrcLibResult {
    id: i64,
    track_name: String,
    artist_name: String,
    duration: f64,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LrcSearchResult {
    id: i64,
    lrc_name: String,
    song_length: f64,
    first_word_time: Option<f64>,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

#[tauri::command]
async fn apply_alternative_lyrics(video_id: String, lyrics_text: String, lrclib_id: Option<i64>, app: AppHandle) -> Result<String, String> {
    apply_alternative_lyrics_internal(video_id, lyrics_text, lrclib_id, app).await
}

pub(crate) async fn apply_alternative_lyrics_internal(video_id: String, lyrics_text: String, lrclib_id: Option<i64>, app: AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();
    
    // 1. Get existing song info
    let song = {
        let conn = state.db_conn.lock().unwrap();
        db::get_song(&conn, &video_id).map_err(|e| e.to_string())?
            .ok_or_else(|| "Song not found in library".to_string())?
    };

    // 2. Determine paths
    let inst_path = PathBuf::from(&song.instrumental_path);
    let parent_dir = inst_path.parent().unwrap_or(&state.uploads_dir);
    
    // Find vocals path (similar logic as in process_yt)
    let mut vocals_path = String::new();
    if let Some(inst_file) = inst_path.file_name().and_then(|f| f.to_str()) {
        let mut voc_file = inst_file.to_string();
        if let Some(idx) = voc_file.find("_(Instrumental)_") {
            voc_file = format!("{}.mp3", &voc_file[..idx]);
        } else if let Some(idx) = voc_file.find("_(Instrumental).mp3") {
            voc_file = format!("{}.mp3", &voc_file[..idx]);
        }
        let candidate = parent_dir.join(&voc_file);
        if candidate.exists() {
            vocals_path = candidate.to_string_lossy().to_string();
        }
    }
    
    if vocals_path.is_empty() {
        vocals_path = song.instrumental_path.clone(); // fallback
    }

    // 3. Save new LRC to a temp file for alignment
    let name_suffix = if let Some(id) = lrclib_id { format!("_alt_{}", id) } else { "_alt".to_string() };
    let new_lrc_filename = format!("{}{}.lrc", video_id, name_suffix);
    let new_lrc_path = parent_dir.join(&new_lrc_filename);
    std::fs::write(&new_lrc_path, &lyrics_text).map_err(|e| format!("Failed to save new LRC: {}", e))?;

    // 4. Align if possible
    let python_exe = get_python_exe(&app);
    let align_script = state.python_dir.join("align_elrc.py");
    let elrc_path = new_lrc_path.with_extension("elrc");

    let mut align_cmd = create_command(&python_exe);
    align_cmd.arg(&align_script)
             .arg(&vocals_path)
             .arg(&new_lrc_path)
             .arg(&elrc_path);

    let output = align_cmd.output().await;
    
    let final_lrc_path = if let Ok(out) = output {
        if out.status.success() && elrc_path.exists() {
            elrc_path
        } else {
            new_lrc_path
        }
    } else {
        new_lrc_path
    };

    // 5. Update Database
    let mut updated_song = song.clone();
    updated_song.lrc_path = final_lrc_path.to_string_lossy().to_string();
    updated_song.missing_lyrics = false;
    
    {
        let conn = state.db_conn.lock().unwrap();
        db::insert_song(&conn, &updated_song).map_err(|e| e.to_string())?;
    }

    // 6. Return parsed segments
    let lrc_content = std::fs::read_to_string(&updated_song.lrc_path).map_err(|e| e.to_string())?;
    let segments = parse_lrc(&lrc_content);
    
    let res = serde_json::json!({
        "message": "Alternative lyrics applied",
        "data": {
            "segments": segments,
            "lrc": lrc_content,
            "instrumentalUrl": updated_song.instrumental_path,
            "vocalsUrl": vocals_path,
            "title": updated_song.title,
            "artist": updated_song.artist
        }
    });

    Ok(res.to_string())
}

#[tauri::command]
async fn get_recommendations(app: tauri::AppHandle) -> Result<Vec<db::CachedSong>, String> {
    get_recommendations_internal(app).await
}

pub(crate) async fn get_recommendations_internal(app: tauri::AppHandle) -> Result<Vec<db::CachedSong>, String> {
    let state = app.state::<AppState>();
    let conn = state.db_conn.lock().unwrap();
    db::get_recommendations(&conn, 20).map_err(|e| e.to_string())
}





#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LyricsStatus {
    active_id: Option<i64>,
    downloaded_ids: Vec<i64>,
}

#[tauri::command]
async fn get_lyrics_status(video_id: String, app: tauri::AppHandle) -> Result<LyricsStatus, String> {
    get_lyrics_status_internal(video_id, app).await
}

pub(crate) async fn get_lyrics_status_internal(video_id: String, app: tauri::AppHandle) -> Result<LyricsStatus, String> {
    let state = app.state::<AppState>();
    
    let song = {
        let conn = state.db_conn.lock().unwrap();
        db::get_song(&conn, &video_id).map_err(|e| e.to_string())?
    };
    
    let mut status = LyricsStatus {
        active_id: None,
        downloaded_ids: Vec::new(),
    };
    
    if let Some(song) = song {
        let path = std::path::Path::new(&song.lrc_path);
        let file_name_str = path.file_stem().and_then(|n| n.to_str()).unwrap_or("");
        
        let prefix = format!("{}_alt_", video_id);
        if file_name_str.starts_with(&prefix) {
            if let Ok(id) = file_name_str[prefix.len()..].parse::<i64>() {
                status.active_id = Some(id);
            }
        }
        
        // Scan directory for downloaded alternatives
        let parent_dir = path.parent().unwrap_or(&state.uploads_dir);
        if let Ok(entries) = std::fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
                if let Some(mut f_name) = entry.file_name().to_str() {
                    if f_name.starts_with(&prefix) {
                        f_name = f_name.trim_end_matches(".elrc").trim_end_matches(".lrc");
                        if let Ok(id) = f_name[prefix.len()..].parse::<i64>() {
                            if !status.downloaded_ids.contains(&id) {
                                status.downloaded_ids.push(id);
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(status)
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
            let separate_dir = app_dir.join("separate");
            if !separate_dir.exists() {
                std::fs::create_dir_all(&separate_dir).unwrap();
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
                local_server_tx: Mutex::new(None),
                local_ws_clients: Arc::new(AsyncMutex::new(Vec::new())),
            });

            
            let _app_handle = app.handle().clone();
            // Server (WS client) connection is now manually triggered via UI Start Party Mode button
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
            get_gpu_setup_state,
            check_gpu_status,
            repair_gpu_stack,
            reinstall_dependency,
            server::get_local_ip_addr,
            server::start_party_mode,
            server::stop_party_mode,
            server::remove_from_party_queue,
            server::broadcast_ws,
            get_recommendations,
            search_lrclib,
            apply_alternative_lyrics,
            get_lyrics_status,
            server::start_http_server,
            server::stop_http_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

}

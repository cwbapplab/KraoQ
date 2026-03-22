use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{Write, Read};
use reqwest::Client;
use tauri::{AppHandle, Manager, State, Emitter};
use zip::ZipArchive;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use crate::AppState;
use serde_json::json;

const FFMPEG_URL: &str = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
const MODEL_URL: &str = "https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_5.onnx";
const GET_PIP_URL: &str = "https://bootstrap.pypa.io/get-pip.py";

pub async fn download_file(url: &str, path: &PathBuf) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client.get(url).send().await.map_err(|e| format!("Failed to request {}: {}", url, e))?;
    let bytes = response.bytes().await.map_err(|e| format!("Failed to read body: {}", e))?;
    let mut file = File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("Failed to write to file: {}", e))?;
    Ok(())
}

pub fn extract_zip(zip_path: &PathBuf, target_dir: &PathBuf) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to parse zip: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Failed to read zip file item: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| format!("Failed to create zip dir: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(p).map_err(|e| format!("Failed to create zip parent dir: {}", e))?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| format!("Failed to extract file: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to write extracted file: {}", e))?;
        }
    }
    Ok(())
}

pub async fn install_python_runtime(app: &AppHandle, app_dir: &PathBuf, python_exe: &PathBuf, version: &str, current_step: i32) -> Result<(), String> {
    let python_env = app_dir.join("python_env");
    let python_url = format!("https://www.python.org/ftp/python/{}/python-{}-embed-amd64.zip", version, version);
    
    emit_step(app, "python", &format!("Python Runtime ({})", version), "loading", 20, current_step);
    let _ = std::fs::create_dir_all(&python_env);
    let zip_path = app_dir.join("python.zip");
    
    download_file(&python_url, &zip_path).await?;
    emit_step(app, "python", "Python Runtime (Extracting)", "loading", 60, current_step);
    extract_zip(&zip_path, &python_env)?;
    let _ = std::fs::remove_file(zip_path);

    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() >= 2 {
        let pth_filename = format!("python{}{}._pth", parts[0], parts[1]);
        let pth_file = python_env.join(pth_filename);
        if pth_file.exists() {
            if let Ok(mut content) = std::fs::read_to_string(&pth_file) {
                if content.contains("#import site") {
                    content = content.replace("#import site", "import site");
                    let _ = std::fs::write(&pth_file, content);
                }
            }
        }
    }
    
    // Install Pip
    let get_pip_path = python_env.join("get-pip.py");
    download_file(GET_PIP_URL, &get_pip_path).await?;
    
    let mut pip_cmd = tokio::process::Command::new(python_exe);
    #[cfg(target_os = "windows")] { pip_cmd.creation_flags(0x08000000); }
    pip_cmd.arg(&get_pip_path);
    let _ = pip_cmd.output().await;
    let _ = std::fs::remove_file(get_pip_path);
    emit_step(app, "python", "Python Runtime", "done", 100, current_step);
    Ok(())
}

pub async fn install_ffmpeg(app: &AppHandle, bin_dir: &PathBuf, version: &str, current_step: i32) -> Result<(), String> {
    let ffmpeg_url = if version == "latest" {
        FFMPEG_URL.to_string()
    } else {
        format!("https://github.com/BtbN/FFmpeg-Builds/releases/download/n{}/ffmpeg-n{}-win64-gpl.zip", version, version)
    };

    emit_step(app, "ffmpeg", &format!("FFmpeg ({})", version), "loading", 30, current_step);
    let _ = std::fs::create_dir_all(bin_dir);
    let zip_path = bin_dir.join("ffmpeg.zip");
    download_file(&ffmpeg_url, &zip_path).await?;
    
    emit_step(app, "ffmpeg", "FFmpeg (Extracting)", "loading", 70, current_step);
    extract_zip(&zip_path, bin_dir)?;
    
    // Move files from nested dir
    let dir_name = if version == "latest" {
        "ffmpeg-master-latest-win64-gpl".to_string()
    } else {
        format!("ffmpeg-n{}-win64-gpl", version)
    };

    let extracted_path = bin_dir.join(dir_name).join("bin");
    if extracted_path.exists() {
        if let Ok(entries) = std::fs::read_dir(extracted_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name() {
                    let dest = bin_dir.join(name);
                    let _ = std::fs::rename(path, dest);
                }
            }
        }
    }
    let _ = std::fs::remove_file(zip_path);
    emit_step(app, "ffmpeg", "FFmpeg (Multimedia Engine)", "done", 100, current_step);
    Ok(())
}

pub async fn install_ai_models(app: &AppHandle, models_dir: &PathBuf, current_step: i32) -> Result<(), String> {
    let model_path = models_dir.join("UVR-MDX-NET-Inst_HQ_5.onnx");
    emit_step(app, "models", "AI Vocal Remover Models", "loading", 50, current_step);
    let _ = std::fs::create_dir_all(models_dir);
    download_file(MODEL_URL, &model_path).await?;
    emit_step(app, "models", "AI Vocal Remover Models", "done", 100, current_step);
    Ok(())
}

pub async fn install_pip_modules(app: &AppHandle, python_exe: &PathBuf, req_path: &PathBuf, current_step: i32) -> Result<(), String> {
    emit_step(app, "pip", "Neural Network Modules (Pip)", "loading", 40, current_step);
    let mut pip_install = tokio::process::Command::new(python_exe);
    #[cfg(target_os = "windows")] { pip_install.creation_flags(0x08000000); }
    pip_install.arg("-m").arg("pip").arg("install").arg("-r").arg(req_path);
    
    let output = pip_install.output().await.map_err(|e| format!("Pip install failed: {}", e))?;
    if !output.status.success() {
        emit_step(app, "pip", "Neural Network Modules (Error)", "error", 100, current_step);
        return Err(format!("Pip error: {}", String::from_utf8_lossy(&output.stderr)));
    }
    emit_step(app, "pip", "Neural Network Modules (Pip)", "done", 100, current_step);
    Ok(())
}

pub async fn install_gpu_acceleration(app: &AppHandle, python_exe: &PathBuf, torch_version: &str, cuda_version: &str, current_step: i32) -> Result<(), String> {
    emit_step(app, "gpu", &format!("GPU Acceleration (Torch {}, CUDA {})", torch_version, cuda_version), "loading", 10, current_step);
    
    let cuda_tag = cuda_version.replace(".", ""); 
    let cuda_major = cuda_version.split('.').next().unwrap_or("12");

    // 1. Install CUDA-enabled Torch
    emit_step(app, "gpu", "Installing GPU Optimized AI Core...", "loading", 30, current_step);
    let mut torch_install = tokio::process::Command::new(python_exe);
    #[cfg(target_os = "windows")] { torch_install.creation_flags(0x08000000); }
    torch_install.arg("-m").arg("pip").arg("install")
        .arg(format!("torch=={}", torch_version)).arg("torchvision").arg("torchaudio")
        .arg("--index-url").arg(format!("https://download.pytorch.org/whl/cu{}", cuda_tag))
        .arg("--force-reinstall")
        .arg("--no-warn-script-location");
    
    let torch_output = torch_install.output().await.map_err(|e| format!("Torch install failed: {}", e))?;
    if !torch_output.status.success() {
        println!("GPU Torch install failed: {}", String::from_utf8_lossy(&torch_output.stderr));
    }

    // 2. Install NVIDIA Runtime Libraries
    emit_step(app, "gpu", "Installing NVIDIA Runtime Libraries...", "loading", 70, current_step);
    let mut nvidia_install = tokio::process::Command::new(python_exe);
    #[cfg(target_os = "windows")] { nvidia_install.creation_flags(0x08000000); }
    nvidia_install.arg("-m").arg("pip").arg("install")
        .arg(format!("nvidia-cuda-runtime-cu{}", cuda_major))
        .arg(format!("nvidia-cudnn-cu{}", cuda_major))
        .arg(format!("nvidia-cublas-cu{}", cuda_major))
        .arg(format!("nvidia-cuda-cupti-cu{}", cuda_major))
        .arg(format!("nvidia-cuda-nvrtc-cu{}", cuda_major))
        .arg(format!("nvidia-nvjitlink-cu{}", cuda_major))
        .arg(format!("nvidia-curand-cu{}", cuda_major))
        .arg(format!("nvidia-cusolver-cu{}", cuda_major))
        .arg(format!("nvidia-cusparse-cu{}", cuda_major))
        .arg(format!("nvidia-nccl-cu{}", cuda_major))
        .arg(format!("nvidia-nvtx-cu{}", cuda_major))
        .arg("--no-warn-script-location");

    let _ = nvidia_install.output().await;

    emit_step(app, "gpu", "GPU Acceleration (CUDA/NVIDIA)", "done", 100, current_step);
    Ok(())
}

fn emit_step(app: &AppHandle, id: &str, label: &str, status: &str, progress: i32, step_idx: i32) {
    let total_steps = 5;
    let _ = app.emit("setup_step", json!({
        "id": id,
        "label": label,
        "status": status, 
        "progress": progress,
        "totalSteps": total_steps,
        "currentStepIndex": step_idx
    }));
}

#[tauri::command]
pub async fn setup_dependencies(app: AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let python_env = app_dir.join("python_env");
    let python_exe = python_env.join("python.exe");
    let bin_dir = app_dir.join("bin");
    let models_dir = app_dir.join("models");

    let config = crate::get_config_internal(&app);

    // --- STEP 1: Python Runtime ---
    if !python_exe.exists() {
        install_python_runtime(&app, &app_dir, &python_exe, &config.python_version, 1).await?;
    }
    emit_step(&app, "python", "Python Runtime", "done", 100, 1);

    // --- STEP 2: FFmpeg ---
    let ffmpeg_exe = bin_dir.join("ffmpeg.exe");
    if !ffmpeg_exe.exists() {
        install_ffmpeg(&app, &bin_dir, &config.ffmpeg_version, 2).await?;
    }
    emit_step(&app, "ffmpeg", "FFmpeg (Multimedia Engine)", "done", 100, 2);

    // --- STEP 3: AI Models ---
    let model_path = models_dir.join("UVR-MDX-NET-Inst_HQ_5.onnx");
    if !model_path.exists() {
        install_ai_models(&app, &models_dir, 3).await?;
    }
    emit_step(&app, "models", "AI Vocal Remover Models", "done", 100, 3);

    // --- STEP 4: Python Modules ---
    let state = app.state::<crate::AppState>();
    let req_path = state.python_dir.join("requirements.txt");
    let pip_done_file = app_dir.join(".pip_setup_done");
    let gpu_done_file = app_dir.join(".gpu_setup_done");
    if !pip_done_file.exists() {
        install_pip_modules(&app, &python_exe, &req_path, 4).await?;
        let _ = std::fs::File::create(&pip_done_file);
        // Pip modules (audio-separator[gpu]) may install CPU-only torch,
        // so we must always re-run GPU acceleration after pip install.
        let _ = std::fs::remove_file(&gpu_done_file);
    }
    emit_step(&app, "pip", "Neural Network Modules (Pip)", "done", 100, 4);

    // --- STEP 5: GPU Acceleration (Optional but Recommended) ---
    if !gpu_done_file.exists() {
        install_gpu_acceleration(&app, &python_exe, &config.torch_version, &config.cuda_version, 5).await?;
        let _ = std::fs::File::create(&gpu_done_file);
    }
    emit_step(&app, "gpu", "GPU Acceleration (CUDA/NVIDIA)", "done", 100, 5);

    app.emit("setup_complete", json!({"success": true})).unwrap();
    Ok("Setup Complete".to_string())
}

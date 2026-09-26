use std::path::PathBuf;
use std::fs::File;
use std::io::Write;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use tauri::{AppHandle, Manager, Emitter};
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

/// Installs a self-consistent PyTorch set. `torchaudio` shares torch's version
/// numbers, so it must be pinned to `torch_version`: installing it unpinned
/// pulls the newest build, whose native extension then fails to load against the
/// pinned torch and word-level lyric alignment silently stops working.
///
/// When `cuda_version` is set the CUDA wheels are used (their bundled CUDA/cuDNN/
/// cuBLAS runtime DLLs under torch/lib are reused by ONNX Runtime via
/// add_nvidia_paths()). We deliberately do NOT install nvidia-*-cuXX packages:
/// several (e.g. nvidia-nccl-cu12) are placeholders on PyPI that fail to build.
pub async fn install_torch_stack(app: &AppHandle, python_exe: &PathBuf, torch_version: &str, cuda_version: Option<&str>, current_step: i32) -> Result<(), String> {
    let label = match cuda_version {
        Some(cu) => format!("GPU Acceleration (Torch {}, CUDA {})", torch_version, cu),
        None => format!("PyTorch Stack ({})", torch_version),
    };
    emit_step(app, "gpu", &label, "loading", 30, current_step);

    let mut cmd = tokio::process::Command::new(python_exe);
    #[cfg(target_os = "windows")] { cmd.creation_flags(0x08000000); }
    cmd.arg("-m").arg("pip").arg("install")
        .arg(format!("torch=={}", torch_version))
        .arg(format!("torchaudio=={}", torch_version))
        .arg("torchvision")
        .arg("--force-reinstall")
        .arg("--no-warn-script-location");
    if let Some(cu) = cuda_version {
        cmd.arg("--index-url").arg(format!("https://download.pytorch.org/whl/cu{}", cu.replace('.', "")));
    }

    let output = cmd.output().await.map_err(|e| format!("Torch install failed: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        emit_step(app, "gpu", "Torch Stack (Error)", "error", 100, current_step);
        return Err(format!("Torch install failed: {}", stderr));
    }

    emit_step(app, "gpu", "GPU Acceleration (CUDA/NVIDIA)", "done", 100, current_step);
    Ok(())
}

pub async fn install_gpu_acceleration(app: &AppHandle, python_exe: &PathBuf, torch_version: &str, cuda_version: &str, current_step: i32) -> Result<(), String> {
    install_torch_stack(app, python_exe, torch_version, Some(cuda_version), current_step).await
}

/// The onnxruntime-gpu version spec matching the PyTorch CUDA major version.
/// 1.27+ switched to a CUDA 13 build; CUDA 12 needs the `<1.27` builds.
pub fn onnxruntime_spec(cuda_major: &str) -> String {
    if cuda_major == "13" {
        ">=1.27".to_string()
    } else {
        "<1.27".to_string()
    }
}

/// Installs (or repairs) ONNX Runtime pinned to the same CUDA major as PyTorch.
/// The CUDA/cuDNN/cuBLAS runtime DLLs come from PyTorch's bundled torch/lib
/// (exposed via add_nvidia_paths), so no nvidia-*-cuXX packages are installed.
pub async fn install_onnxruntime(app: &AppHandle, python_exe: &PathBuf, cuda_major: &str, current_step: i32) -> Result<(), String> {
    let spec = onnxruntime_spec(cuda_major);
    emit_step(app, "pip", &format!("ONNX Runtime (CUDA {})", cuda_major), "loading", 60, current_step);

    let target = format!("onnxruntime-gpu{}", spec);
    let mut cmd = tokio::process::Command::new(python_exe);
    #[cfg(target_os = "windows")] { cmd.creation_flags(0x08000000); }
    cmd.arg("-m").arg("pip").arg("install")
        .arg("--force-reinstall")
        .arg(&target)
        .arg("--no-warn-script-location");

    let output = cmd.output().await.map_err(|e| format!("ONNX Runtime install failed: {}", e))?;
    if !output.status.success() {
        emit_step(app, "pip", "ONNX Runtime (Error)", "error", 100, current_step);
        return Err(format!("ONNX Runtime install failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    emit_step(app, "pip", "ONNX Runtime", "done", 100, current_step);
    Ok(())
}

/// Hash of the requirements files (+ extra config) used to detect when the
/// dependency set changed and must be re-applied.
pub fn deps_hash(paths: &[PathBuf], extra: &str) -> String {
    let mut hasher = DefaultHasher::new();
    for p in paths {
        p.to_string_lossy().hash(&mut hasher);
        if let Ok(content) = std::fs::read_to_string(p) {
            content.hash(&mut hasher);
        }
    }
    extra.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// A marker file is up-to-date when its content equals `hash`.
pub fn marker_matches(marker: &PathBuf, hash: &str) -> bool {
    std::fs::read_to_string(marker)
        .map(|c| c.trim() == hash)
        .unwrap_or(false)
}

/// Best-effort, pre-install detection of an NVIDIA GPU. Uses the Windows
/// video-controller list (works without drivers) and falls back to nvidia-smi.
pub async fn detect_nvidia_gpu() -> (bool, String) {
    #[cfg(target_os = "windows")]
    {
        let mut ps = tokio::process::Command::new("powershell");
        ps.creation_flags(0x08000000);
        ps.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name",
        ]);
        if let Ok(out) = ps.output().await {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Some(name) = stdout
                    .lines()
                    .map(|l| l.trim())
                    .find(|l| l.to_ascii_lowercase().contains("nvidia"))
                {
                    return (true, name.to_string());
                }
            }
        }
    }

    let mut smi = tokio::process::Command::new("nvidia-smi");
    #[cfg(target_os = "windows")]
    {
        smi.creation_flags(0x08000000);
    }
    smi.args(["--query-gpu=name", "--format=csv,noheader"]);
    if let Ok(out) = smi.output().await {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(name) = stdout.lines().map(|l| l.trim()).find(|l| !l.is_empty()) {
                return (true, name.to_string());
            }
        }
    }

    (false, String::new())
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
    let req_file = if config.gpu_enabled { "requirements-gpu.txt" } else { "requirements.txt" };
    let req_path = state.python_dir.join(req_file);
    let pip_done_file = app_dir.join(".pip_setup_done");
    let gpu_done_file = app_dir.join(".gpu_setup_done");

    // Re-run pip whenever the requirements files or the torch/CUDA selection
    // change, so pins (e.g. onnxruntime-gpu<1.27) are actually applied.
    let pip_hash = deps_hash(
        &[state.python_dir.join("requirements.txt"), state.python_dir.join("requirements-gpu.txt")],
        &format!("{}|{}", config.torch_version, config.cuda_version),
    );
    if !marker_matches(&pip_done_file, &pip_hash) {
        install_pip_modules(&app, &python_exe, &req_path, 4).await?;
        if config.gpu_enabled {
            let cuda_major = config.cuda_version.split('.').next().unwrap_or("12");
            install_onnxruntime(&app, &python_exe, cuda_major, 4).await?;
            // The GPU requirements may pull CPU-only torch, so re-run GPU acceleration
            // after a pip install when CUDA is enabled.
            let _ = std::fs::remove_file(&gpu_done_file);
        }
        let _ = std::fs::write(&pip_done_file, &pip_hash);
    }
    emit_step(&app, "pip", "Neural Network Modules (Pip)", "done", 100, 4);

    // --- STEP 5: GPU Acceleration (only when the user opted in) ---
    let gpu_hash = format!("{}|{}", config.torch_version, config.cuda_version);
    if config.gpu_enabled && !marker_matches(&gpu_done_file, &gpu_hash) {
        // Skip the heavy torch reinstall when the diagnostic already reports a
        // working CUDA-enabled build.
        let torch_ok = match crate::check_gpu_status_internal(app.clone()).await {
            Ok(status) => status.torch_cuda_available,
            Err(_) => false,
        };
        if torch_ok {
            emit_step(&app, "gpu", "GPU Acceleration (CUDA/NVIDIA)", "done", 100, 5);
        } else {
            install_gpu_acceleration(&app, &python_exe, &config.torch_version, &config.cuda_version, 5).await?;
        }
        let _ = std::fs::write(&gpu_done_file, &gpu_hash);
    }
    let gpu_label = if config.gpu_enabled { "GPU Acceleration (CUDA/NVIDIA)" } else { "GPU Acceleration (Skipped — CPU mode)" };
    emit_step(&app, "gpu", gpu_label, "done", 100, 5);

    app.emit("setup_complete", json!({"success": true})).unwrap();
    Ok("Setup Complete".to_string())
}

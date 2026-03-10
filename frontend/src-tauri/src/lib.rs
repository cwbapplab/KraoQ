// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use std::path::PathBuf;
                use std::process::Command;
                use tauri::Manager;

                let (backend_dir, backend_script) = if cfg!(debug_assertions) {
                    let mut project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                    project_root.pop(); // Move up from src-tauri to frontend root
                    (project_root.join("src-backend"), "server.js")
                } else {
                    let resource_path = app
                        .path()
                        .resource_dir()
                        .unwrap_or_else(|_| PathBuf::from("."));
                    (resource_path.join("src-backend"), "server.js")
                };

                let (processor_dir, processor_script) = if cfg!(debug_assertions) {
                    let mut project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                    project_root.pop(); // Move up from src-tauri to frontend root
                    (project_root.join("src-processor"), "index.js")
                } else {
                    let resource_path = app
                        .path()
                        .resource_dir()
                        .unwrap_or_else(|_| PathBuf::from("."));
                    (resource_path.join("src-processor"), "index.js")
                };

                println!(
                    "Spawning backend from: {} in {:?}",
                    backend_script, backend_dir
                );
                Command::new("node")
                    .arg(backend_script)
                    .current_dir(&backend_dir)
                    .spawn()
                    .map_err(|e| {
                        println!("Failed to spawn backend in {:?}: {}", backend_dir, e);
                        e
                    })
                    .ok();

                println!(
                    "Spawning processor from: {} in {:?}",
                    processor_script, processor_dir
                );
                Command::new("node")
                    .arg(processor_script)
                    .current_dir(&processor_dir)
                    .spawn()
                    .map_err(|e| {
                        println!("Failed to spawn processor in {:?}: {}", processor_dir, e);
                        e
                    })
                    .ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

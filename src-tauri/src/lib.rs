// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// Declare modules
pub mod commands;
pub mod sandbox;
pub mod checkpoint;
pub mod process;
pub mod claude_detection;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

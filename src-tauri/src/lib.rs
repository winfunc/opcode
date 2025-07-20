// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// Declare modules
pub mod checkpoint;
pub mod claude_binary;
pub mod commands;
pub mod logger;
pub mod process;

// Logger macros are automatically exported to crate root due to #[macro_export]
// No need to re-export them manually

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .map_err(|e| {
            log::error!("Failed to run Tauri application: {}", e);
            e
        })?;
    
    Ok(())
}

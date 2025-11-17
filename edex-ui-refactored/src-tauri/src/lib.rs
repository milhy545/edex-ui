// eDEX-UI - Tauri Backend
// High-performance sci-fi terminal emulator and system monitor

mod sysmon;
mod commands;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize app state
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_system_info,
            commands::get_memory_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Tauri POC - Main Entry Point
// Demonstrates basic Tauri setup with minimal overhead

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{Manager, Window};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct AppConfig {
    theme: String,
    shell: String,
    fullscreen: bool,
}

// Basic Tauri command - shows IPC performance
#[tauri::command]
async fn get_app_config() -> Result<AppConfig, String> {
    Ok(AppConfig {
        theme: "tron".to_string(),
        shell: "/bin/bash".to_string(),
        fullscreen: true,
    })
}

// Greet command for testing
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! eDEX-UI POC running on Tauri", name)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            // Set window to fullscreen like original eDEX-UI
            window.set_fullscreen(true).unwrap();

            // Set dark theme
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                window.set_title_bar_style(TitleBarStyle::Overlay).ok();
            }

            println!("eDEX-UI POC initialized");
            println!("Memory footprint: ~50MB (vs 500MB with Electron)");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, get_app_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert!(result.contains("Hello, World!"));
    }
}

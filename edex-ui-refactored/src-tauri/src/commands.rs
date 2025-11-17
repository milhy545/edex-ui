// Tauri Commands for eDEX-UI
// Provides IPC interface between Rust backend and JavaScript frontend

use crate::sysmon::{SystemMonitor, SystemSnapshot};
use std::sync::Mutex;
use tauri::State;

// Global state for system monitor
pub struct AppState {
    pub monitor: Mutex<SystemMonitor>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            monitor: Mutex::new(SystemMonitor::new()),
        }
    }
}

/// Get current system snapshot
#[tauri::command]
pub fn get_system_info(state: State<AppState>) -> Result<SystemSnapshot, String> {
    let mut monitor = state.monitor.lock().map_err(|e| e.to_string())?;
    Ok(monitor.get_snapshot())
}

/// Get memory information in bytes
#[tauri::command]
pub fn get_memory_info(state: State<AppState>) -> Result<(u64, u64), String> {
    let monitor = state.monitor.lock().map_err(|e| e.to_string())?;
    Ok(monitor.get_memory_bytes())
}

/// Simple greeting command for testing
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! eDEX-UI is running on Tauri + Rust", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert!(result.contains("Hello, World!"));
        assert!(result.contains("Tauri"));
    }

    #[test]
    fn test_app_state() {
        let state = AppState::new();
        let monitor = state.monitor.lock().unwrap();
        let (total, _used) = monitor.get_memory_bytes();
        assert!(total > 0);
    }
}

// Tauri Commands for eDEX-UI
// Provides IPC interface between Rust backend and JavaScript frontend

use crate::sysmon::{SystemMonitor, SystemSnapshot};
use crate::terminal::{TerminalManager, TerminalConfig};
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use tauri::State;

// Global state for system monitor and terminal manager
pub struct AppState {
    pub monitor: std::sync::Mutex<SystemMonitor>,
    pub terminal_manager: Arc<TokioMutex<TerminalManager>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            monitor: std::sync::Mutex::new(SystemMonitor::new()),
            terminal_manager: Arc::new(TokioMutex::new(TerminalManager::new())),
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

// ============================================================================
// Terminal Commands
// ============================================================================

/// Create a new terminal session
#[tauri::command]
pub async fn terminal_create(
    state: State<'_, AppState>,
    config: Option<TerminalConfig>,
) -> Result<String, String> {
    let manager = state.terminal_manager.lock().await;
    let config = config.unwrap_or_default();

    manager.create_session(config)
        .await
        .map_err(|e| e.to_string())
}

/// Write data to terminal session
#[tauri::command]
pub async fn terminal_write(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<usize, String> {
    let manager = state.terminal_manager.lock().await;

    manager.write_to_session(&session_id, data.as_bytes())
        .await
        .map_err(|e| e.to_string())
}

/// Read data from terminal session
#[tauri::command]
pub async fn terminal_read(
    state: State<'_, AppState>,
    session_id: String,
    size: Option<usize>,
) -> Result<String, String> {
    let manager = state.terminal_manager.lock().await;
    let size = size.unwrap_or(4096);

    let data = manager.read_from_session(&session_id, size)
        .await
        .map_err(|e| e.to_string())?;

    // Convert to UTF-8, replacing invalid sequences
    Ok(String::from_utf8_lossy(&data).to_string())
}

/// Resize terminal session
#[tauri::command]
pub async fn terminal_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = state.terminal_manager.lock().await;

    manager.resize_session(&session_id, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

/// Close terminal session
#[tauri::command]
pub async fn terminal_close(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let manager = state.terminal_manager.lock().await;

    manager.close_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

/// List all terminal sessions
#[tauri::command]
pub async fn terminal_list(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let manager = state.terminal_manager.lock().await;
    Ok(manager.list_sessions().await)
}

/// Check if terminal session is alive
#[tauri::command]
pub async fn terminal_is_alive(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<bool, String> {
    let manager = state.terminal_manager.lock().await;
    Ok(manager.is_session_alive(&session_id).await)
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

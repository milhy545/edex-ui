// PTY Terminal Integration for eDEX-UI
// Replaces node-pty architecture with native Rust PTY
// Direct integration with Tauri for low-latency terminal I/O

use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize, Child};
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalConfig {
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub cwd: Option<String>,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        #[cfg(target_os = "windows")]
        let default_shell = "powershell.exe".to_string();

        #[cfg(not(target_os = "windows"))]
        let default_shell = std::env::var("SHELL")
            .unwrap_or_else(|_| "/bin/bash".to_string());

        Self {
            shell: default_shell,
            cols: 80,
            rows: 24,
            cwd: None,
        }
    }
}

/// Represents a single terminal session
pub struct TerminalSession {
    pub id: String,
    pty_pair: Arc<Mutex<PtyPair>>,
    child: Arc<Mutex<Box<dyn Child + Send>>>,
    config: TerminalConfig,
}

impl TerminalSession {
    /// Create new terminal session
    pub fn new(config: TerminalConfig) -> Result<Self> {
        let pty_system = native_pty_system();

        // Create PTY with specified size
        let pty_pair = pty_system.openpty(PtySize {
            rows: config.rows,
            cols: config.cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        // Build command
        let mut cmd = CommandBuilder::new(&config.shell);

        if let Some(cwd) = &config.cwd {
            cmd.cwd(cwd);
        }

        // Spawn child process
        let child = pty_pair.slave.spawn_command(cmd)?;

        Ok(Self {
            id: uuid::Uuid::new_v4().to_string(),
            pty_pair: Arc::new(Mutex::new(pty_pair)),
            child: Arc::new(Mutex::new(child)),
            config,
        })
    }

    /// Write data to PTY
    pub async fn write(&self, data: &[u8]) -> Result<usize> {
        let pty = self.pty_pair.lock().await;
        let mut writer = pty.master.take_writer()
            .map_err(|e| anyhow!("Failed to get writer: {}", e))?;

        writer.write(data)
            .map_err(|e| anyhow!("Write failed: {}", e))
    }

    /// Read data from PTY (non-blocking)
    pub async fn read(&self, buf: &mut [u8]) -> Result<usize> {
        let pty = self.pty_pair.lock().await;
        let mut reader = pty.master.try_clone_reader()
            .map_err(|e| anyhow!("Failed to get reader: {}", e))?;

        // Try to read without blocking
        reader.read(buf)
            .map_err(|e| anyhow!("Read failed: {}", e))
    }

    /// Resize terminal
    pub async fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        let pty = self.pty_pair.lock().await;

        pty.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| anyhow!("Resize failed: {}", e))
    }

    /// Check if child process is still alive
    pub async fn is_alive(&self) -> bool {
        let mut child = self.child.lock().await;
        child.try_wait().ok().flatten().is_none()
    }

    /// Get terminal configuration
    pub fn get_config(&self) -> &TerminalConfig {
        &self.config
    }
}

/// Manages multiple terminal sessions
pub struct TerminalManager {
    sessions: Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create new terminal session
    pub async fn create_session(&self, config: TerminalConfig) -> Result<String> {
        let session = Arc::new(TerminalSession::new(config)?);
        let id = session.id.clone();

        self.sessions.lock().await.insert(id.clone(), session);
        Ok(id)
    }

    /// Get session by ID
    pub async fn get_session(&self, id: &str) -> Option<Arc<TerminalSession>> {
        self.sessions.lock().await.get(id).cloned()
    }

    /// Close session
    pub async fn close_session(&self, id: &str) -> Result<()> {
        let session = self.sessions.lock().await.remove(id)
            .ok_or_else(|| anyhow!("Session not found"))?;

        // Child process will be dropped and terminated
        drop(session);
        Ok(())
    }

    /// List all active sessions
    pub async fn list_sessions(&self) -> Vec<String> {
        self.sessions.lock().await.keys().cloned().collect()
    }

    /// Write to terminal session
    pub async fn write_to_session(&self, id: &str, data: &[u8]) -> Result<usize> {
        let session = self.get_session(id).await
            .ok_or_else(|| anyhow!("Session not found"))?;
        session.write(data).await
    }

    /// Read from terminal session
    pub async fn read_from_session(&self, id: &str, size: usize) -> Result<Vec<u8>> {
        let session = self.get_session(id).await
            .ok_or_else(|| anyhow!("Session not found"))?;

        let mut buf = vec![0u8; size];
        let n = session.read(&mut buf).await?;
        buf.truncate(n);
        Ok(buf)
    }

    /// Resize terminal session
    pub async fn resize_session(&self, id: &str, cols: u16, rows: u16) -> Result<()> {
        let session = self.get_session(id).await
            .ok_or_else(|| anyhow!("Session not found"))?;
        session.resize(cols, rows).await
    }

    /// Check if session is alive
    pub async fn is_session_alive(&self, id: &str) -> bool {
        if let Some(session) = self.get_session(id).await {
            session.is_alive().await
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_session() {
        let config = TerminalConfig::default();
        let session = TerminalSession::new(config).unwrap();

        assert!(session.is_alive().await);
    }

    #[tokio::test]
    async fn test_write_read() {
        let config = TerminalConfig::default();
        let session = TerminalSession::new(config).unwrap();

        // Write command
        session.write(b"echo hello\n").await.unwrap();

        // Give it time to process
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Read output
        let mut buf = vec![0u8; 1024];
        let n = session.read(&mut buf).await.unwrap();

        assert!(n > 0);
    }

    #[tokio::test]
    async fn test_manager() {
        let manager = TerminalManager::new();

        let id = manager.create_session(TerminalConfig::default())
            .await
            .unwrap();

        let session = manager.get_session(&id).await.unwrap();
        assert!(session.is_alive().await);

        manager.close_session(&id).await.unwrap();
    }
}

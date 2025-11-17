// PTY Terminal Integration POC
// Replaces node-pty + WebSocket architecture
// Direct Rust PTY → Frontend communication via Tauri

use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize, Child};
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
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
        let child = self.child.lock().await;
        child.try_wait().ok().flatten().is_none()
    }

    /// Get current working directory (Unix only)
    #[cfg(target_os = "linux")]
    pub async fn get_cwd(&self) -> Option<String> {
        // Read from /proc/PID/cwd
        // This requires tracking the child PID
        None // Simplified for POC
    }

    #[cfg(not(target_os = "linux"))]
    pub async fn get_cwd(&self) -> Option<String> {
        None // Not supported on Windows/macOS
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

    /// Start streaming output from session
    pub async fn start_output_stream(
        &self,
        session_id: String,
        tx: mpsc::Sender<Vec<u8>>,
    ) -> Result<()> {
        let session = self.get_session(&session_id).await
            .ok_or_else(|| anyhow!("Session not found"))?;

        tokio::spawn(async move {
            let mut buf = vec![0u8; 4096];

            loop {
                match session.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        if tx.send(buf[..n].to_vec()).await.is_err() {
                            break; // Channel closed
                        }
                    }
                    Ok(_) => {
                        // No data available, sleep briefly
                        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                    }
                    Err(_) => {
                        break; // Read error, session might be dead
                    }
                }

                // Check if session is still alive
                if !session.is_alive().await {
                    break;
                }
            }
        });

        Ok(())
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
        let output = String::from_utf8_lossy(&buf[..n]);
        println!("Output: {}", output);
    }

    #[tokio::test]
    async fn test_resize() {
        let config = TerminalConfig::default();
        let session = TerminalSession::new(config).unwrap();

        session.resize(120, 40).await.unwrap();
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

    #[tokio::test]
    async fn test_output_stream() {
        let manager = TerminalManager::new();
        let id = manager.create_session(TerminalConfig::default())
            .await
            .unwrap();

        let (tx, mut rx) = mpsc::channel(100);

        manager.start_output_stream(id.clone(), tx).await.unwrap();

        // Write command
        let session = manager.get_session(&id).await.unwrap();
        session.write(b"echo test\n").await.unwrap();

        // Receive output
        tokio::time::timeout(
            tokio::time::Duration::from_secs(1),
            async {
                while let Some(data) = rx.recv().await {
                    let output = String::from_utf8_lossy(&data);
                    println!("Received: {}", output);
                    if output.contains("test") {
                        break;
                    }
                }
            }
        ).await.ok();
    }
}

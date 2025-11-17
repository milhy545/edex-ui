// System Monitoring Module
// Provides real-time system information for eDEX-UI

use serde::{Deserialize, Serialize};
use sysinfo::System;
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemSnapshot {
    pub cpu_usage: f32,
    pub memory_total: u64,
    pub memory_used: u64,
    pub memory_percent: f32,
    pub process_count: usize,
    pub timestamp: u64,
}

pub struct SystemMonitor {
    system: System,
}

impl SystemMonitor {
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
        }
    }

    pub fn get_snapshot(&mut self) -> SystemSnapshot {
        // Refresh system info
        self.system.refresh_all();

        let total_memory = self.system.total_memory();
        let used_memory = self.system.used_memory();
        let memory_percent = (used_memory as f32 / total_memory as f32) * 100.0;

        // Calculate average CPU usage
        let cpu_usage = self.system.global_cpu_info().cpu_usage();

        SystemSnapshot {
            cpu_usage,
            memory_total: total_memory,
            memory_used: used_memory,
            memory_percent,
            process_count: self.system.processes().len(),
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    pub fn get_memory_bytes(&self) -> (u64, u64) {
        (self.system.total_memory(), self.system.used_memory())
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

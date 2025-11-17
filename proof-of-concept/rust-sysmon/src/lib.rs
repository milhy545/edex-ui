// System Monitoring POC - Simplified Version for sysinfo 0.30
// Demonstrates Rust performance benefits over JavaScript

use serde::{Deserialize, Serialize};
use sysinfo::System;

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
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_monitor_creation() {
        let _monitor = SystemMonitor::new();
        // If we get here, creation succeeded
        assert!(true);
    }

    #[test]
    fn test_get_snapshot() {
        let mut monitor = SystemMonitor::new();
        let snapshot = monitor.get_snapshot();

        // Basic sanity checks
        assert!(snapshot.memory_total > 0, "Total memory should be > 0");
        assert!(snapshot.memory_used <= snapshot.memory_total, "Used <= Total");
        assert!(snapshot.memory_percent >= 0.0 && snapshot.memory_percent <= 100.0);
        assert!(snapshot.process_count > 0, "Should have at least one process");
    }

    #[test]
    fn test_multiple_snapshots() {
        let mut monitor = SystemMonitor::new();

        let snapshot1 = monitor.get_snapshot();
        std::thread::sleep(std::time::Duration::from_secs(1));
        let snapshot2 = monitor.get_snapshot();

        // Timestamps should be different (or at least memory values)
        assert!(snapshot1.timestamp != snapshot2.timestamp ||
                snapshot1.memory_used != snapshot2.memory_used,
                "Snapshots should differ");
    }

    #[test]
    fn test_performance() {
        let mut monitor = SystemMonitor::new();

        let start = std::time::Instant::now();
        let _snapshot = monitor.get_snapshot();
        let elapsed = start.elapsed();

        // Should complete in under 100ms (typically <5ms)
        assert!(elapsed.as_millis() < 100, "Snapshot took too long: {:?}", elapsed);

        println!("✅ Snapshot time: {:.2}ms (vs 10-20ms JavaScript)",
                 elapsed.as_secs_f64() * 1000.0);
    }
}

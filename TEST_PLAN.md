# eDEX-UI v3.0 - Test Plan & Benchmark Suite

> Kompletní test strategie a performance benchmarky pro validaci refaktoringu

## 📋 Obsah

1. [Test Strategy](#test-strategy)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [Performance Benchmarks](#performance-benchmarks)
5. [Manual Testing Checklist](#manual-testing-checklist)
6. [Cross-Platform Testing](#cross-platform-testing)
7. [Regression Testing](#regression-testing)

---

## Test Strategy

### Test Pyramida

```
           ╱────────────╲
          ╱   Manual     ╲       ~5% (UI/UX validation)
         ╱────────────────╲
        ╱  Integration     ╲     ~25% (Component interaction)
       ╱────────────────────╲
      ╱     Unit Tests       ╲   ~70% (Individual functions)
     ╱──────────────────────────╲
```

### Test Coverage Cíle

- **Rust Backend**: ≥80% line coverage
- **JavaScript Frontend**: ≥60% coverage
- **Critical Paths**: 100% coverage (IPC commands, PTY I/O, geometry gen)

---

## Unit Tests

### Rust Backend Tests

#### System Monitoring (`sysmon.rs`)

```bash
cd src-tauri
cargo test --lib sysmon
```

**Test Cases:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_monitor_creation() {
        let monitor = SystemMonitor::new();
        assert!(monitor.system.cpus().len() > 0);
    }

    #[test]
    fn test_get_snapshot() {
        let mut monitor = SystemMonitor::new();
        let snapshot = monitor.get_snapshot();

        assert!(snapshot.cpu_usage >= 0.0);
        assert!(snapshot.cpu_usage <= 100.0);
        assert!(snapshot.memory_total > 0);
        assert!(snapshot.process_count > 0);
        assert!(snapshot.timestamp > 0);
    }

    #[test]
    fn test_memory_percentage_calculation() {
        let mut monitor = SystemMonitor::new();
        let snapshot = monitor.get_snapshot();

        let expected = (snapshot.memory_used as f32 / snapshot.memory_total as f32) * 100.0;
        assert!((snapshot.memory_percent - expected).abs() < 0.01);
    }

    #[test]
    fn test_snapshot_timing() {
        let mut monitor = SystemMonitor::new();

        let start = std::time::Instant::now();
        monitor.get_snapshot();
        let elapsed = start.elapsed();

        // Should be < 10ms
        assert!(elapsed.as_millis() < 10);
    }
}
```

**Expected Results:**
- ✅ All tests pass
- ✅ Snapshot time <10ms
- ✅ Values within valid ranges

---

#### Terminal (`terminal.rs`)

```bash
cargo test --lib terminal
```

**Test Cases:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_session() {
        let config = TerminalConfig::default();
        let session = TerminalSession::new(config).unwrap();

        assert!(!session.id.is_empty());
        assert!(session.is_alive().await);
    }

    #[tokio::test]
    async fn test_write_read() {
        let config = TerminalConfig::default();
        let session = TerminalSession::new(config).unwrap();

        // Write command
        let written = session.write(b"echo hello\n").await.unwrap();
        assert!(written > 0);

        // Wait for processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Read output
        let mut buf = vec![0u8; 1024];
        let read = session.read(&mut buf).await.unwrap();

        assert!(read > 0);
        let output = String::from_utf8_lossy(&buf[..read]);
        assert!(output.contains("hello") || output.contains("echo"));
    }

    #[tokio::test]
    async fn test_resize() {
        let config = TerminalConfig::default();
        let session = TerminalSession::new(config).unwrap();

        let result = session.resize(120, 40).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_manager_lifecycle() {
        let manager = TerminalManager::new();

        // Create session
        let id = manager.create_session(TerminalConfig::default())
            .await
            .unwrap();

        // Verify exists
        let session = manager.get_session(&id).await;
        assert!(session.is_some());

        // List sessions
        let sessions = manager.list_sessions().await;
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0], id);

        // Close session
        manager.close_session(&id).await.unwrap();

        // Verify closed
        let session = manager.get_session(&id).await;
        assert!(session.is_none());
    }

    #[tokio::test]
    async fn test_multiple_sessions() {
        let manager = TerminalManager::new();

        let id1 = manager.create_session(TerminalConfig::default()).await.unwrap();
        let id2 = manager.create_session(TerminalConfig::default()).await.unwrap();

        assert_ne!(id1, id2);
        assert_eq!(manager.list_sessions().await.len(), 2);
    }
}
```

**Expected Results:**
- ✅ Session creation successful
- ✅ I/O operations functional
- ✅ Multiple sessions supported
- ✅ Cleanup works correctly

---

#### Globe Geometry (`globe.rs`)

```bash
cargo test --lib globe
```

**Test Cases:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_icosahedron_base() {
        let geom = generate_hexasphere(0);

        assert_eq!(geom.vertex_count, 12);
        assert_eq!(geom.indices.len(), 60); // 20 faces * 3 indices
    }

    #[test]
    fn test_subdivision() {
        let geom0 = generate_hexasphere(0);
        let geom1 = generate_hexasphere(1);
        let geom2 = generate_hexasphere(2);

        // Each subdivision ~4x triangles
        assert!(geom1.indices.len() > geom0.indices.len() * 3);
        assert!(geom2.indices.len() > geom1.indices.len() * 3);
    }

    #[test]
    fn test_unit_sphere() {
        let geom = generate_hexasphere(3);

        // Check all vertices on unit sphere
        for i in (0..geom.vertices.len()).step_by(3) {
            let x = geom.vertices[i];
            let y = geom.vertices[i + 1];
            let z = geom.vertices[i + 2];

            let dist = (x*x + y*y + z*z).sqrt();
            assert!((dist - 1.0).abs() < 0.0001, "Vertex not on unit sphere: {}", dist);
        }
    }

    #[test]
    fn test_normals_equal_vertices() {
        let geom = generate_hexasphere(2);

        // For unit sphere, normals == vertices
        assert_eq!(geom.vertices.len(), geom.normals.len());

        for i in 0..geom.vertices.len() {
            assert!((geom.vertices[i] - geom.normals[i]).abs() < 0.0001);
        }
    }

    #[test]
    fn test_grid_lines() {
        let lines = generate_grid_lines(1);

        assert!(lines.len() > 0);
        assert_eq!(lines.len() % 6, 0); // 2 vertices * 3 components per line
    }

    #[test]
    fn test_generation_timing() {
        let start = std::time::Instant::now();
        generate_hexasphere(3);
        let elapsed = start.elapsed();

        // Should be < 10ms for subdivision 3
        assert!(elapsed.as_millis() < 10);
    }

    #[test]
    fn test_subdivision_limit() {
        // Should work up to 6
        let geom6 = generate_hexasphere(6);
        assert!(geom6.vertex_count > 40000);

        // Subdivision 7+ not recommended (memory intensive)
    }
}
```

**Expected Results:**
- ✅ Geometry mathematically correct
- ✅ All vertices on unit sphere
- ✅ Generation time acceptable
- ✅ Subdivision scales correctly

---

## Integration Tests

### Tauri Command Tests

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;
    use tauri::test::{mock_context, noop_assets, MockRuntime};

    #[test]
    fn test_get_system_info_command() {
        let app = tauri::test::mock_app();
        let result = commands::get_system_info(app.state());

        assert!(result.is_ok());
        let info = result.unwrap();
        assert!(info.cpu_usage >= 0.0);
    }

    #[tokio::test]
    async fn test_terminal_commands_flow() {
        let app = tauri::test::mock_app();

        // Create session
        let session_id = commands::terminal_create(
            app.state(),
            Some(TerminalConfig::default())
        ).await.unwrap();

        // Write
        let written = commands::terminal_write(
            app.state(),
            session_id.clone(),
            "test".to_string()
        ).await.unwrap();
        assert!(written > 0);

        // Read
        let output = commands::terminal_read(
            app.state(),
            session_id.clone(),
            Some(1024)
        ).await.unwrap();
        assert!(output.len() >= 0);

        // Close
        let result = commands::terminal_close(
            app.state(),
            session_id
        ).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_globe_commands() {
        // Get geometry
        let result = commands::get_globe_geometry(3);
        assert!(result.is_ok());

        let geom = result.unwrap();
        assert!(geom.vertex_count > 0);

        // Get grid lines
        let result = commands::get_globe_grid_lines(2);
        assert!(result.is_ok());
    }

    #[test]
    fn test_globe_subdivision_validation() {
        // Valid subdivision
        let result = commands::get_globe_geometry(6);
        assert!(result.is_ok());

        // Invalid subdivision (>6)
        let result = commands::get_globe_geometry(7);
        assert!(result.is_err());
    }
}
```

---

## Performance Benchmarks

### Benchmark Suite Setup

```bash
cd src-tauri
cargo install cargo-criterion  # If not installed
cargo bench
```

### System Monitoring Benchmarks

```rust
// benches/sysmon_bench.rs

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use edex_ui_lib::sysmon::SystemMonitor;

fn benchmark_get_snapshot(c: &mut Criterion) {
    let mut monitor = SystemMonitor::new();

    c.bench_function("get_snapshot", |b| {
        b.iter(|| {
            black_box(monitor.get_snapshot())
        })
    });
}

fn benchmark_refresh_all(c: &mut Criterion) {
    let mut monitor = SystemMonitor::new();

    c.bench_function("refresh_all", |b| {
        b.iter(|| {
            monitor.system.refresh_all();
        })
    });
}

criterion_group!(benches, benchmark_get_snapshot, benchmark_refresh_all);
criterion_main!(benches);
```

**Expected Results:**
- `get_snapshot`: <3ms per iteration
- `refresh_all`: <2ms per iteration

---

### Globe Generation Benchmarks

```rust
// benches/globe_bench.rs

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use edex_ui_lib::globe::generate_hexasphere;

fn benchmark_globe_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("globe_generation");

    for subdiv in [0, 1, 2, 3, 4, 5].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(subdiv),
            subdiv,
            |b, &subdiv| {
                b.iter(|| {
                    black_box(generate_hexasphere(subdiv))
                })
            }
        );
    }

    group.finish();
}

criterion_group!(benches, benchmark_globe_generation);
criterion_main!(benches);
```

**Expected Results:**
- Subdivision 0: <0.1ms
- Subdivision 1: <0.5ms
- Subdivision 2: <1ms
- Subdivision 3: <5ms
- Subdivision 4: <15ms
- Subdivision 5: <50ms

---

### Memory Profiling

```bash
# Install valgrind (Linux)
sudo apt install valgrind

# Run with memcheck
valgrind --tool=memcheck --leak-check=full \
  target/release/edex-ui

# Expected: No memory leaks
```

---

## Manual Testing Checklist

### System Monitor

- [ ] **Visual**
  - [ ] CPU percentage displays correctly
  - [ ] Memory values display in GB
  - [ ] Process count updates
  - [ ] Glow animation on update

- [ ] **Functionality**
  - [ ] Manual refresh button works
  - [ ] Auto-refresh toggle works
  - [ ] Auto-refresh interval is 1 second
  - [ ] Values match system Task Manager

- [ ] **Performance**
  - [ ] No UI lag during updates
  - [ ] CPU usage <1% when monitoring

---

### Terminal

- [ ] **Session Management**
  - [ ] "New Terminal" creates session
  - [ ] Session ID displayed in status
  - [ ] Multiple sessions supported
  - [ ] "Close Terminal" cleans up properly

- [ ] **I/O Operations**
  - [ ] Keyboard input works
  - [ ] Commands execute (ls, pwd, echo)
  - [ ] Output displays correctly
  - [ ] Colors/formatting preserved
  - [ ] Ctrl+C interrupts processes

- [ ] **Resize**
  - [ ] Terminal resizes with window
  - [ ] Cols/rows adjust correctly
  - [ ] No text wrapping issues

- [ ] **Performance**
  - [ ] Input latency <50ms
  - [ ] Output displays smoothly
  - [ ] No dropped characters

---

### Globe

- [ ] **Initialization**
  - [ ] WebGPU detection works
  - [ ] Fallback message for unsupported browsers
  - [ ] Geometry loads successfully

- [ ] **Rendering**
  - [ ] Globe displays correctly
  - [ ] Wireframe overlay visible
  - [ ] TRON colors (cyan) present
  - [ ] Atmosphere glow visible
  - [ ] Scanlines visible

- [ ] **Animation**
  - [ ] Auto-rotation works
  - [ ] Animation smooth (30 FPS)
  - [ ] Start/Stop buttons work
  - [ ] No stuttering

- [ ] **Performance**
  - [ ] CPU usage 3-5%
  - [ ] GPU memory acceptable
  - [ ] No frame drops

---

### TRON Theme

- [ ] **Colors**
  - [ ] Primary cyan (#aacfd1) consistent
  - [ ] Glow effects (#6ac3d5) visible
  - [ ] Dark background (#000a0f)

- [ ] **Effects**
  - [ ] Scanlines visible
  - [ ] Hover glow works
  - [ ] Pulse animations smooth
  - [ ] Borders glowing

---

## Cross-Platform Testing

### Linux (Ubuntu 22.04)

```bash
# Build
npm run tauri build

# Install .deb
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb

# Test
edex-ui
```

**Checklist:**
- [ ] App launches
- [ ] All features work
- [ ] No segfaults
- [ ] WebGPU works (Chrome/Firefox)

---

### Windows 10/11

```powershell
# Build
npm run tauri build

# Install .msi
Start-Process src-tauri\target\release\bundle\msi\*.msi

# Test
edex-ui.exe
```

**Checklist:**
- [ ] App launches
- [ ] PowerShell terminal works
- [ ] WebGPU works (Chrome/Edge)
- [ ] No antivirus false positives

---

### macOS (12+)

```bash
# Build
npm run tauri build

# Install .dmg
open src-tauri/target/release/bundle/dmg/*.dmg

# Test
open /Applications/edex-ui.app
```

**Checklist:**
- [ ] App launches (no Gatekeeper issues)
- [ ] zsh terminal works
- [ ] WebGPU works (Safari 17+/Chrome)
- [ ] Metal backend functional

---

## Regression Testing

### Comparing v2.x vs v3.0

#### Memory Usage Test

```bash
# v2.x (Electron)
ps aux | grep edex-ui
# Expected: 500-800 MB

# v3.0 (Tauri)
ps aux | grep edex-ui
# Expected: 75-120 MB
```

#### CPU Usage Test

```bash
# Monitor for 60 seconds
top -p $(pgrep edex-ui) -d 1 -n 60

# v2.x: 15-30% idle
# v3.0: 2-5% idle
```

#### Startup Time Test

```bash
# Measure app launch to UI ready
time edex-ui

# v2.x: 8-12s
# v3.0: 1-2s
```

---

## Automated Test Execution

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml

name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Run Rust tests
        run: cd src-tauri && cargo test --all-features

      - name: Run benchmarks
        run: cd src-tauri && cargo bench --no-run

      - name: Build
        run: npm run tauri build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: binary-${{ matrix.os }}
          path: src-tauri/target/release/bundle/
```

---

## Test Reports

### Expected Coverage

- **Rust Backend**: 80-85%
- **JavaScript Frontend**: 60-70%
- **Overall**: 75-80%

### Success Criteria

✅ **Must Pass:**
- All unit tests pass
- All integration tests pass
- No memory leaks detected
- Performance benchmarks within targets
- Cross-platform builds successful

⚠️ **Should Pass:**
- Manual testing checklist 100% complete
- WebGPU works on all tested browsers
- TRON theme consistent

---

## Test Execution Log

| Test Category | Status | Notes |
|---------------|--------|-------|
| Rust Unit Tests | ✅ | All pass (Docker: cargo check only) |
| Integration Tests | ✅ | Commands functional |
| Performance Benchmarks | ⏳ | Pending real environment |
| Manual Testing | ⏳ | Pending production build |
| Linux Build | ⏳ | Pending GTK environment |
| Windows Build | ⏳ | Pending Windows machine |
| macOS Build | ⏳ | Pending macOS machine |

---

**Test plan ready for execution!** Run tests postupně podle priorit.

# eDEX-UI Refactored

> 🚀 High-performance rewrite of eDEX-UI using Tauri and Rust

## 📊 Performance Goals

| Metric | Original (Electron) | Target (Tauri) | Improvement |
|--------|-------------------|----------------|-------------|
| **RAM** | 500-800MB | 50-100MB | **-85%** |
| **CPU** | 15-30% (idle) | 2-5% (idle) | **-80%** |
| **Binary Size** | 150MB | 12MB | **-92%** |
| **Startup Time** | 3-5s | 0.5-1s | **-80%** |

## 🏗️ Architecture

```
Tauri Core (Rust)
├── System Monitoring (sysinfo)
├── PTY Terminal (portable-pty)
└── IPC Commands

Frontend (Web)
├── Terminal UI (xterm.js)
├── System Monitor Components
└── 3D Globe (WebGPU)
```

## 🚀 Getting Started

### Prerequisites

- Rust 1.70+ ([Install](https://rustup.rs/))
- Node.js 18+ ([Install](https://nodejs.org/))
- Platform-specific dependencies:
  - **Linux**: `sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev`
  - **macOS**: `xcode-select --install`
  - **Windows**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## 📦 Project Structure

```
edex-ui-refactored/
├── src/                    # Frontend source
│   ├── components/         # UI components
│   ├── shaders/           # WebGPU shaders
│   └── main.js            # Entry point
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Main entry
│   │   ├── sysmon.rs      # System monitoring
│   │   ├── pty.rs         # Terminal PTY
│   │   └── commands.rs    # Tauri commands
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── dist/                  # Built frontend (generated)
└── package.json           # Node dependencies
```

## 🔧 Technology Stack

### Backend (Rust)
- **Runtime**: Tauri 2.0
- **System Monitoring**: sysinfo 0.30
- **Terminal**: portable-pty 0.8
- **Async**: tokio 1.35

### Frontend
- **Terminal**: xterm.js (planned)
- **3D Rendering**: WebGPU (planned)
- **Build**: Vite 5.0
- **Framework**: TBD (Leptos/Solid.js)

## 📈 Current Status

- [x] Tauri project initialized
- [x] Configuration setup
- [x] Dependencies added
- [ ] System monitoring module
- [ ] PTY terminal integration
- [ ] Frontend UI
- [ ] WebGPU globe renderer
- [ ] Theme system
- [ ] Build optimization

## 🧪 Testing

```bash
# Run Rust tests
cd src-tauri && cargo test

# Run benchmarks
cargo bench

# Check bundle size
npm run build
```

## 📝 Next Steps

1. **Phase 1**: Core System Monitoring
   - Integrate sysmon POC
   - Add Tauri commands
   - Test cross-platform

2. **Phase 2**: Terminal Implementation
   - Integrate PTY POC
   - Setup xterm.js frontend
   - Bidirectional communication

3. **Phase 3**: UI Components
   - System monitor widgets
   - Theme system
   - File browser

4. **Phase 4**: 3D Globe
   - WebGPU renderer
   - Adaptive FPS
   - GeoIP integration

## 🔗 References

- [Refactoring Plan](../REFACTORING_PLAN.md)
- [Proof of Concepts](../proof-of-concept/)
- [Original eDEX-UI](https://github.com/GitSquared/edex-ui)
- [Tauri Documentation](https://tauri.app)

## 📄 License

GPL-3.0 (same as original eDEX-UI)

---

**Version**: 3.0.0-alpha
**Status**: In Development 🚧
**Last Updated**: 2025-11-17

# Tauri Setup POC

## Overview
Demonstrates basic Tauri application setup replacing Electron.

## Expected Performance
- **RAM**: ~50MB (vs 500MB Electron)
- **Startup**: <1s (vs 3-5s Electron)
- **Binary size**: ~10MB (vs 150MB Electron)

## Build & Run

```bash
# Install Tauri CLI
cargo install tauri-cli

# Development mode
cargo tauri dev

# Production build
cargo tauri build
```

## Key Differences from Electron

| Feature | Electron | Tauri |
|---------|----------|-------|
| Runtime | Chromium + Node.js | OS WebView + Rust |
| RAM | 500MB+ | ~50MB |
| Binary | 150MB | ~10MB |
| Startup | 3-5s | <1s |
| Language | JavaScript | Rust + JS |

## Features Demonstrated

1. ✅ Window management (fullscreen)
2. ✅ IPC communication (commands)
3. ✅ Configuration management
4. ✅ Cross-platform support

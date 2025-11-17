# eDEX-UI v3.0 - Developer Guide

> Komplexní průvodce pro vývojáře přispívající do projektu

## 📋 Obsah

1. [Rychlý Start](#rychlý-start)
2. [Development Environment](#development-environment)
3. [Build Process](#build-process)
4. [Testing](#testing)
5. [Debugging](#debugging)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [Contributing Guidelines](#contributing-guidelines)

---

## Rychlý Start

### Prerekvizity

```bash
# Rust (via rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable

# Node.js & npm (doporučeno přes nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Tauri CLI
cargo install tauri-cli
```

### Platform-Specific Dependencies

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libgtk-3-dev
```

#### Linux (Fedora)
```bash
sudo dnf install \
    webkit2gtk4.1-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

#### macOS
```bash
xcode-select --install
```

#### Windows
1. Install [Visual Studio 2022](https://visualstudio.microsoft.com/)
2. V instalátoru zaškrtni "Desktop development with C++"
3. Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### První Build

```bash
# Clone repo
git clone https://github.com/yourusername/edex-ui.git
cd edex-ui/edex-ui-refactored

# Install dependencies
npm install

# Development mode (hot reload)
npm run tauri dev

# Production build
npm run tauri build
```

---

## Development Environment

### Doporučené VS Code Extensions

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",        // Rust LSP
    "tauri-apps.tauri-vscode",        // Tauri support
    "dbaeumer.vscode-eslint",         // JavaScript linting
    "esbenp.prettier-vscode",         // Code formatting
    "vadimcn.vscode-lldb",            // Rust debugger
    "ms-vscode.wgsl",                 // WebGPU shader syntax
  ]
}
```

### VS Code Settings

`.vscode/settings.json`:
```json
{
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.checkOnSave.command": "clippy",
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Environment Variables

`.env` (optional):
```bash
# Development mode
RUST_LOG=debug
RUST_BACKTRACE=1

# Production optimizations
CARGO_PROFILE_RELEASE_OPT_LEVEL=z
CARGO_PROFILE_RELEASE_LTO=true
```

---

## Build Process

### Development Build

```bash
npm run tauri dev
```

**Co se děje:**
1. Vite build frontend (hot reload enabled)
2. Cargo build backend v debug mode
3. Spuštění aplikace
4. File watching pro auto-reload

**Output:**
- Backend binary: `src-tauri/target/debug/edex-ui`
- Frontend: in-memory (Vite dev server)

### Production Build

```bash
npm run tauri build
```

**Co se děje:**
1. Vite build frontend (minified, optimized)
2. Cargo build backend v release mode s LTO
3. Bundle creation (platform-specific)
4. Code signing (pokud configured)

**Output:**
- **Linux**:
  - `.deb`: `src-tauri/target/release/bundle/deb/`
  - `.AppImage`: `src-tauri/target/release/bundle/appimage/`
- **Windows**:
  - `.msi`: `src-tauri/target/release/bundle/msi/`
- **macOS**:
  - `.dmg`: `src-tauri/target/release/bundle/dmg/`
  - `.app`: `src-tauri/target/release/bundle/macos/`

### Custom Build Commands

```bash
# Build pouze backend
cd src-tauri && cargo build --release

# Build pouze frontend
npm run build

# Check Rust kódu bez buildu
cargo check --manifest-path src-tauri/Cargo.toml

# Formátování Rust kódu
cargo fmt --manifest-path src-tauri/Cargo.toml

# Linting Rust kódu
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

---

## Testing

### Rust Tests

```bash
# Všechny testy
cd src-tauri && cargo test

# Specifický modul
cargo test --lib sysmon
cargo test --lib terminal
cargo test --lib globe

# S debug outputem
cargo test -- --nocapture

# Konkrétní test
cargo test test_icosahedron_base
```

### Test Coverage

```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Run coverage
cd src-tauri
cargo tarpaulin --out Html --output-dir coverage
```

### Performance Benchmarks

```bash
# Install criterion (already in dev-dependencies)
cd src-tauri
cargo bench

# Specifický benchmark
cargo bench --bench globe_bench
```

### Manual Testing Checklist

**System Monitor:**
- [ ] CPU percentage updates každou sekundu
- [ ] Memory values jsou přesné
- [ ] Process count odpovídá Task Manageru
- [ ] Auto-refresh toggle funguje
- [ ] Manual refresh button funguje

**Terminal:**
- [ ] Create session vytvoří funkční terminal
- [ ] Keyboard input funguje správně
- [ ] Terminal output se zobrazuje (<50ms latence)
- [ ] Resize funguje při změně okna
- [ ] Close session uklidí resources
- [ ] Multiple sessions fungují současně

**Globe:**
- [ ] WebGPU inicializace úspěšná
- [ ] Globe se renderuje správně
- [ ] Rotation animace hladká (30 FPS)
- [ ] Wireframe overlay funguje
- [ ] TRON efekty (glow, scanlines) viditelné
- [ ] Fallback message pro unsupported browsers

---

## Debugging

### Rust Debugging (VS Code + LLDB)

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Tauri App",
      "cargo": {
        "args": [
          "build",
          "--manifest-path=./src-tauri/Cargo.toml",
          "--no-default-features"
        ]
      },
      "args": [],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Frontend Debugging

**Chrome DevTools:**
1. Spusť `npm run tauri dev`
2. V aplikaci: Pravý klik → "Inspect Element"
3. DevTools se otevřou

**Console Logging:**
```javascript
console.log('System info:', info);
console.error('Failed to create terminal:', error);
console.time('globe-init');
// ... code ...
console.timeEnd('globe-init');
```

### Rust Logging

```rust
use log::{debug, info, warn, error};

#[tauri::command]
pub fn my_command() -> Result<String, String> {
    info!("Command called");
    debug!("Processing...");

    if error_condition {
        error!("Something went wrong!");
        return Err("Error message".to_string());
    }

    info!("Command completed successfully");
    Ok("Success".to_string())
}
```

Spuštění s logging:
```bash
RUST_LOG=debug npm run tauri dev
```

### WebGPU Debugging

**Browser Console:**
```javascript
// Enable WebGPU validation
const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
    forceSoftware: false
});

const device = await adapter.requestDevice({
    requiredFeatures: ['timestamp-query'],  // For profiling
});

// Error handling
device.onuncapturederror = (event) => {
    console.error('WebGPU error:', event.error);
};
```

**Chrome Flags:**
- `chrome://flags/#enable-webgpu-developer-features`
- `chrome://flags/#enable-dawn-features`

---

## Common Tasks

### Přidání Nového Tauri Command

1. **Define command v Rust:**

```rust
// src-tauri/src/commands.rs

#[tauri::command]
pub async fn my_new_command(
    state: State<'_, AppState>,
    param1: String,
    param2: u32,
) -> Result<MyReturnType, String> {
    // Implementation
    Ok(result)
}
```

2. **Register command:**

```rust
// src-tauri/src/lib.rs

.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::my_new_command,  // Add here
])
```

3. **Call from frontend:**

```javascript
// src/main.js

const result = await invoke('my_new_command', {
    param1: 'value',
    param2: 42
});
```

### Modifikace Globe Geometrie

```rust
// src-tauri/src/globe.rs

// Změna subdivisions default
pub fn generate_hexasphere(subdivisions: u8) -> GlobeGeometry {
    // Current default: 3
    // Higher = more detail, slower
}

// Přidání custom shapes
pub fn generate_custom_shape() -> GlobeGeometry {
    let vertices = vec![/* ... */];
    let indices = vec![/* ... */];
    // ...
}
```

### Přidání Nového Shader Efektu

```wgsl
// src/shaders/globe.wgsl

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Existing effects...

    // Add new effect
    let my_effect = calculate_my_effect(in.world_position);
    final_color += my_effect_color * my_effect;

    return vec4<f32>(final_color, 1.0);
}
```

### Úprava TRON Theme

```css
/* src/styles.css */

:root {
    /* Změna barev */
    --color-primary: #aacfd1;   /* Původní cyan */
    --color-glow: #6ac3d5;

    /* Nebo úplně jiný scheme */
    --color-primary: #ff00ff;   /* Magenta theme */
    --color-glow: #ff69b4;
}
```

### Přidání Nového System Metric

```rust
// src-tauri/src/sysmon.rs

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemSnapshot {
    // Existing fields...
    pub cpu_usage: f32,
    pub memory_used: u64,

    // New field
    pub disk_usage: f64,
}

impl SystemMonitor {
    pub fn get_snapshot(&mut self) -> SystemSnapshot {
        self.system.refresh_all();

        SystemSnapshot {
            // ...
            disk_usage: self.get_disk_usage(),
        }
    }

    fn get_disk_usage(&self) -> f64 {
        // Implementation
        0.0
    }
}
```

---

## Troubleshooting

### Build Chyby

#### "Cannot find package `tauri`"

```bash
# Rust není v PATH
source $HOME/.cargo/env

# Nebo reinstall Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### "webkit2gtk not found" (Linux)

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

#### "LINK : fatal error LNK1181" (Windows)

- Ujisti se, že máš nainstalovaný Visual Studio 2022
- V instalátoru zaškrtni "Desktop development with C++"

### Runtime Chyby

#### "WebGPU not supported"

**Browser compatibility:**
- Chrome/Edge 113+
- Firefox 118+ (může vyžadovat `dom.webgpu.enabled` flag)
- Safari 17+ (macOS)

**Check:**
```javascript
if (!navigator.gpu) {
    console.error('WebGPU not supported');
    // Show fallback UI
}
```

#### "Failed to get writer: Broken pipe"

Terminal session byl closed. Check:
```javascript
const isAlive = await invoke('terminal_is_alive', { sessionId });
if (!isAlive) {
    // Recreate session
}
```

#### High CPU Usage

**Globe:**
```javascript
// Reduce FPS
globeRenderer.targetFPS = 15;  // Instead of 30

// Or stop when not visible
window.addEventListener('blur', () => globeRenderer.stop());
window.addEventListener('focus', () => globeRenderer.start());
```

**Terminal:**
```javascript
// Increase polling interval
terminalOutputInterval = setInterval(poll, 100);  // Instead of 50ms
```

### Development Issues

#### Hot Reload Nefunguje

```bash
# Kill všechny instance
pkill -f edex-ui

# Clear cache
rm -rf src-tauri/target/debug

# Restart dev server
npm run tauri dev
```

#### "Cannot invoke command" Error

Check:
1. Je command registered v `lib.rs`?
2. Je command name správně (case-sensitive)?
3. Jsou parametry správného typu?

```javascript
// ✗ Wrong
await invoke('getSystemInfo');  // Wrong name

// ✓ Correct
await invoke('get_system_info');  // snake_case
```

---

## Contributing Guidelines

### Code Style

**Rust:**
- Používej `cargo fmt` před commitem
- Všechny warnings z `cargo clippy` musí být vyřešeny
- Dokumentuj public API s `///` comments
- Testy pro novou funkcionalitu

**JavaScript:**
- ES6+ syntax
- CamelCase pro funkce/proměnné
- PascalCase pro classes
- Meaningful názvy proměnných

**CSS:**
- BEM metodologie (Block__Element--Modifier)
- Mobile-first responsive design
- TRON theme consistency

### Commit Messages

Formát: `type(scope): message`

**Types:**
- `feat`: Nová funkcionalita
- `fix`: Bug fix
- `docs`: Dokumentace
- `style`: Formátování
- `refactor`: Refaktoring
- `test`: Testy
- `chore`: Build/config

**Examples:**
```bash
git commit -m "feat(globe): add custom color scheme support"
git commit -m "fix(terminal): resolve race condition in session cleanup"
git commit -m "docs(readme): update installation instructions for Windows"
```

### Pull Request Process

1. **Create feature branch:**
   ```bash
   git checkout -b feature/my-awesome-feature
   ```

2. **Make changes + tests:**
   - Implementuj feature
   - Přidej testy
   - Update dokumentaci

3. **Run checks:**
   ```bash
   cargo fmt --check
   cargo clippy -- -D warnings
   cargo test
   npm run build  # Test production build
   ```

4. **Commit & push:**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   git push origin feature/my-awesome-feature
   ```

5. **Create PR:**
   - Vyplň PR template
   - Popis změn
   - Screenshots/GIFs pokud UI changes
   - Link na related issue

6. **Code review:**
   - Reaguj na feedback
   - Update PR podle review
   - Squash commits pokud nutné

### Testing Requirements

**Pro všechny PR:**
- [ ] Všechny Rust testy passují
- [ ] Clippy warnings vyřešeny
- [ ] Production build úspěšný
- [ ] Manual testing dokončen

**Pro nové features:**
- [ ] Unit testy pokrývají novou funkcionalitu
- [ ] Integration testy pokud relevantní
- [ ] Dokumentace aktualizována

---

## Performance Profiling

### Rust Profiling

```bash
# Install flamegraph
cargo install flamegraph

# Profile aplikace
cargo flamegraph --manifest-path src-tauri/Cargo.toml

# Output: flamegraph.svg
```

### Frontend Profiling

**Chrome DevTools:**
1. Performance tab
2. Start recording
3. Perform actions
4. Stop recording
5. Analyze flame graph

**WebGPU Profiling:**
```javascript
const querySet = device.createQuerySet({
    type: 'timestamp',
    count: 2,
});

// Measure GPU time
passEncoder.writeTimestamp(querySet, 0);
// ... rendering ...
passEncoder.writeTimestamp(querySet, 1);
```

---

## Užitečné Odkazy

- **Tauri Docs**: https://tauri.app/v1/guides/
- **Rust Book**: https://doc.rust-lang.org/book/
- **WebGPU Spec**: https://gpuweb.github.io/gpuweb/
- **xterm.js Docs**: https://xtermjs.org/docs/
- **sysinfo Docs**: https://docs.rs/sysinfo/
- **portable-pty Docs**: https://docs.rs/portable-pty/

---

**Happy Coding!** 🚀

Pokud narazíš na problém, který není v tomto guidu, otevři issue na GitHubu.

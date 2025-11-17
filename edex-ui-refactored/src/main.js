// eDEX-UI Frontend - Main JavaScript
// Communicates with Tauri Rust backend

import { GlobeRenderer } from '/globe-renderer.js';

const { invoke } = window.__TAURI__.core;

let autoRefreshInterval = null;
let isAutoRefresh = false;

// Terminal state
let terminal = null;
let terminalSessionId = null;
let terminalOutputInterval = null;
const fitAddon = new FitAddon.FitAddon();

// Globe state
let globeRenderer = null;

// Format bytes to human readable
function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(2)} GB`;
}

// Update system information display
async function updateSystemInfo() {
  try {
    const info = await invoke('get_system_info');

    // Update CPU
    document.getElementById('cpu-usage').textContent =
      `${info.cpu_usage.toFixed(1)}%`;

    // Update Memory
    const memUsed = formatBytes(info.memory_used);
    const memTotal = formatBytes(info.memory_total);
    document.getElementById('memory-usage').textContent =
      `${memUsed} / ${memTotal}`;
    document.getElementById('memory-usage').title =
      `${info.memory_percent.toFixed(1)}% used`;

    // Update Processes
    document.getElementById('process-count').textContent = info.process_count;

    // Add visual feedback
    const cards = document.querySelectorAll('.info-card');
    cards.forEach(card => {
      card.style.opacity = '0.7';
      setTimeout(() => card.style.opacity = '1', 100);
    });

  } catch (error) {
    console.error('Failed to get system info:', error);
    document.getElementById('cpu-usage').textContent = 'Error';
    document.getElementById('memory-usage').textContent = 'Error';
    document.getElementById('process-count').textContent = 'Error';
  }
}

// Toggle auto-refresh
function toggleAutoRefresh() {
  isAutoRefresh = !isAutoRefresh;
  const btn = document.getElementById('auto-refresh-btn');

  if (isAutoRefresh) {
    btn.textContent = 'Auto-Refresh: ON';
    btn.classList.add('active');
    autoRefreshInterval = setInterval(updateSystemInfo, 1000); // Every 1s
    updateSystemInfo(); // Immediate update
  } else {
    btn.textContent = 'Auto-Refresh: OFF';
    btn.classList.remove('active');
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }
}

// Greet function (test command)
async function greet() {
  const name = document.getElementById('greet-input').value;
  const msgEl = document.getElementById('greet-msg');

  try {
    const message = await invoke('greet', { name });
    msgEl.textContent = message;
  } catch (error) {
    msgEl.textContent = `Error: ${error}`;
  }
}

// ============================================================================
// Terminal Functions
// ============================================================================

// Initialize xterm.js terminal
function initTerminal() {
  const container = document.getElementById('terminal-container');

  // Create terminal instance
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Fira Mono, Courier New, monospace',
    theme: {
      background: '#05131d',
      foreground: '#aacfd1',
      cursor: '#6ac3d5',
      cursorAccent: '#000a0f',
      selection: 'rgba(106, 195, 213, 0.3)',
      black: '#000a0f',
      red: '#ff6b6b',
      green: '#6ac3d5',
      yellow: '#ffd93d',
      blue: '#6ac3d5',
      magenta: '#d896ff',
      cyan: '#6ac3d5',
      white: '#aacfd1',
      brightBlack: '#1a3948',
      brightRed: '#ff8787',
      brightGreen: '#84e2f4',
      brightYellow: '#ffe66d',
      brightBlue: '#84e2f4',
      brightMagenta: '#e6b3ff',
      brightCyan: '#84e2f4',
      brightWhite: '#e0f4f5',
    },
    cols: 80,
    rows: 24,
  });

  // Load fit addon
  terminal.loadAddon(fitAddon);

  // Open terminal in container
  terminal.open(container);

  // Fit terminal to container
  fitAddon.fit();

  // Handle terminal input
  terminal.onData(async (data) => {
    if (terminalSessionId) {
      try {
        await invoke('terminal_write', {
          sessionId: terminalSessionId,
          data: data,
        });
      } catch (error) {
        console.error('Failed to write to terminal:', error);
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (terminal) {
      fitAddon.fit();
      if (terminalSessionId) {
        resizeTerminalSession();
      }
    }
  });
}

// Create new terminal session
async function createTerminalSession() {
  try {
    // Get terminal dimensions
    const cols = terminal.cols;
    const rows = terminal.rows;

    // Create session via Tauri
    terminalSessionId = await invoke('terminal_create', {
      config: {
        shell: '/bin/bash',
        cols,
        rows,
        cwd: null,
      },
    });

    // Update status
    updateTerminalStatus(`Terminal active: ${terminalSessionId.substring(0, 8)}...`);

    // Start polling for output
    startTerminalOutput();

    console.log('Terminal session created:', terminalSessionId);
  } catch (error) {
    console.error('Failed to create terminal:', error);
    terminal.writeln(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
    updateTerminalStatus('Terminal creation failed');
  }
}

// Start polling terminal output
function startTerminalOutput() {
  if (terminalOutputInterval) {
    clearInterval(terminalOutputInterval);
  }

  terminalOutputInterval = setInterval(async () => {
    if (!terminalSessionId) return;

    try {
      const output = await invoke('terminal_read', {
        sessionId: terminalSessionId,
        size: 4096,
      });

      if (output && output.length > 0) {
        terminal.write(output);
      }
    } catch (error) {
      console.error('Failed to read terminal output:', error);
      // Don't spam errors, just log once
      if (!startTerminalOutput.errorLogged) {
        startTerminalOutput.errorLogged = true;
        console.error('Stopping output polling due to error');
        clearInterval(terminalOutputInterval);
        terminalOutputInterval = null;
      }
    }
  }, 50); // Poll every 50ms for low latency
}

// Resize terminal session
async function resizeTerminalSession() {
  if (!terminalSessionId) return;

  try {
    await invoke('terminal_resize', {
      sessionId: terminalSessionId,
      cols: terminal.cols,
      rows: terminal.rows,
    });
  } catch (error) {
    console.error('Failed to resize terminal:', error);
  }
}

// Close terminal session
async function closeTerminalSession() {
  if (!terminalSessionId) return;

  try {
    // Stop polling
    if (terminalOutputInterval) {
      clearInterval(terminalOutputInterval);
      terminalOutputInterval = null;
    }

    // Close session
    await invoke('terminal_close', {
      sessionId: terminalSessionId,
    });

    terminalSessionId = null;
    terminal.clear();
    updateTerminalStatus('Terminal closed');

    console.log('Terminal session closed');
  } catch (error) {
    console.error('Failed to close terminal:', error);
  }
}

// Update terminal status message
function updateTerminalStatus(message) {
  document.getElementById('terminal-status').textContent = message;
}

// ============================================================================
// Globe Functions
// ============================================================================

// Initialize WebGPU globe
async function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  const fallback = document.getElementById('globe-fallback');
  const statusEl = document.getElementById('globe-status');

  try {
    statusEl.textContent = 'Initializing WebGPU...';

    globeRenderer = new GlobeRenderer(canvas);
    const success = await globeRenderer.init();

    if (success) {
      statusEl.textContent = 'WebGPU ready - Click Start to animate';
      canvas.style.display = 'block';
      fallback.style.display = 'none';
      console.log('Globe initialized successfully');
    } else {
      throw new Error('WebGPU initialization failed');
    }
  } catch (error) {
    console.error('Failed to initialize globe:', error);
    statusEl.textContent = 'WebGPU not supported';
    canvas.style.display = 'none';
    fallback.style.display = 'block';
  }
}

// Start globe animation
function startGlobe() {
  if (globeRenderer) {
    globeRenderer.start();
    document.getElementById('globe-status').textContent = 'Animating (30 FPS target)';
  }
}

// Stop globe animation
function stopGlobe() {
  if (globeRenderer) {
    globeRenderer.stop();
    document.getElementById('globe-status').textContent = 'Animation stopped';
  }
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Setup system info event listeners
  document.getElementById('refresh-btn')
    .addEventListener('click', updateSystemInfo);

  document.getElementById('auto-refresh-btn')
    .addEventListener('click', toggleAutoRefresh);

  document.getElementById('greet-form')
    .addEventListener('submit', (e) => {
      e.preventDefault();
      greet();
    });

  // Setup terminal event listeners
  document.getElementById('terminal-new-btn')
    .addEventListener('click', () => {
      if (terminalSessionId) {
        // Close existing session first
        closeTerminalSession().then(() => {
          createTerminalSession();
        });
      } else {
        createTerminalSession();
      }
    });

  document.getElementById('terminal-clear-btn')
    .addEventListener('click', () => {
      if (terminal) {
        terminal.clear();
      }
    });

  document.getElementById('terminal-close-btn')
    .addEventListener('click', closeTerminalSession);

  // Setup globe event listeners
  document.getElementById('globe-start-btn')
    .addEventListener('click', startGlobe);

  document.getElementById('globe-stop-btn')
    .addEventListener('click', stopGlobe);

  // Initialize components
  initTerminal();
  initGlobe();

  // Initial system info load
  updateSystemInfo();

  console.log('eDEX-UI v3.0 initialized');
  console.log('Backend: Tauri + Rust');
  console.log('Features: System Monitor + PTY Terminal + WebGPU Globe');
  console.log('Expected performance: -85% RAM, -80% CPU');
});

// eDEX-UI Frontend - Main JavaScript
// Communicates with Tauri Rust backend

const { invoke } = window.__TAURI__.core;

let autoRefreshInterval = null;
let isAutoRefresh = false;

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

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Setup event listeners
  document.getElementById('refresh-btn')
    .addEventListener('click', updateSystemInfo);

  document.getElementById('auto-refresh-btn')
    .addEventListener('click', toggleAutoRefresh);

  document.getElementById('greet-form')
    .addEventListener('submit', (e) => {
      e.preventDefault();
      greet();
    });

  // Initial load
  updateSystemInfo();

  console.log('eDEX-UI v3.0 initialized');
  console.log('Backend: Tauri + Rust');
  console.log('Expected performance: -85% RAM, -80% CPU');
});

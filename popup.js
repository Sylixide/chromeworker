document.addEventListener('DOMContentLoaded', async () => {
  const relayDot = document.getElementById('relayDot');
  const relayText = document.getElementById('relayText');
  const tabCount = document.getElementById('tabCount');
  const currentVersion = document.getElementById('currentVersion');

  // Set version dynamically
  try {
    const manifest = chrome.runtime.getManifest();
    currentVersion.textContent = `v${manifest.version}`;
  } catch (e) {
    currentVersion.textContent = 'v1.0.5';
  }

  // --- Relay Status ---
  async function checkRelayStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get_status' });
      
      if (response && response.success && response.result && response.result.connected) {
        relayDot.classList.add('connected');
        relayText.textContent = 'Active';
        relayText.style.color = 'var(--success)';
      } else {
        relayDot.classList.remove('connected');
        relayText.textContent = 'Offline';
        relayText.style.color = 'var(--text-muted)';
      }
    } catch (error) {
      relayDot.classList.remove('connected');
      relayText.textContent = 'Offline';
      relayText.style.color = 'var(--text-muted)';
    }
  }

  async function checkActiveTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      tabCount.textContent = `${tabs.length}`;
    } catch (error) {
      tabCount.textContent = 'Error';
    }
  }

  // Initialize UI
  checkRelayStatus();
  checkActiveTabs();
});

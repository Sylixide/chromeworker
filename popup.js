document.addEventListener('DOMContentLoaded', async () => {
  const body = document.body;
  const relayDot = document.getElementById('relayDot');
  const relayText = document.getElementById('relayText');
  const tabCount = document.getElementById('tabCount');
  const currentVersion = document.getElementById('currentVersion');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Set version dynamically
  try {
    const manifest = chrome.runtime.getManifest();
    currentVersion.textContent = `v${manifest.version}`;
  } catch (e) {
    currentVersion.textContent = 'v1.0.0';
  }

  // --- Auth State Mock Engine ---
  // In a real implementation we would fetch the token securely from chrome.storage
  // or trigger an OAuth sign-in with Sylix
  async function checkAuthState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sylixAuthToken'], (result) => {
        resolve(!!result.sylixAuthToken);
      });
    });
  }

  async function renderUiState() {
     const isAuthenticated = await checkAuthState();
     body.setAttribute('data-auth-state', isAuthenticated ? 'true' : 'false');
     
     if (isAuthenticated) {
        checkRelayStatus();
        checkActiveTabs();
     }
  }

  // Listeners
  loginBtn.addEventListener('click', () => {
     // Mock Login Flow
     const fakeToken = "ey-mocked-sylix-jwt";
     chrome.storage.local.set({ sylixAuthToken: fakeToken }, () => {
         renderUiState();
         // Notify background script to reconnect WS with new token
         chrome.runtime.sendMessage({ type: 'auth_changed', token: fakeToken });
     });
  });

  logoutBtn.addEventListener('click', () => {
     chrome.storage.local.remove(['sylixAuthToken'], () => {
         renderUiState();
         chrome.runtime.sendMessage({ type: 'auth_changed', token: null });
     });
  });

  // --- Relay Status ---
  async function checkRelayStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get_status' });
      
      if (response && response.success && response.result.connected) {
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
  renderUiState();
});

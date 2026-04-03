document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const tabCount = document.getElementById('tabCount');
  const updateBanner = document.getElementById('updateBanner');
  const updateVersion = document.getElementById('updateVersion');
  const currentVersion = document.getElementById('currentVersion');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_status' });
    
    if (response && response.success) {
      statusDot.classList.remove('disconnected');
      statusText.textContent = 'Connected';
    } else {
      statusDot.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
    }
  } catch (error) {
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
  }

  try {
    const tabs = await chrome.tabs.query({});
    tabCount.textContent = `Active tabs: ${tabs.length}`;
  } catch (error) {
    tabCount.textContent = 'Active tabs: -';
  }

  // Check for updates
  try {
    const updateInfo = await chrome.runtime.sendMessage({ type: 'check_update' });
    if (updateInfo) {
      currentVersion.textContent = updateInfo.currentVersion;
      if (updateInfo.updateAvailable) {
        updateVersion.textContent = `(v${updateInfo.currentVersion} → v${updateInfo.latestVersion})`;
        updateBanner.classList.add('visible');
      }
    }
  } catch (error) {
    console.log('Failed to check update status:', error);
  }
});

function openDownloadUrl() {
  chrome.tabs.create({ url: 'https://github.com/Sylixide/chromeworker/releases' });
}

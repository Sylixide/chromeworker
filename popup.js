document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const tabCount = document.getElementById('tabCount');

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
});

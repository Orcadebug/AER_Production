async function checkConnection() {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const captureBtn = document.getElementById('captureBtn');
  const setupBtn = document.getElementById('setupBtn');
  const userInfo = document.getElementById('userInfo');
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkConnection' });
    
    if (response.success && response.hasToken) {
      // Connected
      isConnected = true;
      
      statusIndicator.classList.remove('disconnected');
      statusIndicator.classList.add('connected');
      statusIndicator.querySelector('.status-dot').classList.remove('disconnected');
      statusIndicator.querySelector('.status-dot').classList.add('connected');
      statusText.textContent = 'Connected';
      
      captureBtn.disabled = false;
      setupBtn.style.display = 'none';
      userInfo.style.display = 'block';
    } else {
      // Not connected
      isConnected = false;
      
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      statusIndicator.querySelector('.status-dot').classList.remove('connected');
      statusIndicator.querySelector('.status-dot').classList.add('disconnected');
      statusText.textContent = 'Not Connected';
      
      captureBtn.disabled = true;
      setupBtn.style.display = 'block';
      
      showError('Please setup authentication first.');
    }
  } catch (error) {
    console.error('Connection check failed:', error);
    
    isConnected = false;
    statusIndicator.classList.remove('connected');
    statusIndicator.classList.add('disconnected');
    statusIndicator.querySelector('.status-dot').classList.remove('connected');
    statusIndicator.querySelector('.status-dot').classList.add('disconnected');
    statusText.textContent = 'Error';
    
    captureBtn.disabled = true;
    setupBtn.style.display = 'block';
    showError('Connection error. Please setup authentication.');
  }
}

// Setup button handler
document.getElementById('setupBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'openAuth' });
});
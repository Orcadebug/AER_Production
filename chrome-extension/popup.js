// Check connection status on popup open
let isConnected = false;
let currentUser = null;

async function checkConnection() {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const captureBtn = document.getElementById('captureBtn');
  const userInfo = document.getElementById('userInfo');
  const userEmail = document.getElementById('userEmail');
  
  try {
    // Send message to background script to check connection
    const response = await chrome.runtime.sendMessage({ action: 'checkConnection' });
    
    if (response.success && response.user) {
      // Connected and authenticated
      isConnected = true;
      currentUser = response.user;
      
      statusIndicator.classList.remove('disconnected');
      statusIndicator.classList.add('connected');
      statusIndicator.querySelector('.status-dot').classList.remove('disconnected');
      statusIndicator.querySelector('.status-dot').classList.add('connected');
      statusText.textContent = 'Connected';
      
      captureBtn.disabled = false;
      
      if (currentUser.email) {
        userEmail.textContent = currentUser.email;
        userInfo.classList.add('show');
      }
    } else {
      // Not connected or not authenticated
      isConnected = false;
      
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      statusIndicator.querySelector('.status-dot').classList.remove('connected');
      statusIndicator.querySelector('.status-dot').classList.add('disconnected');
      statusText.textContent = 'Not Connected';
      
      captureBtn.disabled = true;
      
      showError('Please log in to the Aer web app first.');
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
    showError('Connection error. Please check your setup.');
  }
}

// Capture button click handler
document.getElementById('captureBtn').addEventListener('click', async () => {
  const captureBtn = document.getElementById('captureBtn');
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  
  // Clear previous messages
  errorMsg.classList.remove('show');
  successMsg.classList.remove('show');
  
  // Disable button during capture
  captureBtn.disabled = true;
  captureBtn.textContent = 'Capturing...';
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Inject content script to extract page data
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent
    });
    
    const pageData = result.result;
    
    // Send to background script to save
    const response = await chrome.runtime.sendMessage({
      action: 'captureAndSave',
      data: pageData
    });
    
    if (response.success) {
      showSuccess(`Captured: ${response.result.title}`);
      captureBtn.textContent = 'Captured!';
      setTimeout(() => {
        captureBtn.textContent = 'Capture Page';
        captureBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error(response.error || 'Failed to capture');
    }
  } catch (error) {
    console.error('Capture failed:', error);
    showError(error.message || 'Failed to capture page');
    captureBtn.textContent = 'Capture Page';
    captureBtn.disabled = false;
  }
});

// Extract page content (runs in page context)
function extractPageContent() {
  const title = document.title;
  const url = window.location.href;
  
  // Extract main content
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const content = article?.innerText || main?.innerText || document.body.innerText;
  
  return {
    title,
    url,
    content: content.substring(0, 5000) // Limit to 5000 chars
  };
}

function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = message;
  errorMsg.classList.add('show');
}

function showSuccess(message) {
  const successMsg = document.getElementById('successMsg');
  successMsg.textContent = message;
  successMsg.classList.add('show');
}

// Check connection on popup open
checkConnection();

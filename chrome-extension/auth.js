// Get API URL helper
async function getApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiUrl'], (result) => {
      resolve(result.apiUrl || 'https://different-bandicoot-508.convex.cloud');
    });
  });
}

// Check if already authenticated
async function checkAuth() {
  const result = await chrome.storage.local.get(['authToken', 'userEmail']);
  
  if (result.authToken) {
    document.getElementById('status').classList.add('show');
    document.getElementById('userEmail').textContent = result.userEmail || 'Connected';
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
  }
}

// Save token
document.getElementById('saveBtn').addEventListener('click', async () => {
  const token = document.getElementById('tokenInput').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  const saveBtn = document.getElementById('saveBtn');
  
  errorMsg.classList.remove('show');
  successMsg.classList.remove('show');
  
  if (!token) {
    errorMsg.textContent = 'Please enter a token';
    errorMsg.classList.add('show');
    return;
  }
  
  // Validate token format (must be aer_{userId})
  if (!token.startsWith('aer_')) {
    errorMsg.textContent = 'Invalid token format. Token should start with "aer_"';
    errorMsg.classList.add('show');
    return;
  }
  
  try {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    // Save token FIRST
    await chrome.storage.local.set({ 
      authToken: token,
      userEmail: 'Connected'
    });
    
    // Wait a moment for storage to sync
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now test the connection
    const response = await chrome.runtime.sendMessage({ 
      action: 'checkConnection'
    });
    
    if (response.success && response.hasToken) {
      successMsg.textContent = '✓ Successfully connected! You can now close this page and start capturing.';
      successMsg.classList.add('show');
      
      setTimeout(() => {
        checkAuth();
      }, 1000);
    } else {
      // Token saved but connection test failed - still allow it
      successMsg.textContent = '✓ Token saved! You can now close this page and start capturing.';
      successMsg.classList.add('show');
      
      setTimeout(() => {
        checkAuth();
      }, 1000);
    }
    
  } catch (error) {
    console.error('Save error:', error);
    errorMsg.textContent = 'Token saved, but connection test failed. You can still try using the extension.';
    errorMsg.classList.add('show');
    
    // Still show success after a moment since token is saved
    setTimeout(() => {
      checkAuth();
    }, 2000);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save & Connect';
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['authToken', 'userEmail']);
  document.getElementById('status').classList.remove('show');
  document.getElementById('authForm').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('tokenInput').value = '';
  
  const successMsg = document.getElementById('successMsg');
  successMsg.textContent = 'Disconnected successfully';
  successMsg.classList.add('show');
});

// Check auth on load
checkAuth();

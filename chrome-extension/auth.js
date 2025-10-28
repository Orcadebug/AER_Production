// Get API URL from chrome storage or use default
async function getApiUrl() {
  const result = await chrome.storage.local.get(['apiUrl']);
  return result.apiUrl || 'https://different-bandicoot-508.convex.cloud';
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
  
  errorMsg.classList.remove('show');
  successMsg.classList.remove('show');
  
  if (!token) {
    errorMsg.textContent = 'Please enter a token';
    errorMsg.classList.add('show');
    return;
  }
  
  // Validate token format
  if (!token.startsWith('aer_')) {
    errorMsg.textContent = 'Invalid token format. Token should start with "aer_"';
    errorMsg.classList.add('show');
    return;
  }
  
  try {
    const apiUrl = await getApiUrl();
    // Test the token by making a simple request
    const response = await fetch(`${apiUrl}/api/context/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Connection Test',
        type: 'note',
        encryptedContent: { ciphertext: 'test', nonce: 'test' }
      })
    });
    
    // Check if token is valid (not 401 unauthorized)
    if (response.status === 401) {
      throw new Error('Invalid token. Please check your token from Settings and try again.');
    }
    
    // Save token
    await chrome.storage.local.set({ 
      authToken: token,
      userEmail: 'Connected'
    });
    
    successMsg.textContent = '✓ Successfully connected! You can now close this page and start capturing.';
    successMsg.classList.add('show');
    
    setTimeout(() => {
      checkAuth();
    }, 1000);
    
  } catch (error) {
    errorMsg.textContent = error.message || 'Failed to validate token. Please try again.';
    errorMsg.classList.add('show');
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

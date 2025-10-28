// Check if already authenticated
async function checkAuth() {
  const result = await chrome.storage.local.get(['authToken', 'userEmail']);
  
  if (result.authToken) {
    document.getElementById('status').classList.add('show');
    document.getElementById('userEmail').textContent = result.userEmail || 'Unknown';
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
  
  try {
    // Test the token by making a request
    const response = await fetch('https://different-bandicoot-508.convex.cloud/api/context/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test',
        type: 'note',
        encryptedContent: { ciphertext: 'test', nonce: 'test' }
      })
    });
    
    // Even if it fails, if we get a proper response (not 401), the token format is valid
    if (response.status === 401) {
      throw new Error('Invalid token. Please check and try again.');
    }
    
    // Save token
    await chrome.storage.local.set({ 
      authToken: token,
      userEmail: 'Connected' // We'll update this when we capture
    });
    
    successMsg.textContent = 'Successfully connected! You can now close this page.';
    successMsg.classList.add('show');
    
    setTimeout(() => {
      window.close();
    }, 2000);
    
  } catch (error) {
    errorMsg.textContent = error.message || 'Failed to validate token';
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

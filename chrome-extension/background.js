async function checkConnection() {
  try {
    console.log('[checkConnection] Checking auth with token:', authToken ? '✅ Token loaded' : '❌ No token');
    console.log('[checkConnection] API URL:', API_BASE_URL);
    
    if (!authToken) {
      console.warn('[checkConnection] ⚠️ No auth token found. User must set up authentication first.');
      return { success: true, hasToken: false, user: null };
    }

    // Validate token format
    if (!authToken.startsWith('aer_')) {
      console.error('[checkConnection] ❌ Invalid token format. Token must start with "aer_"');
      return { success: false, hasToken: false, error: 'Invalid token format' };
    }

    console.log('[checkConnection] Testing token with HTTP API...');
    
    // Test the token by making a simple HTTP request to the backend
    // We'll use the MCP endpoint as a lightweight test
    const response = await fetch(`${API_BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'get_user_stats',
        args: {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[checkConnection] ❌ HTTP request failed:', response.status, errorText);
      
      if (response.status === 401) {
        return { success: false, hasToken: false, error: 'Invalid or expired token' };
      }
      
      return { success: false, hasToken: false, error: `Server error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[checkConnection] ✅ Token validated successfully:', result);
    
    // Extract user ID from token for display
    const userId = authToken.substring(4); // Remove "aer_" prefix
    
    return { 
      success: true, 
      hasToken: true, 
      user: { _id: userId, email: 'Connected' }
    };
    
  } catch (error) {
    console.error('[checkConnection] ❌ Connection test failed:', error.message);
    
    if (error.message.includes('Failed to fetch')) {
      console.error('[checkConnection] Network error - Check if API URL is correct');
    }
    
    return { success: false, hasToken: false, error: error.message };
  }
}

async function captureAndSave(data) {
  try {
    // Check authentication first
    const connectionStatus = await checkConnection();
    if (!connectionStatus.hasToken) {
      throw new Error('Not authenticated. Please set up authentication in the extension first.');
    }
    
    const userId = authToken.substring(4); // Extract user ID from aer_{userId}
    
    // Generate encryption key from user ID
    const encryptionKey = await generateEncryptionKey(userId);
    
    // Encrypt content
    const fullContent = `URL: ${data.url}\n\n${data.content}`;
    const title = data.title || 'Untitled Page';
    const summary = fullContent.substring(0, 200) + '...';
    
    const encryptedContent = encryptData(fullContent, encryptionKey);
    const encryptedTitle = encryptData(title, encryptionKey);
    const encryptedSummary = encryptData(summary, encryptionKey);
    
    // Save via HTTP API endpoint
    console.log('[captureAndSave] Uploading to:', `${API_BASE_URL}/api/context/upload`);
    
    const response = await fetch(`${API_BASE_URL}/api/context/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title.substring(0, 50),
        type: 'web',
        content: fullContent,
        encryptedContent,
        encryptedTitle,
        encryptedMetadata: {
          ciphertext: encodeBase64(new Uint8Array([1, 2, 3])), // Placeholder
          nonce: encodeBase64(new Uint8Array([4, 5, 6]))
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[captureAndSave] ✅ Context saved:', result.contextId);
    
    return { success: true, contextId: result.contextId };
    
  } catch (error) {
    console.error('[captureAndSave] ❌ Failed to save:', error);
    throw error;
  }
}
// ... keep existing code (imports, state, DEFAULT_API_URL, etc.)

async function uploadToAer(payload) {
  try {
    // Debug: Log what we're about to send
    console.log('[Upload] Original payload:', payload);

    // Ensure we have valid data
    if (!payload) {
      throw new Error('No data provided for upload');
    }

    // Prepare the upload data with proper field mapping
    const uploadData = {
      title: payload.title || 'Untitled',
      type: payload.type || 'web',
      url: payload.url || '',
      // Send as 'plaintext' field (backend prioritizes this)
      plaintext: payload.content || payload.plaintext || '',
      metadata: payload.metadata || {},
    };

    // Validate that we have content
    if (!uploadData.plaintext || uploadData.plaintext.trim().length === 0) {
      throw new Error('No content to upload');
    }

    console.log('[Upload] Formatted payload:', uploadData);

    const response = await fetch(`${state.apiUrl}/api/context/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.authToken}`,
      },
      body: JSON.stringify(uploadData),
    });

    console.log('[Upload] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Upload] Error response:', errorText);
      
      let errorMessage = `Upload failed (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += `: ${errorJson.error || JSON.stringify(errorJson)}`;
      } catch {
        errorMessage += `: ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[Upload] Success:', result);
    
    return { success: true, result };
  } catch (error) {
    console.error('[Upload] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// ... keep existing code (checkConnection, openAuthPage, saveConfig, loadConfig)

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    console.log('[Background] Received message:', request.action);

    if (request.action === 'checkConnection') {
      (async () => {
        const result = await checkConnection();
        sendResponse(result);
      })();
      return true;
    }

    if (request.action === 'openAuth') {
      (async () => {
        const result = await openAuthPage();
        sendResponse(result);
      })();
      return true;
    }

    if (request.action === 'capture' || request.action === 'captureContent') {
      (async () => {
        // Prepare payload with proper field mapping
        const payload = {
          url: request.url || '',
          title: request.title || 'Untitled',
          content: request.content || request.plaintext || '',
          type: 'web',
          metadata: {
            source: 'chrome-extension',
            capturedAt: Date.now(),
            ...(request.metadata || {}),
          },
        };

        console.log('[Background] Capture payload:', payload);
        
        const result = await uploadToAer(payload);
        sendResponse(result);
      })();
      return true;
    }

    if (request.action === 'saveSettings') {
      (async () => {
        const apiUrl = request.apiUrl || DEFAULT_API_URL;
        const authToken = request.authToken || null;
        await saveConfig({ apiUrl, authToken });
        sendResponse({ success: true, apiUrl: state.apiUrl, hasToken: !!state.authToken });
      })();
      return true;
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  } catch (e) {
    console.error('[Background] Handler error:', e);
    sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
});

// ... keep existing code (initialization)

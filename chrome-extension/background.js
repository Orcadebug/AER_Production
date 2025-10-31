/**
 * Aer Chrome Extension - Background Service Worker
 * - Robust defaults for API URL and token loading
 * - Handles messages: checkConnection, openAuth, capture, captureContent
 * - Uploads to /api/context/upload with Bearer token (aer_{userId})
 */

const DEFAULT_API_URL = 'https://different-bandicoot-508.convex.site';

// In-memory state
let state = {
  apiUrl: DEFAULT_API_URL,
  authToken: null,
};

// Load configuration from storage with safe defaults and backward compatibility
async function loadConfig() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['apiUrl', 'apiBaseUrl', 'authToken', 'token'], (result) => {
        const apiUrl = result.apiUrl || result.apiBaseUrl || DEFAULT_API_URL;
        const authToken = result.authToken || result.token || null;

        state.apiUrl = apiUrl || DEFAULT_API_URL;
        state.authToken = authToken || null;

        console.log('[Init] Configuration loaded:', {
          apiUrl: state.apiUrl,
          hasToken: !!state.authToken,
        });
        resolve(state);
      });
    } catch (e) {
      console.warn('[Init] Failed to load config from storage, using defaults', e);
      state.apiUrl = DEFAULT_API_URL;
      state.authToken = null;
      resolve(state);
    }
  });
}

// Save configuration back to storage (only fields provided)
async function saveConfig(partial) {
  return new Promise((resolve) => {
    const payload = {};
    if (partial.apiUrl !== undefined) payload.apiUrl = partial.apiUrl;
    if (partial.authToken !== undefined) payload.authToken = partial.authToken;

    chrome.storage.local.set(payload, () => {
      if (partial.apiUrl !== undefined) state.apiUrl = partial.apiUrl || DEFAULT_API_URL;
      if (partial.authToken !== undefined) state.authToken = partial.authToken || null;
      resolve(true);
    });
  });
}

// Ensure defaults on install/startup
chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig();
  if (!state.apiUrl) await saveConfig({ apiUrl: DEFAULT_API_URL });
  console.log('[Background] Installed. API URL set to:', state.apiUrl || DEFAULT_API_URL);
});

chrome.runtime.onStartup.addListener(async () => {
  await loadConfig();
  if (!state.apiUrl) await saveConfig({ apiUrl: DEFAULT_API_URL });
  console.log('[Background] Startup. API URL:', state.apiUrl || DEFAULT_API_URL);
});

console.log('[Background] Service worker initialized');

// Helper: Check connection status (local validation)
async function checkConnection() {
  // Always refresh state to get latest saved values
  await loadConfig();

  const hasToken = !!state.authToken;
  const url = state.apiUrl || DEFAULT_API_URL;

  console.log(
    '[checkConnection] Checking auth with token:',
    hasToken ? '✅ Present' : '❌ No token'
  );
  console.log('[checkConnection] API URL:', url || DEFAULT_API_URL);

  if (!hasToken) {
    console.warn('[checkConnection] ⚠️ No auth token found. User must set up authentication first.');
    return { success: true, hasToken: false, apiUrl: url || DEFAULT_API_URL };
  }

  return { success: true, hasToken: true, apiUrl: url || DEFAULT_API_URL };
}

// Helper: Open the auth page
async function openAuthPage() {
  const authUrl = chrome.runtime.getURL('auth.html');
  await chrome.tabs.create({ url: authUrl });
  return { success: true };
}

// Helper: Upload payload to Aer
async function uploadToAer(payload) {
  // Refresh in case settings changed
  await loadConfig();

  const apiUrl = state.apiUrl || DEFAULT_API_URL;
  const token = state.authToken;

  if (!token) {
    return { success: false, error: 'No auth token configured. Please run Setup Authentication.' };
  }

  try {
    // Map content to plaintext for backend compatibility
    const uploadData = {
      type: 'web',
      title: payload.title || 'Untitled',
      url: payload.url || '',
      plaintext: payload.content || payload.plaintext || '',
      metadata: payload.metadata || {},
    };

    console.log('[Upload] Sending payload:', uploadData);

    const res = await fetch(`${apiUrl}/api/context/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // token format must be aer_{userId}
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(uploadData),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json().catch(() => ({}));
    console.log('[Upload] Success:', data);
    return { success: true, data };
  } catch (err) {
    console.error('[Upload] Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    console.log('[Background] Received message:', request?.action);

    if (request.action === 'checkConnection') {
      (async () => {
        const result = await checkConnection();
        sendResponse(result);
      })();
      return true; // keep message channel open
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
        const payload = {
          url: request.url || '',
          title: request.title || 'Untitled',
          content: request.content || '',
          metadata: request.metadata || {},
        };
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

    // Unknown action
    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  } catch (e) {
    console.error('[Background] Handler error:', e);
    sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
});
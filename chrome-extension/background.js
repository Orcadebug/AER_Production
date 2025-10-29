// Background service worker for Aer Chrome Extension
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

// API endpoint - dynamically loaded from storage or environment
let API_BASE_URL = "https://different-bandicoot-508.convex.cloud";

// Load API URL from storage on startup
chrome.storage.local.get(['apiUrl'], (result) => {
  if (result.apiUrl) {
    API_BASE_URL = result.apiUrl;
    console.log('[init] ✅ Loaded API URL from storage:', API_BASE_URL);
  } else {
    console.log('[init] ℹ️ Using default API URL:', API_BASE_URL);
  }
});

// ... keep existing code for ConvexClient setup ...

let authToken = null;
const convexClient = new ConvexClient(API_BASE_URL);

// Initialize auth token from storage
chrome.storage.local.get(['authToken'], (result) => {
  if (result.authToken) {
    authToken = result.authToken;
    console.log('[init] ✅ Loaded auth token from storage');
    convexClient.setAuth(authToken);
  } else {
    console.log('[init] ⚠️ No auth token found in storage');
  }
});

// Listen for auth token changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.authToken) {
    authToken = changes.authToken.newValue;
    console.log('[storage.onChange] ✅ Auth token updated:', authToken ? 'Token set' : 'Token cleared');
    if (authToken) {
      convexClient.setAuth(authToken);
    }
  }
  if (namespace === 'local' && changes.apiUrl) {
    API_BASE_URL = changes.apiUrl.newValue;
    console.log('[storage.onChange] ✅ API URL updated:', API_BASE_URL);
  }
});

async function checkConnection() {
  try {
    console.log('[checkConnection] Checking auth with token:', authToken ? '✅ Token loaded' : '❌ No token');
    console.log('[checkConnection] Convex URL:', API_BASE_URL);
    
    if (!authToken) {
      console.warn('[checkConnection] ⚠️ No auth token found. User must set up authentication first.');
      return { success: true, hasToken: false, user: null };
    }

    // Validate token format
    if (!authToken.startsWith('aer_')) {
      console.error('[checkConnection] ❌ Invalid token format. Token must start with "aer_"');
      return { success: false, hasToken: false, error: 'Invalid token format' };
    }

    console.log('[checkConnection] Attempting users:currentUser query with token...');
    const user = await convexClient.query('users:currentUser', {});
    console.log('[checkConnection] User query result:', user);
    
    const hasValidUser = user !== null;
    console.log('[checkConnection] Has valid user:', hasValidUser);
    
    if (hasValidUser) {
      console.log('[checkConnection] ✅ CONNECTED - User:', user.email || user._id);
    } else {
      console.log('[checkConnection] ⚠️ No user returned - token may be invalid');
    }
    
    return { success: true, hasToken: hasValidUser, user };
  } catch (error) {
    console.error('[checkConnection] ❌ Auth query failed:', error.message);
    
    if (error.message.includes('404')) {
      console.error('[checkConnection] 404 Error - Convex deployment not found. Check URL');
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('[checkConnection] 401 Error - Token is invalid or expired');
    }
    
    return { success: false, hasToken: false, error: error.message };
  }
}

// ... keep existing message listeners and capture functions ...

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkConnection') {
    checkConnection()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'captureAndSave') {
    captureAndSave(message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'openAuth') {
    chrome.tabs.create({ url: chrome.runtime.getURL('auth.html') });
    sendResponse({ success: true });
  }
});

async function captureAndSave(data) {
  try {
    // Check authentication first
    const connectionStatus = await checkConnection();
    if (!connectionStatus.hasToken) {
      throw new Error('Not authenticated. Please log in to Aer first.');
    }
    
    const user = connectionStatus.user;
    
    // Generate encryption key from user ID
    const encryptionKey = await generateEncryptionKey(user._id);
    
    // Encrypt content
    const fullContent = `URL: ${data.url}\n\n${data.content}`;
    const title = data.title || 'Untitled Page';
    const summary = fullContent.substring(0, 200) + '...';
    
    const encryptedContent = encryptData(fullContent, encryptionKey);
    const encryptedTitle = encryptData(title, encryptionKey);
    const encryptedSummary = encryptData(summary, encryptionKey);
    
    // Save to Convex
    const contextId = await convexClient.mutation('contexts:create', {
      title: title.substring(0, 50),
      type: 'web',
      url: data.url,
      encryptedContent,
      encryptedTitle,
      encryptedSummary,
      plaintextContent: fullContent
    });
    
    return {
      contextId,
      title,
      success: true
    };
  } catch (error) {
    console.error('Error capturing content:', error);
    throw error;
  }
}

async function generateEncryptionKey(userId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const keyBytes = new Uint8Array(hashBuffer).slice(0, nacl.secretbox.keyLength);
  return encodeBase64(keyBytes);
}

function encryptData(text, keyBase64) {
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(text);
  const keyBytes = decodeBase64(keyBase64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(messageBytes, nonce, keyBytes);
  
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Aer Extension installed/updated');
});

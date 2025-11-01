// Complete background.js for Chrome Extension with Upload Fix
// Copy and paste this entire file to replace your current background.js

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const AER_API_ENDPOINT = 'https://brilliant-caribou-800.convex.site/api/context/upload';
const API_TOKEN = ''; // Will be loaded from storage

// ============================================
// GLOBAL STATE
// ============================================
const tabStates = new Map();
let extensionSettings = {
  autoUpload: false,
  encryptData: false,
  notifications: true
};

// ============================================
// INITIALIZATION
// ============================================
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated');
  
  // Initialize settings
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      extensionSettings = result.settings;
    } else {
      chrome.storage.local.set({ settings: extensionSettings });
    }
  });
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'uploadToAer',
    title: 'Upload to Aer',
    contexts: ['selection', 'page', 'link', 'image']
  });
});

// ============================================
// CORE UPLOAD FUNCTIONALITY - MAIN FIX HERE
// ============================================

/**
 * Prepares raw data for upload by ensuring it has the correct field names
 * The API expects: 'content', 'plaintext', or 'encryptedContent'
 */
function prepareDataForUpload(rawData) {
  console.log('[Upload] Preparing data, type:', typeof rawData, 'value:', rawData);
  
  // Handle null/undefined
  if (rawData == null) {
    return { content: '' };
  }
  
  // Handle strings directly
  if (typeof rawData === 'string') {
    return { content: rawData };
  }
  
  // Handle arrays
  if (Array.isArray(rawData)) {
    return { content: JSON.stringify(rawData) };
  }
  
  // Handle objects
  if (typeof rawData === 'object') {
    // If it already has the correct fields, return as-is
    if (rawData.content || rawData.plaintext || rawData.encryptedContent) {
      return rawData;
    }
    
    // Map 'encrypted' to 'encryptedContent'
    if (rawData.encrypted) {
      return { 
        encryptedContent: rawData.encrypted,
        ...(rawData.metadata && { metadata: rawData.metadata }),
        ...(rawData.timestamp && { timestamp: rawData.timestamp })
      };
    }
    
    // Check for common content field names and map them to 'content'
    const possibleContentFields = ['text', 'message', 'body', 'data', 'value', 'html', 'url'];
    for (const field of possibleContentFields) {
      if (rawData[field] !== undefined) {
        const value = rawData[field];
        return { 
          content: typeof value === 'string' ? value : JSON.stringify(value),
          ...(rawData.metadata && { metadata: rawData.metadata }),
          ...(rawData.timestamp && { timestamp: rawData.timestamp })
        };
      }
    }
    
    // If no recognized fields, stringify the entire object
    return { content: JSON.stringify(rawData) };
  }
  
  // For any other type, convert to string
  return { content: String(rawData) };
}

/**
 * Main upload function - sends data to Aer API
 * This is the fixed version that ensures data has correct field names
 */
async function uploadToAer(data) {
  try {
    console.log('[Upload] Starting upload with raw data:', data);
    
    // Validate input
    if (!data && data !== 0 && data !== '') {
      throw new Error('No data provided for upload');
    }

    // CRITICAL FIX: Ensure data has the correct format
    let payload = prepareDataForUpload(data);
    
    // Add timestamp if not present
    if (!payload.timestamp) {
      payload.timestamp = Date.now();
    }
    
    // Final validation - must have at least one required field
    if (!payload.content && !payload.plaintext && !payload.encryptedContent) {
      console.error('[Upload] ERROR - Payload missing required fields:', payload);
      console.error('[Upload] Original data was:', data);
      throw new Error('Payload must contain either "content", "plaintext", or "encryptedContent"');
    }

    console.log('[Upload] Final payload to send:', JSON.stringify(payload));

    // Get auth token from storage
    const storage = await chrome.storage.local.get(['authToken', 'token']);
    const authToken = storage.authToken || storage.token || API_TOKEN;

    if (!authToken) {
      throw new Error('No authentication token configured. Please set up authentication first.');
    }

    // Make the API request
    const response = await fetch(AER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    // Handle response
    const responseText = await response.text();
    console.log('[Upload] Response status:', response.status);
    console.log('[Upload] Response text:', responseText);
    
    if (!response.ok) {
      let errorMessage = `Upload failed (${response.status})`;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage += `: ${JSON.stringify(errorJson)}`;
      } catch {
        errorMessage += `: ${responseText}`;
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { success: true, message: responseText };
    }
    
    console.log('[Upload] Success:', result);
    
    // Show success notification if enabled
    if (extensionSettings.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon128.png'),
        title: 'Upload Successful',
        message: 'Data uploaded to Aer successfully!'
      });
    }
    
    return result;

  } catch (error) {
    console.error('[Upload] Error:', error);
    console.error('[Upload] Stack:', error.stack);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title: 'Upload Failed',
      message: error.message
    });
    
    throw error;
  }
}

// ============================================
// MESSAGE HANDLING - LINE 178 FIX IS HERE
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message received:', request);
  
  // Handle upload action - THIS IS THE CRITICAL FIX FOR LINE 178
  if (request.action === 'upload' || request.action === 'saveToAer') {
    (async () => {
      try {
        // Extract data from request in various possible formats
        let dataToUpload = null;
        
        // Try different possible data locations
        if (request.data !== undefined) {
          dataToUpload = request.data;
        } else if (request.content !== undefined) {
          dataToUpload = { content: request.content };
        } else if (request.plaintext !== undefined) {
          dataToUpload = { plaintext: request.plaintext };
        } else if (request.encryptedContent !== undefined) {
          dataToUpload = { encryptedContent: request.encryptedContent };
        } else if (request.text !== undefined) {
          dataToUpload = { content: request.text };
        } else if (request.message !== undefined) {
          dataToUpload = { content: request.message };
        } else if (request.body !== undefined) {
          dataToUpload = { content: request.body };
        } else {
          // Use entire request minus the action field
          const { action, ...restOfRequest } = request;
          dataToUpload = restOfRequest;
        }
        
        console.log('[Background] Data to upload (before prep):', dataToUpload);
        
        // Prepare data with correct format
        dataToUpload = prepareDataForUpload(dataToUpload);
        
        // Add metadata from sender if available
        if (sender.tab) {
          dataToUpload.metadata = {
            ...dataToUpload.metadata,
            url: sender.tab.url,
            title: sender.tab.title,
            tabId: sender.tab.id,
            source: 'content_script'
          };
        }
        
        // Check if encryption is enabled
        if (extensionSettings.encryptData) {
          const contentToEncrypt = dataToUpload.content || dataToUpload.plaintext || '';
          dataToUpload = {
            encryptedContent: btoa(contentToEncrypt), // Simple base64 for demo
            metadata: dataToUpload.metadata
          };
        }
        
        console.log('[Background] Final data to upload:', dataToUpload);
        
        // THIS IS THE FIX FOR LINE 178 - data is now properly formatted
        const result = await uploadToAer(dataToUpload);
        
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[Background] Error handling upload:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep message channel open for async response
  }
  
  // Handle other actions
  switch (request.action) {
    case 'getSettings':
      sendResponse({ success: true, settings: extensionSettings });
      break;

    case 'updateSettings':
      extensionSettings = { ...extensionSettings, ...request.settings };
      chrome.storage.local.set({ settings: extensionSettings });
      sendResponse({ success: true });
      break;

    case 'openAuth': {
      const url = chrome.runtime.getURL('auth.html');
      chrome.tabs.create({ url }, () => sendResponse({ success: true }));
      return true;
    }

    case 'checkConnection': {
      chrome.storage.local.get(['authToken', 'token'], (res) => {
        const hasToken = Boolean(res.authToken || res.token);
        sendResponse({ success: true, hasToken });
      });
      return true;
    }

    case 'capture': {
      // Basic capture: upload current page URL/title
      const { url, title } = request;
      const payload = { content: `Page: ${title}\nURL: ${url}`, metadata: { source: 'popup_capture' } };
      uploadToAer(payload)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    case 'testConnection':
      fetch(AER_API_ENDPOINT, { method: 'OPTIONS' })
        .then(() => sendResponse({ success: true, message: 'Connection successful' }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  }
});

// ============================================
// CONTEXT MENU HANDLING
// ============================================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'uploadToAer') {
    let dataToUpload = {};
    
    if (info.selectionText) {
      dataToUpload.content = info.selectionText;
    } else if (info.linkUrl) {
      dataToUpload.content = `Link: ${info.linkUrl}`;
    } else if (info.srcUrl) {
      dataToUpload.content = `Image: ${info.srcUrl}`;
    } else {
      dataToUpload.content = `Page: ${tab.title}\nURL: ${tab.url}`;
    }
    
    dataToUpload.metadata = {
      pageUrl: info.pageUrl,
      tabTitle: tab.title,
      context: 'context_menu'
    };
    
    uploadToAer(dataToUpload)
      .then(result => console.log('[Background] Context menu upload successful'))
      .catch(error => console.error('[Background] Context menu upload failed:', error));
  }
});

// ============================================
// TAB MANAGEMENT
// ============================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    tabStates.set(tabId, {
      url: tab.url,
      title: tab.title,
      lastUpdated: Date.now()
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Simple encryption placeholder - implement your own
async function encryptContent(data) {
  try {
    return btoa(typeof data === 'string' ? data : JSON.stringify(data));
  } catch (error) {
    console.error('[Encrypt] Error:', error);
    return data;
  }
}

// Test function to verify the upload is working
async function testUpload() {
  console.log('=== Testing Upload Function ===');
  
  const testCases = [
    'Simple string',
    { text: 'Object with text field' },
    { message: 'Object with message field' },
    { data: 'Object with data field' },
    { content: 'Object with correct content field' },
    { random: 'Object with unrecognized field' }
  ];
  
  for (const testData of testCases) {
    try {
      console.log('Testing:', testData);
      const prepared = prepareDataForUpload(testData);
      console.log('Prepared:', prepared);
      // Uncomment to actually test upload:
      // await uploadToAer(testData);
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
}

// ============================================
// STARTUP
// ============================================
console.log('[Background] Background script loaded');
console.log('[Background] API Endpoint:', AER_API_ENDPOINT);

// Uncomment to run tests on load:
// testUpload();

// ============================================
// CONTEXT MENU HANDLING
// ============================================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'uploadToAer') {
    let dataToUpload = {};
     
    if (info.selectionText) {
      dataToUpload.content = info.selectionText;
      dataToUpload.type = 'selection';
    } else if (info.linkUrl) {
      dataToUpload.content = info.linkUrl;
      dataToUpload.type = 'link';
    } else if (info.srcUrl) {
      dataToUpload.content = info.srcUrl;
      dataToUpload.type = 'image';
    } else {
      dataToUpload.type = 'page';
    }
    
    dataToUpload.metadata = {
      url: info.pageUrl || tab.url,
      title: tab.title,
      timestamp: Date.now()
    };
    
    uploadToAer(dataToUpload)
      .then(() => console.log('[ContextMenu] Upload successful'))
      .catch(error => console.error('[ContextMenu] Upload failed:', error));
  }
});

// ============================================
// TAB UPDATE HANDLING
// ============================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
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
// STARTUP
// ============================================
console.log('[Background] Background script loaded');
console.log('[Background] API Endpoint:', AER_API_ENDPOINT);
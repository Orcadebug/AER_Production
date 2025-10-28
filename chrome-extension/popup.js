document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const button = document.getElementById('summarizeBtn');
  const status = document.getElementById('status');
  
  // Disable button
  button.disabled = true;
  button.textContent = '⏳ Processing...';
  status.textContent = '';
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Extract page content from content script
    const pageData = await chrome.tabs.sendMessage(tab.id, { action: "getPageContent" });
    
    // Send to background script to save
    const result = await chrome.runtime.sendMessage({
      action: "summarize",
      data: pageData
    });
    
    if (result.success) {
      status.className = 'status success';
      status.textContent = '✅ Saved to Aer successfully!';
    } else {
      throw new Error(result.error || 'Failed to save');
    }
  } catch (error) {
    status.className = 'status error';
    status.textContent = `❌ Error: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = '📝 Summarize & Save';
  }
});

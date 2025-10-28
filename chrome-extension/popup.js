document.getElementById('captureBtn').addEventListener('click', async () => {
  const button = document.getElementById('captureBtn');
  const status = document.getElementById('status');
  
  try {
    // Disable button and show loading
    button.disabled = true;
    status.className = 'status loading';
    status.textContent = 'Capturing page content...';
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Extract content from page
    const pageData = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
    
    status.textContent = 'Encrypting and saving...';
    
    // Send to background script to save
    const response = await chrome.runtime.sendMessage({
      action: 'captureAndSave',
      data: pageData
    });
    
    if (response.success) {
      status.className = 'status success';
      status.textContent = `✓ Saved: ${response.result.title}`;
      
      // Reset after 2 seconds
      setTimeout(() => {
        status.className = 'status';
        status.textContent = '';
        button.disabled = false;
      }, 2000);
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    status.className = 'status error';
    status.textContent = `Error: ${error.message}`;
    button.disabled = false;
  }
});

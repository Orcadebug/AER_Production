// Content script to extract page content
(function() {
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractContent") {
      const pageData = {
        title: document.title,
        url: window.location.href,
        content: extractMainContent()
      };
      sendResponse(pageData);
    }
    return true;
  });

  function extractMainContent() {
    // Remove script, style, and other non-content elements
    const clone = document.body.cloneNode(true);
    const unwanted = clone.querySelectorAll('script, style, nav, header, footer, iframe, noscript');
    unwanted.forEach(el => el.remove());

    // Get text content
    let text = clone.innerText || clone.textContent || '';
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limit to 5000 characters
    return text.substring(0, 5000);
  }
})();

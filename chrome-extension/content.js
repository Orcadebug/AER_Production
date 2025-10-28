// Extract page content
function extractPageContent() {
  // Get main content (you can customize this selector)
  const article = document.querySelector('article') || 
                  document.querySelector('main') || 
                  document.body;
  
  // Extract text content
  const content = article.innerText || article.textContent || "";
  
  return {
    title: document.title,
    content: content.substring(0, 5000), // Limit to 5000 chars
    url: window.location.href
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    const pageData = extractPageContent();
    sendResponse(pageData);
  }
});

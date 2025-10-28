   // In your Chrome extension background script or content script
   async function uploadContext(title, content, type = "note") {
     const authToken = await chrome.storage.local.get(['authToken']);
     
     // Encrypt content client-side (you'll need to include your encryption library)
     const encryptedContent = encryptData(content, userKey);
     const encryptedTitle = encryptData(title, userKey);
     
     const response = await fetch('https://[your-deployment].convex.cloud/api/context/upload', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${authToken.authToken}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         title: title.substring(0, 50),
         type: type,
         encryptedContent: encryptedContent,
         encryptedTitle: encryptedTitle
       })
     });
     
     return await response.json();
   }
   
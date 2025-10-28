// Background service worker for Aer Chrome Extension
import { ConvexHttpClient } from "convex/browser";
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
import { api } from "../src/convex/_generated/api.js";

// Initialize Convex client - REPLACE WITH YOUR ACTUAL CONVEX URL
const CONVEX_URL = "https://different-bandicoot-508.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

// Derive encryption key from user ID (same as web app)
async function deriveKeyFromUserId(userId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const key = hashArray.slice(0, nacl.secretbox.keyLength);
  return encodeBase64(key);
}

// Encrypt data using TweetNaCl
function encryptData(data, secretKey) {
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(data);
  const keyUint8 = decodeBase64(secretKey);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkConnection") {
    checkConnection()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === "captureAndSave") {
    handleCapture(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function checkConnection() {
  try {
    // Try to get current user from Convex
    const user = await convex.query(api.users.currentUser, {});
    
    if (user) {
      return { success: true, user };
    } else {
      return { success: false, error: "Not authenticated" };
    }
  } catch (error) {
    console.error("Connection check failed:", error);
    return { success: false, error: error.message };
  }
}

async function handleCapture(pageData) {
  try {
    // Get current user from Convex
    const user = await convex.query(api.users.currentUser, {});
    
    if (!user) {
      throw new Error("Not authenticated. Please log in to the web app first.");
    }

    // Derive encryption key from user ID
    const encryptionKey = await deriveKeyFromUserId(user._id);

    // Prepare content
    const content = `URL: ${pageData.url}\n\n${pageData.content}`;
    const title = pageData.title || "Untitled Page";
    const summary = content.substring(0, 200) + "...";

    // Encrypt data
    const encryptedContent = encryptData(content, encryptionKey);
    const encryptedTitle = encryptData(title, encryptionKey);
    const encryptedSummary = encryptData(summary, encryptionKey);

    // Save to Convex
    const contextId = await convex.mutation(api.contexts.create, {
      title: title.substring(0, 50),
      type: "web",
      url: pageData.url,
      encryptedContent,
      encryptedTitle,
      encryptedSummary,
      plaintextContent: content // For AI tag generation
    });

    return { contextId, title };
  } catch (error) {
    console.error("Error capturing content:", error);
    throw error;
  }
}

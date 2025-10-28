import { ConvexHttpClient } from "convex/browser";
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

const CONVEX_URL = "https://your-deployment.convex.cloud"; // Replace with your Convex URL

// Initialize Convex client
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

// Encrypt data (same as web app)
function encryptData(data, secretKey) {
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(data);
  const keyUint8 = decodeBase64(secretKey);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);
  
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

// Get current user from Convex
async function getCurrentUser() {
  try {
    const user = await convex.query("users:currentUser", {});
    return user;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

// Summarize and save webpage
async function summarizeWebpage(pageData) {
  try {
    // 1. Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated. Please log in via the web app first.");
    }

    // 2. Derive encryption key from user ID
    const encryptionKey = await deriveKeyFromUserId(user._id);

    // 3. Extract and prepare content
    const { title, content, url } = pageData;
    const summary = content.length > 150 ? content.substring(0, 150) + "..." : content;

    // 4. Encrypt all sensitive data
    const encryptedContent = encryptData(content, encryptionKey);
    const encryptedTitle = encryptData(title, encryptionKey);
    const encryptedSummary = encryptData(summary, encryptionKey);

    // 5. Send to Convex database
    const contextId = await convex.mutation("contexts:create", {
      title: title.substring(0, 50), // Truncated for search
      type: "web",
      url: url,
      encryptedContent,
      encryptedTitle,
      encryptedSummary,
      plaintextContent: content, // For AI tag generation (not stored)
    });

    return { success: true, contextId };
  } catch (error) {
    console.error("Failed to save webpage:", error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    summarizeWebpage(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

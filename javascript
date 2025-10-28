// In your Chrome extension
import { ConvexHttpClient } from "convex/browser";
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

const convex = new ConvexHttpClient(process.env.CONVEX_URL);

// Copy this function from your web app
async function deriveKeyFromUserId(userId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const key = hashArray.slice(0, nacl.secretbox.keyLength);
  return encodeBase64(key);
}

// Get current user and derive key
async function getEncryptionKey() {
  const user = await convex.query("users:currentUser");
  if (!user) throw new Error("Not authenticated");
  return await deriveKeyFromUserId(user._id);
}

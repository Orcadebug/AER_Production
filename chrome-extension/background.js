// Background service worker for Aer Chrome Extension
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

// API endpoint - REPLACE WITH YOUR ACTUAL CONVEX URL
const API_BASE_URL = "https://different-bandicoot-508.convex.cloud";
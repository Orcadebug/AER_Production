// Background service worker for Aer Chrome Extension
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

// API endpoint - loaded from config
const API_BASE_URL = chrome.runtime.getManifest().externally_connectable?.matches?.[0] || "https://different-bandicoot-508.convex.cloud";

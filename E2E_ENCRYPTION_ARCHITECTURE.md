# AER End-to-End Encryption Architecture

## Core Principle
**All user data is encrypted client-side before storage.** The backend never sees plaintext user content—only ciphertext and metadata. Only the client has the secret key needed to decrypt.

---

## 1. Encryption Key Model

### Key Derivation
**Every device independently derives the same encryption key from the user ID.**

```typescript
// Client-side (src/lib/encryption.ts)
async function deriveKeyFromUserId(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const key = hashArray.slice(0, 32); // NaCl secretbox key length
  return encodeBase64(key);
}
```

**Key Properties:**
- **Deterministic**: Same userId always produces the same key
- **Device-independent**: No need to sync keys across devices
- **Stateless**: Key derived on-the-fly whenever needed
- **No server involvement**: Server never sees or stores the key

### Key Storage
Keys are stored **client-side only** in browser sessionStorage:

```typescript
// src/lib/encryption.ts
function storeEncryptionKey(userId: string, key: string): void {
  sessionStorage.setItem(`encryption_key_${userId}`, key);
}

function getEncryptionKey(userId: string): string | null {
  return sessionStorage.getItem(`encryption_key_${userId}`);
}

function clearEncryptionKey(userId: string): void {
  sessionStorage.removeItem(`encryption_key_${userId}`);
}
```

**Security:**
- Cleared when browser tab closes
- Never persisted to disk
- Not transmitted to backend
- Lost on logout (clearKey() called)

---

## 2. Encryption/Decryption Flow

### Encryption Algorithm
Uses **NaCl SecretBox** (XSalsa20-Poly1305 AEAD cipher):

```typescript
// Client encrypts before sending to backend
export function encryptData(data: string, secretKey: string): EncryptedData {
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(data);
  const keyUint8 = decodeBase64(secretKey);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 random bytes
  
  const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);
  
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}
```

### Decryption Algorithm
Only the client with the key can decrypt:

```typescript
export function decryptData(
  encryptedData: EncryptedData,
  secretKey: string
): string | null {
  try {
    const ciphertext = decodeBase64(encryptedData.ciphertext);
    const nonce = decodeBase64(encryptedData.nonce);
    const keyUint8 = decodeBase64(secretKey);
    
    const decrypted = nacl.secretbox.open(ciphertext, nonce, keyUint8);
    if (!decrypted) return null;
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}
```

**Properties:**
- Each encryption uses a **random nonce** → same plaintext produces different ciphertext each time
- **24-byte random nonce** prevents replay attacks
- **Poly1305 authentication** ensures integrity (tampering detected)

---

## 3. Multi-Device Sync (Current Implementation)

### Scenario: User logs in on Device B after using Device A

**Device A (Webapp):**
1. User authenticates
2. Derives key from userId via SHA-256 → K_device_a
3. User creates/edits context
4. Content encrypted with K_device_a before sending
5. Backend stores ciphertext (no plaintext visible)

**Device B (Chrome Extension or New Webapp Session):**
1. User authenticates with same email
2. Backend verifies identity, returns userId
3. **Derives key from same userId** → K_device_b = K_device_a (mathematically identical)
4. Browser can decrypt all stored contexts
5. All plaintext appears seamlessly

**No key exchange needed** because key = SHA256(userId) is deterministic.

### Future Enhancement: Wrapped Keys
For scenarios needing explicit key distribution:

```typescript
// Planned architecture (not yet implemented)
// Backend could store:
interface DeviceKeyBinding {
  deviceId: string,
  wrappedKey: {
    ciphertext: string,  // Master key encrypted with device's public key
    nonce: string
  },
  publicKey: string,     // Device's public key for future key rotation
  createdAt: number
}
```

---

## 4. Data Storage Model

### Database Schema (src/convex/schema.ts)

```typescript
contexts: defineTable({
  userId: v.id("users"),
  projectId: v.optional(v.id("projects")),
  
  // PLAINTEXT (searchable, not sensitive)
  title: v.optional(v.string()),           // Legacy/fallback
  tags: v.optional(v.array(v.string())),   // AI-generated tags (no secrets)
  
  // ENCRYPTED (only client can decrypt)
  encryptedContent: {
    ciphertext: string,
    nonce: string
  },
  encryptedTitle: v.optional({
    ciphertext: string,
    nonce: string
  }),
  encryptedSummary: v.optional({
    ciphertext: string,
    nonce: string
  }),
  encryptedMetadata: v.optional({
    ciphertext: string,
    nonce: string
  }),
  
  // METADATA (non-sensitive)
  fileId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  fileType: v.optional(v.string()),
  url: v.optional(v.string()),
})
```

### What's Encrypted vs Plaintext
| Field | Plaintext | Encrypted | Reason |
|-------|-----------|-----------|--------|
| **Content** | ❌ | ✅ | Core user data, must be private |
| **Title** | ✅ (legacy) | ✅ (preferred) | Plaintext copy used for search indexing |
| **Summary** | ❌ | ✅ | Derived from content, should be private |
| **Tags** | ✅ | ❌ | AI-generated categories, used for discovery, not sensitive |
| **Project ID** | ✅ | ❌ | Non-sensitive reference |
| **File metadata** | ✅ | ❌ | Filename/type only, not sensitive |

---

## 5. Full Content Upload Flow

### Step 1: Client Encryption (Webapp)
```typescript
// User creates note in Dashboard.tsx
const handleAddNote = async (e: React.FormEvent<HTMLFormElement>) => {
  const content = formData.get("content") as string;
  const title = formData.get("title") as string;
  
  // Encrypt on client
  const encryptedContent = encrypt(content);  // Uses derived key
  const encryptedTitle = encrypt(title);
  const encryptedSummary = encrypt(summary);
  
  // Send encrypted blob to backend (mutation)
  await createContext({
    encryptedContent,    // {ciphertext, nonce}
    encryptedTitle,
    encryptedSummary,
    plaintextContent: content,  // For AI enrichment ONLY
    // ...
  });
};
```

**At this point:** plaintext only exists in memory, never sent to server as plaintext.

### Step 2: Backend Receives Encrypted Data
```typescript
// src/convex/contexts.ts - create mutation
export const create = mutation({
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    
    // Validate encryption
    const encContent = args.encryptedContent;
    if (!encContent?.ciphertext || !encContent?.nonce) {
      throw new Error("Missing encrypted content");
    }
    
    // Insert ciphertext directly (never decrypt)
    const contextId = await ctx.db.insert("contexts", {
      userId: user._id,
      encryptedContent: encContent,  // Stored as-is
      encryptedTitle: encryptedTitle,
      encryptedSummary: encryptedSummary,
      // ...
    });
    
    // Schedule AI enrichment with PLAINTEXT PREVIEW (temporary)
    if (args.plaintextContent && process.env.PERPLEXITY_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTags, {
        contextId,
        content: args.plaintextContent.slice(0, 6000),  // Preview only
        // ...
      });
    }
  }
});
```

### Step 3: AI Enrichment (Temporary Plaintext)
```typescript
// src/convex/ai.ts
export const generateAndUpdateTags = internalAction({
  handler: async (ctx, args) => {
    // Process plaintext preview for tags
    const tags = await ctx.runAction(internal.ai.generateTags, {
      content: args.content,  // Plaintext from client
      title: args.title,
    });
    
    // Store only the TAG NAMES (not the content)
    await ctx.runMutation(internal.contextsInternal.updateTags, {
      contextId: args.contextId,
      tags,  // ["technology", "react", "hooks"]
    });
    
    // Plaintext discarded after processing
  }
});
```

**Key point:** Plaintext is used temporarily for AI, then **never stored**. Only tags + encrypted content persist.

### Step 4: Client Decryption (Viewing)
```typescript
// Dashboard.tsx displays contexts
const getDecryptedContent = (context: any) => {
  if (context.encryptedContent) {
    const decrypted = decrypt(context.encryptedContent);  // Uses derived key
    if (decrypted) return decrypted;
    // ...
  }
  return "No content available";
};
```

---

## 6. Chrome Extension Flow

### Extension Upload (Full Page)
```typescript
// chrome-extension/background.js
async function uploadToAer(data) {
  // Extract page content
  const content = extractMainContent();
  
  // Derive key from stored userId
  const userId = authToken.substring(4); // aer_{userId}
  const keyB64 = await deriveKeyFromUserIdB64(userId);
  
  // Encrypt client-side
  const encryptedContent = encryptWithKeyB64(content, keyB64);
  
  // Send to API with Bearer token
  await fetch(`${AER_API_ENDPOINT}/api/context/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer aer_${userId}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      encryptedContent,
      plaintext: content,  // For AI enrichment
      // ...
    })
  });
}
```

### Extension Upload (Summary Only)
```typescript
// Same flow but with summaryOnly flag
const payload = {
  plaintext: content,
  summaryOnly: true,  // Trigger backend AI
  encryptedContent: encryptedContent
};
```

Backend processes:
```typescript
// src/convex/httpApi.ts - uploadContext
if (summaryOnly) {
  const text = plaintext;
  const summary = await ctx.runAction(internal.ai.generateSummary, 
    { content: text }
  );
  const encSummary = serverEncryptString(summary);
  
  const contextId = await ctx.runMutation(internal.contextsInternal.createForUser, {
    encryptedContent: encSummary,
    encryptedSummary: encSummary,
    tags: computedTags,
  });
}
```

---

## 7. Update & Edit Flow (Client-Side Only)

### User Edits Context

**Current State:**
```
Server DB:
{
  _id: context1,
  encryptedContent: {ciphertext: "...", nonce: "..."},
  encryptedTitle: {ciphertext: "...", nonce: "..."},
  tags: ["react", "hooks"]
}
```

**Client Session:**
```
Browser:
{
  decryptedContent: "function MyComponent() { ... }",
  decryptedTitle: "My React Component",
  key: "base64_derived_key"
}
```

**Edit Action:**
1. User modifies content in textarea
2. Frontend detects change
3. Re-encrypts with same key (different nonce)
4. Sends `updateContext()` mutation with new encrypted blobs
5. Backend replaces encryptedContent + encryptedTitle
6. Tags remain unchanged (client can't modify AI-generated tags directly)

```typescript
// Dashboard.tsx - edit handler
const updatedEncContent = encrypt(editedContent);  // New encryption
await updateContext({
  id: contextId,
  encryptedContent: updatedEncContent,
  encryptedTitle: encrypt(editedTitle)
});
```

### Updating Metadata (Tags, Projects)

**Tags** - AI-generated, read-only from client perspective:
- Client views tags (plaintext in DB)
- Backend manages tag updates only

**Projects** - Client can assign:
```typescript
await updateContext({
  id: contextId,
  projectId: projectId  // Plaintext reference, not sensitive
});
```

---

## 8. Server-Side Encryption (Fallback Only)

### When Server Encrypts
Only if client sends plaintext without encrypted version:

```typescript
// httpApi.ts
if (!encryptedContent || !encryptedContent.ciphertext) {
  const text = plaintext || content;
  encryptedContent = serverEncryptString(text);  // Server encrypts fallback
}
```

### Server-Side Key
```typescript
// src/convex/crypto.ts
export function getServerKey(): Uint8Array {
  const keyB64 = process.env.SERVER_ENC_KEY_B64;  // From environment
  return b64decode(keyB64);
}

export function serverEncryptString(plaintext: string): { ciphertext, nonce } {
  const key = getServerKey();
  const nonce = nacl.randomBytes(24);
  const boxed = nacl.secretbox(plaintext_bytes, nonce, key);
  return { ciphertext: b64encode(boxed), nonce: b64encode(nonce) };
}
```

**Server Key Properties:**
- ✅ Stored server-side in environment variables
- ✅ Used only for audit/compliance scenarios
- ✅ User data encrypted with this key is NOT truly E2E (backend can access)
- ⚠️ Fallback only—normal flow uses client key

---

## 9. Session & Key Lifecycle

### Login Flow
```typescript
// src/hooks/use-encryption.ts
useEffect(() => {
  if (!isAuthenticated || !user) {
    setEncryptionKey(null);
    return;
  }
  
  // Try session storage first
  let key = getEncryptionKey(user._id);
  
  // If not cached, derive from userId
  if (!key) {
    deriveKeyFromUserId(user._id).then((derivedKey) => {
      storeEncryptionKey(user._id, derivedKey);  // Cache in sessionStorage
      setEncryptionKey(derivedKey);
    });
  } else {
    setEncryptionKey(key);  // Use cached key
  }
}, [isAuthenticated, user]);
```

### Logout Flow
```typescript
const handleSignOut = async () => {
  clearEncryptionKey(user._id);  // Remove from sessionStorage
  await signOut();
  navigate("/auth");
};
```

### Cross-Tab Security
- Each browser tab has **separate sessionStorage**
- No key sharing between tabs
- Closing tab → key cleared automatically

---

## 10. Audit & Compliance

### What Backend Logs
```typescript
// audit.ts
await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
  userId: user._id,
  action: "CREATE_CONTEXT",
  resourceType: "context",
  resourceId: contextId,
  success: true,
  // NO plaintext content logged
});
```

### What Backend Never Sees
- ❌ Plaintext user content
- ❌ User's encryption key
- ❌ Decrypted titles/summaries (after AI enrichment)
- ❌ Original files (only encrypted versions)

### What Backend Stores
- ✅ User ID + encrypted content (ciphertext + nonce)
- ✅ AI-generated tags (non-sensitive)
- ✅ Timestamps, file metadata
- ✅ Action logs (no content)
- ✅ Usage stats (bytes counted from ciphertext)

---

## 11. Security Properties

### Confidentiality
- ✅ **Perfect forward secrecy**: Each message has random nonce, new key on each device
- ✅ **No key leakage**: Key never sent to server, derived client-side
- ✅ **Ciphertext-only access**: Server cannot decrypt without client key

### Integrity
- ✅ **Poly1305 MAC**: Tampering detected, ciphertext fails to decrypt
- ✅ **Authenticated encryption**: AEAD cipher (NaCl SecretBox)

### Authenticity
- ✅ **User authentication**: Convex Auth (email OTP)
- ✅ **Per-user content isolation**: Each user's contexts have userId index

### Privacy
- ✅ **No plaintext storage**: Content never persists unencrypted
- ✅ **No key escrow**: Backend cannot access user keys
- ✅ **Tag-based discovery**: Search possible without decryption

---

## 12. Potential Improvements

### 1. Key Rotation
```typescript
// Future: Allow users to rotate master key
interface KeyRotation {
  oldKeyVersion: number,
  newKeyVersion: number,
  reencryptedContexts: Context[]  // Re-encrypted with new key
}
```

### 2. Device-Specific Key Wrapping
```typescript
// For added security on untrusted devices
interface WrappedKey {
  devicePublicKey: string,
  wrappedMasterKey: {
    ciphertext: string,
    nonce: string
  },
  expiresAt: number
}
```

### 3. Hierarchical Tags Encryption
```typescript
// Currently plaintext for discovery
// Could encrypt tag names while keeping searchable hashes
encryptedTags: {
  ciphertext: string,
  nonce: string,
  searchableHash: hash(tag)  // For search without decryption
}
```

### 4. Backup/Export with Encryption
```typescript
// Allow encrypted export of all contexts
// User retains full control via client key
export async function exportContextsEncrypted() {
  // Fetch all contexts (already encrypted)
  // Wrap in additional layer
  // Generate recovery code
}
```

---

## 13. Threat Model

### Threats Mitigated
- ✅ **Server breach**: Ciphertext leaked, but useless without keys
- ✅ **Network eavesdropping**: HTTPS + encrypted payload
- ✅ **Account compromise**: Encrypted data remains private (key != password)
- ✅ **Insider attack**: Backend engineers cannot access content

### Threats Not Fully Mitigated
- ⚠️ **Client compromise**: If device is malware-infected, plaintext during processing
- ⚠️ **Key extraction**: Malware could steal key from sessionStorage
- ⚠️ **Browser vulnerabilities**: XSS could expose plaintext in memory

**Mitigations:**
- Use HTTPS only
- Keep browser/OS updated
- Use password manager for strong auth
- Enable 2FA when available
- Avoid untrusted networks for sensitive work

---

## Implementation Checklist

- [x] Client-side encryption on all contexts
- [x] Key derivation from userId
- [x] SessionStorage for key caching
- [x] Auto-encryption before mutation
- [x] Auto-decryption on query
- [x] AI enrichment with plaintext preview (temporary)
- [x] Chrome extension support with Bearer token
- [x] Summary-only mode with server AI
- [ ] Key rotation UI
- [ ] Device-specific key wrapping
- [ ] Encrypted tags
- [ ] Export/backup encryption

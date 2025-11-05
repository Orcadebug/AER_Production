# Context Upload Flows in AER

This document explains the three main ways to upload context and what happens at each step.

---

## 1. WEBAPP UPLOAD FLOW

### Entry Point
User clicks "Upload" in the webapp dashboard and provides content through a form.

### Flow Diagram
```
User Input Form (Dashboard.tsx)
    ↓
React Mutation: contexts.create()
    ↓
Backend Mutation Handler (contexts.ts)
    ├─ Validate User Authentication
    ├─ Enforce: encryptedContent must be provided (client encrypted)
    ├─ Compute plaintext title for indexing/search
    ├─ Insert into DB with encrypted fields
    ├─ Track storage bytes via entitlements
    └─ Trigger AI enrichment (async, if plaintext provided)
    ↓
AI Background Tasks (via ctx.scheduler.runAfter)
    ├─ generateAndUpdateTags
    ├─ generateAndUpdateEncryptedSummary
    └─ generateAndUpdateTitleAndProject
    ↓
Audit Logging
    ↓
Return contextId to frontend
```

### Key Details

**Encryption Model:**
- **Client-side encryption**: Frontend must encrypt `encryptedContent` before sending
- **Stored**: `{ ciphertext: string, nonce: string }` (NaCl secretbox)
- **Title field**: Plaintext (for search/indexing), max 80 chars computed from first line or filename
- **Summary/Metadata**: Also encrypted on client before upload

**Flow Sequence:**
1. User provides content in form (content, title optional, file optional)
2. Frontend encrypts content using client-side key (derived from user ID via SHA-256)
3. Sends mutation with: `encryptedContent`, `encryptedTitle` (optional), `title` (plaintext for indexing)
4. Backend validates encryption, computes search title, inserts context doc
5. Backend schedules 3 async AI tasks if plaintext content provided:
   - **Tag generation**: Creates 3-10 hierarchical tags (general → specific)
   - **Summary generation**: Creates 2-3 sentence summary (stored encrypted)
   - **Title refinement**: AI improves plaintext title and assigns project

**Storage Tracking:**
- Bytes calculated from ciphertext lengths
- Stored in `entitlements` table under user
- Used for quota enforcement

---

## 2. CHROME EXTENSION - FULL PAGE UPLOAD

### Entry Point
User right-clicks on a page → "Upload Full Page to Aer"

### Flow Diagram
```
Page Context Menu (background.js)
    ↓
Extract Full Page Content
    ├─ Get selected text if available (>40 chars)
    ├─ Auto-expand "show more" buttons
    ├─ Auto-scroll to load lazy-loaded content
    ├─ Site-specific extraction (ChatGPT, Perplexity, Claude)
    └─ Fallback: main element or entire page
    ↓
Content Processing (background.js)
    ├─ Limit to 20,000 chars
    ├─ Get auth token from storage (aer_{userId})
    ├─ Derive encryption key from userId via SHA-256
    ├─ Encrypt content client-side using NaCl secretbox
    └─ Prepare payload
    ↓
HTTP POST to /api/context/upload
    ├─ Headers: Authorization: Bearer aer_{userId}
    └─ Body: { encryptedContent: {ciphertext, nonce}, plaintext?, tags?, ... }
    ↓
Backend HTTP Handler (httpApi.ts)
    ├─ Validate Bearer token format
    ├─ Verify user exists via internal query
    ├─ Receive encrypted payload
    ├─ Branch: if !encryptedContent, encrypt plaintext on server
    ├─ Call internal.contextsInternal.createForUser()
    ├─ Schedule AI enrichment (tags, summary, title)
    └─ Log audit event: API_UPLOAD_CONTEXT
    ↓
Return { success: true, contextId }
```

### Key Details

**Content Extraction (content.js):**
```javascript
Priority Order:
1. Selected text (if >40 chars)
2. Auto-expand "show more" buttons
3. Auto-scroll virtualized content (fires async)
4. Site-aware extraction:
   - ChatGPT: [data-message-author-role] elements
   - Perplexity: [data-testid*="chat-message"], prose divs
   - Claude: [data-testid="message-bubble"]
5. Generic: main element or role="main"
6. Fallback: document.body.innerText
```

**Data Preparation (background.js prepareDataForUpload):**
- Ensures payload has correct field names: `content`, `plaintext`, or `encryptedContent`
- Handles various input types (strings, arrays, objects)
- Preserves metadata: `title`, `url`, `fileName`, `fileType`, `tags`

**Encryption:**
- Client derives key: `SHA256(userId)` → first 32 bytes as NaCl key
- Uses `tweetnacl` library: `nacl.secretbox(plaintext, nonce, key)`
- Returns: `{ ciphertext: base64, nonce: base64 }`

**HTTP API Handler:**
- Validates Bearer token (must start with `aer_`)
- Extracts userId: `token.substring(4)`
- Queries `internal.users.getUserById(userId)` to verify user
- Calls `internal.contextsInternal.createForUser()` (bound mutation)
- If plaintext but no encrypted content, backend encrypts on server (fallback only)

---

## 3. CHROME EXTENSION - SUMMARY ONLY MODE

### Entry Point
User right-clicks on a page → "Upload AI Summary to Aer"

### Flow Diagram
```
Page Context Menu (background.js)
    ↓
Extract Content (same as full page)
    ↓
Client: Mark as summaryOnly
    ├─ Prepare payload with: { plaintext, summaryOnly: true }
    ├─ Encrypt plaintext on client
    └─ Send to API
    ↓
HTTP POST to /api/context/upload
    ├─ Headers: Authorization: Bearer aer_{userId}
    └─ Body: { summaryOnly: true, plaintext: ..., encryptedContent?: ... }
    ↓
Backend HTTP Handler - summaryOnly Branch (httpApi.ts)
    ├─ Verify token and user (same as full page)
    ├─ Extract plaintext from request
    ├─ Call internal.ai.generateSummary(content, title="")
    │   ├─ Use Perplexity "sonar" model
    │   ├─ Prompt: "reduce low-info tokens, keep technical terms"
    │   ├─ Return 2-3 sentence summary
    │   └─ Fallback: truncate to 500 chars
    ├─ Encrypt summary on server
    ├─ Optionally generate tags from summary
    ├─ Call internal.contextsInternal.createForUser()
    │   └─ Payload:
    │       {
    │         encryptedContent: encSummary,
    │         encryptedSummary: encSummary,
    │         plaintextContent: summary,
    │         tags: computedTags
    │       }
    ├─ Log audit: API_UPLOAD_CONTEXT_SUMMARY_ONLY
    └─ Return { success: true, contextId }
```

### Key Differences from Full Page Upload

| Aspect | Full Page | Summary Only |
|--------|-----------|--------------|
| **Content** | Full extracted text (20KB) | Extracted text → AI-generated summary |
| **Server AI** | No (AI runs in background) | Yes (summary generated in request) |
| **Speed** | Fast (no wait) | Slower (AI processing ~2-5s) |
| **Storage** | Full content encrypted | Summary only (~500 chars) |
| **Tags** | Generated from preview | Generated from summary |
| **Use Case** | Save everything | Digest before saving |

### Summary Generation Pipeline

1. **Extract page content** (same as full page)
2. **Send to backend** with `summaryOnly: true` flag
3. **Backend AI process:**
   - Takes plaintext (up to 6KB)
   - Calls Perplexity "sonar" model with context-reduction prompt
   - Model: "reduce articles, redundant adjectives, filler phrases"
   - Keep: technical terms, numbers, logical operators, key concepts
   - Output: 2-3 concise sentences
4. **Server encrypts summary** using server-side key (for auditing)
5. **Store as context:**
   - `encryptedContent` = encrypted summary
   - `encryptedSummary` = same (redundant but explicit)
   - `plaintextContent` = summary (for AI tag generation)
6. **Tag generation** (optional, async)

---

## Database Schema Storage

### Context Document Structure
```typescript
{
  _id: Id<"contexts">,
  _creationTime: number,
  userId: Id<"users">,                    // owner
  projectId?: Id<"projects">,             // optional project assignment
  
  // Plaintext fields (searchable, NOT sensitive)
  title: string,                          // max 80 chars, computed title
  tags?: string[],                        // AI-generated hierarchical tags
  
  // Encrypted fields (E2E encrypted, only user can decrypt)
  encryptedContent: {
    ciphertext: string,                   // base64 NaCl secretbox
    nonce: string,                        // base64 nonce
  },
  encryptedTitle?: { ciphertext, nonce }, // optional encrypted version of title
  encryptedSummary?: { ciphertext, nonce }, // 2-3 sentence summary
  encryptedMetadata?: { ciphertext, nonce },
  
  // File references (if uploaded via UI)
  fileId?: Id<"_storage">,
  fileName?: string,
  fileType?: string,
  url?: string,                           // source URL (from extension or input)
}
```

---

## Comparison Table

| Feature | Webapp | Full Page (Ext) | Summary (Ext) |
|---------|--------|-----------------|---------------|
| **Input** | Form textarea | Page content | Page content |
| **Client Encryption** | Yes (required) | Yes | Yes |
| **Server Encryption** | No (client-only) | Optional fallback | Yes (summary) |
| **Content Size** | Unlimited | 20KB max | 500 chars (after summary) |
| **AI Processing** | Async background | Async background | Sync (request waits) |
| **Speed** | Instant | Instant | 2-5s |
| **API Used** | `contexts.create` (mutation) | POST `/api/context/upload` | POST `/api/context/upload` + AI |
| **Auth** | Session-based | Bearer token | Bearer token |
| **Audit Trail** | CREATE_CONTEXT | API_UPLOAD_CONTEXT | API_UPLOAD_CONTEXT_SUMMARY_ONLY |

---

## Tag Generation Detail

### Hierarchical Tag Creation
```
Example: "React Hooks in TypeScript"

Prompt to Perplexity:
"Generate 5 hierarchical tags, general to specific:
 Title: React Hooks in TypeScript
 Content: [article snippet...]"

Response might be:
"technology, programming, javascript, react, custom hooks"

Rules:
- Start broad (technology)
- Progress specific (programming → javascript → react)
- End very specific (custom hooks)
- Always lowercase
- 2-3 words max per tag
- Deduplicated, ordered
```

### Tag Count Logic
```javascript
baseTagCount = 3
additionalTags = Math.floor(totalContexts / 50)  // +1 per 50 items
maxTags = Math.min(baseTagCount + additionalTags, 10)  // cap at 10

Example:
- 0-49 contexts: 3 tags
- 50-99 contexts: 4 tags
- 100-149 contexts: 5 tags
- 500+ contexts: 10 tags
```

---

## Encryption Key Derivation

### Client-Side (Extension & Webapp)
```javascript
1. Extract userId from token (aer_{userId})
2. Encode userId as UTF-8 bytes
3. SHA-256 hash
4. Take first 32 bytes as NaCl secretbox key
5. Encrypt content with random nonce + key
6. Return: { ciphertext, nonce } both base64
```

### Server-Side (Fallback only)
```javascript
// Only used if plaintext provided without encrypted field
// Backend has a shared secret server-side encryption key
// Used for audit/compliance purposes (user still owns key client-side)
```

---

## Error Handling

### Upload Validation Errors
- **Missing content**: "Missing content: provide 'content' or 'encryptedContent'"
- **Invalid token**: "Invalid token format" (must start with "aer_")
- **User not found**: "Invalid authentication token"
- **Missing encrypted fields**: "Missing encrypted content"

### AI Processing Failures (Graceful Degradation)
- **Tag generation fails**: Falls back to frequency analysis (most common 3-6 words)
- **Summary generation fails**: Falls back to truncated content (first 500 chars)
- **Title refinement fails**: Uses computed title (first line of content)

---

## Privacy & Security Notes

1. **Client-side encryption**: Content never visible to server in plaintext (for normal flow)
2. **Plaintext preview**: Backend sees plaintext only if:
   - Provided explicitly for AI enrichment
   - Deleted after processing (not stored)
3. **Audit logging**: Tracks action, resource type, success status (no content)
4. **Storage quota**: Bytes counted from ciphertext length (rough estimation)
5. **Token format**: `aer_{userId}` is a simple bearer token (can be revoked per-token in future)

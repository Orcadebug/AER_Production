# Aer Deployment Guide: Self‑Host on Vercel + Convex

This guide walks you from a fresh repo to a fully self‑hosted Aer deployment on your own Vercel + Convex, plus extension and (optional) data migration. Follow in order. Safe rollback steps included.

---

## 0) Prerequisites

Accounts
- GitHub
- Vercel
- Convex (https://dashboard.convex.dev)
- Google Cloud (for OAuth; optional)
- Resend (for email OTP; optional)
- OpenAI / Perplexity (optional AI features)

Local tools
- Node 18+ (LTS recommended)
- pnpm (preferred), or npm

---

## 1) Repository

- Create a private GitHub repo and push the project codebase.

Optional local sanity check
- pnpm i
- pnpm dev
- App should launch locally (auth will point to Convex once configured).

---

## 2) Create Your Convex Project (Backend)

- In Convex Dashboard → New Project.
- Copy your Convex site URL: it looks like:
  - https://your-xxxxx.convex.site

Set Convex environment variables (Dashboard → Settings → Environment Variables)
- PERPLEXITY_API_KEY (if using AI tags/search)
- OPENAI_API_KEY (optional)
- RESEND_API_KEY (optional; email OTP)
- Any others you plan to use

Deploy
- In the Convex dashboard, click “Deploy” (or run `npx convex deploy` locally if using CLI).
- Confirm the following HTTP endpoints exist (they’re POST-only):
  - /api/context/upload
  - /api/context/batch-upload
  - /api/mcp

Update auth domain in code
- Edit src/convex/auth.config.ts:
  - Set providers[0].domain = "https://your-xxxxx.convex.site"
- Commit & push.

Notes
- Auth routes are added by src/convex/http.ts via `auth.addHttpRoutes(http);`

---

## 3) Configure Vercel (Frontend)

- Import your GitHub repo into Vercel.
- Build settings:
  - Install: pnpm i
  - Build: pnpm build
  - Output: dist
- Environment variables (Vercel → Project → Settings → Environment Variables):
  - If your app references it, set: VITE_CONVEX_URL=https://your-xxxxx.convex.site
  - Do not put secrets in client env vars.
- Deploy the project.
- Open your Vercel URL and ensure the app loads.

Google OAuth (optional)
- Create OAuth client in Google Cloud.
- Follow Convex Auth provider setup for Google; add Client ID/Secret in Convex (not in Vercel).
- Ensure allowed redirect origins/URLs match Convex’s auth routes (Convex dashboard will guide you).

---

## 4) Chrome Extension Cutover

Update API endpoint in the extension:
- In chrome-extension/background.js, set:
  - const AER_API_ENDPOINT = "https://your-xxxxx.convex.site/api/context/upload";

Manifest permissions:
- Ensure manifest.json includes:
  - "permissions": ["activeTab", "storage", "contextMenus", "notifications", "cookies"]
  - "host_permissions": ["https://*/*", "http://*/*"] (this already covers your Convex site)

Load/reload the extension:
- Go to chrome://extensions
- Enable Developer Mode
- Load unpacked → select chrome-extension folder
- Reload extension after changes

Auth token for uploads:
- The API expects Bearer tokens in the form: aer_{userId}
- Get your userId:
  - Sign into your app (on your Convex/Vercel)
  - Open Convex Dashboard → Data → users → copy the _id for your user
  - Token is: aer_<that _id>
- Save the token in the extension (its settings UI or the field you use) and test uploads.

Notes
- “MCP route not found” warnings during GET/OPTIONS checks are expected; /api/mcp is POST-only and not used by the extension.
- “Content script not available” happens on chrome:// pages or domains without site access. Test on a normal https:// page.

---

## 5) Optional: Data Migration

Export from old deployment
- From the old backend, run:
  - npx convex run contexts:exportAllContexts '{"format":"json"}'
- This returns a JSON with all contexts (encrypted content is preserved).

Import to your new deployment
- Ensure your target user exists in the new Convex (sign in once).
- Build a Bearer token with the new userId: aer_{newUserId}
- Use the batch endpoint:
  - POST https://your-xxxxx.convex.site/api/context/batch-upload
  - Headers:
    - Authorization: Bearer aer_{newUserId}
    - Content-Type: application/json
  - Body:
    {
      "contexts": [
        {
          "title": "My Note",
          "type": "note",
          "plaintext": "Optional plaintext for AI tags",
          "encryptedContent": { "ciphertext": "...", "nonce": "..." },
          "encryptedTitle": { "ciphertext": "...", "nonce": "..." },
          "encryptedSummary": { "ciphertext": "...", "nonce": "..." },
          "encryptedMetadata": { "ciphertext": "...", "nonce": "..." }
        }
      ]
    }

Notes
- Items uploaded with plaintext fallback (“nonce”: "plain") will remain viewable but are not end‑to‑end encrypted. You can re-encrypt client-side later.

---

## 6) Verification Checklist

App on Vercel
- Sign in (password and/or Google).
- Create a note and upload a file; see them in Dashboard.
- Tags appear over time if AI keys are set (Perplexity/OpenAI).

Extension
- Set token aer_{userId} for your new Convex.
- Right-click selection → “Upload to Aer” (or your action).
- Confirm items appear in Dashboard.

Convex logs
- Check Convex logs for any errors and audit events.

---

## 7) Cutover + Rollback

Cutover
- After verifying, keep the old setup up for a short overlap.
- Publish updated extension build (if using Web Store) pointing to your Convex.
- Decommission the old environment when done.

Rollback
- If anything fails, point the extension back to the old endpoint and re-deploy the old frontend while you fix the new setup.

---

## 8) Troubleshooting

401 Unauthorized on upload
- Ensure Authorization header is exactly: "Bearer aer_{userId}" and the user exists in your new Convex.

Content script not available
- Happens on chrome://, internal pages, or blocked domains. Test on standard https:// sites and ensure Site Access is allowed in the extension settings.

MCP route warnings
- /api/mcp is POST-only; GET/OPTIONS probes will fail. Not related to upload success.

No contexts visible
- Check Convex function push errors (compile issues block deploys).
- Run: “npx convex dev --once && npx tsc -b --noEmit” locally to see compile errors if needed.

Email OTP not working
- Set RESEND_API_KEY in Convex env vars.

AI features not working
- Set PERPLEXITY_API_KEY and/or OPENAI_API_KEY in Convex env vars.

---

## 9) Minimal Code Changes You Will Make (When Ready)

- src/convex/auth.config.ts
  - providers[0].domain = "https://your-xxxxx.convex.site"

- chrome-extension/background.js
  - AER_API_ENDPOINT = "https://your-xxxxx.convex.site/api/context/upload"

Commit and redeploy (Vercel deploy + extension reload).

---

All set! Follow the steps above and you’ll run Aer entirely on your own Convex + Vercel stack without relying on vly.ai.

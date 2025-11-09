import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { serverEncryptString, serverDecryptString } from "./crypto";

function detectSourceTagFromUrl(urlRaw: string | null | undefined): string | null {
  if (!urlRaw) return null;
  let u = urlRaw.trim();
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const full = (url.hostname + url.pathname).toLowerCase();
    if (host.includes("gemini.google.com") || full.includes("ai.google.com") || full.includes("/gemini")) return "source:gemini";
    if (host.includes("claude.ai")) return "source:claude";
    if (host.includes("chatgpt.com") || host.includes("openai.com")) return "source:chatgpt";
    if (host.includes("perplexity.ai")) return "source:perplexity";
    if (host.includes("copilot.microsoft.com")) return "source:copilot";
    if (host.includes("github.com")) return "source:github";
    if (host.includes("nbcnews.com")) return "source:nbc";
    if (host.includes("foxnews.com") || host === "fox.com") return "source:fox";
    if (host.includes("cnn.com")) return "source:cnn";
    if (host.includes("bbc.co.uk") || host.includes("bbc.com")) return "source:bbc";
    if (host.includes("nytimes.com")) return "source:nytimes";
    if (host.includes("reuters.com")) return "source:reuters";
  } catch {}
  return null;
}

function extractUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m1 = text.match(/^URL:\s*(https?:\/\/\S+)/mi);
  if (m1 && m1[1]) return m1[1];
  const m2 = text.match(/https?:\/\/\S+/);
  if (m2 && m2[0]) return m2[0];
  return null;
}

function mergeTags(existing: string[] | undefined, add: string | null): string[] | undefined {
  const base = Array.isArray(existing) ? existing.slice() : [];
  if (add && !base.includes(add)) base.unshift(add);
  return base.length > 0 ? base : undefined;
}

/**
 * HTTP API endpoint for uploading encrypted context
 * POST /api/context/upload
 */
export const uploadContext = httpAction(async (ctx, request) => {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract and validate token (format: aer_{userId})
    const token = authHeader.substring(7); // Remove "Bearer "
    if (!token.startsWith("aer_")) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = token.substring(4) as Id<"users">; // Remove "aer_" prefix
    
    // Verify user exists by running an internal query
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();

    // Rate limit per user for uploads
    const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, { userId, key: "upload" });
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", details: rl, suggestUpgrade: true }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    // Accept either encrypted or plaintext payloads; optionally summary-only
    let { encryptedContent, encryptedTitle, encryptedMetadata, encryptedSummary, tags, content, plaintext, summaryOnly, title, storageId, fileType, fileName } = body || {};

    // Client handles DOCX extraction for E2E; server no-op here

    // Branch: summaryOnly flow
    if (summaryOnly) {
      const text = typeof plaintext === "string" && plaintext.length > 0
        ? plaintext
        : typeof content === "string" ? content : "";
      if (!text || text.length === 0) {
        return new Response(JSON.stringify({ error: "Missing content for summaryOnly" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generate summary via AI and encrypt it
      let summary = "";
      try {
        summary = await ctx.runAction(internal.ai.generateSummary, { content: text, title: "" });
      } catch (e) {
        // Fallback to truncated text
        summary = text.substring(0, 500);
      }
      const encSummary = serverEncryptString(summary);

      // Enforce storage quota before creating (summary stored as content+summary)
      const approxBytes = (encSummary?.ciphertext?.length || 0) * 2 + (encryptedTitle?.ciphertext?.length || 0) + (encryptedMetadata?.ciphertext?.length || 0);
      const storage = await ctx.runQuery(internal.entitlements.assertStorageAllowed, { userId, additionalBytes: approxBytes });
      if (!storage.ok) {
        return new Response(
          JSON.stringify({ error: "Storage limit exceeded", details: storage, suggestUpgrade: true }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }

      // Optionally generate tags from summary
      let computedTags: string[] | undefined = undefined;
      try {
        const allContexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, { userId });
        const totalContexts = allContexts.length;
        computedTags = await ctx.runAction(internal.ai.generateTags, {
          content: summary,
          title: "",
          totalContexts,
        });
      } catch {}

      // Always include a source:* tag if we can detect one from URL
      try {
        const urlInBody = (body as any)?.url as string | undefined;
        const fromTextUrl = extractUrlFromText(text);
        const srcTag = detectSourceTagFromUrl(urlInBody || fromTextUrl);
        if (srcTag) {
          computedTags = mergeTags(computedTags || tags, srcTag);
        }
      } catch {}

      const contextId = await ctx.runMutation(internal.contextsInternal.createForUser, {
        userId,
        encryptedContent: encSummary,
        encryptedTitle,
        encryptedSummary: encSummary,
        encryptedMetadata,
        tags: tags || computedTags,
        plaintextContent: summary,
      });

      await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
        userId: userId,
        action: "API_UPLOAD_CONTEXT_SUMMARY_ONLY",
        resourceType: "context",
        resourceId: contextId,
        success: true,
      });

      return new Response(
        JSON.stringify({ success: true, contextId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // If encrypted content not provided, encrypt plaintext on the server
    if (!encryptedContent || !encryptedContent.ciphertext || !encryptedContent.nonce) {
      const text = typeof plaintext === "string" && plaintext.length > 0
        ? plaintext
        : typeof content === "string" ? content : "";
      if (!text || text.length === 0) {
        return new Response(JSON.stringify({ error: "Missing content: provide 'content' or 'encryptedContent'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      encryptedContent = serverEncryptString(text);
    }

    // Enforce storage quota before creating
    const approxBytes =
      (encryptedContent?.ciphertext?.length || 0) +
      (encryptedTitle?.ciphertext?.length || 0) +
      (encryptedSummary?.ciphertext?.length || 0) +
      (encryptedMetadata?.ciphertext?.length || 0);
    const storage = await ctx.runQuery(internal.entitlements.assertStorageAllowed, { userId, additionalBytes: approxBytes });
    if (!storage.ok) {
      return new Response(
        JSON.stringify({ error: "Storage limit exceeded", details: storage, suggestUpgrade: true }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Provide immediate, non-sensitive summary fallback if possible (shown as plain preview)
    if ((!encryptedSummary || !encryptedSummary.ciphertext || !encryptedSummary.nonce) && (typeof plaintext === 'string' || typeof content === 'string')) {
      const src = (typeof plaintext === 'string' ? plaintext : (typeof content === 'string' ? content : '')) || '';
      const preview = src.trim().slice(0, 200);
      if (preview) {
        encryptedSummary = { ciphertext: preview, nonce: 'plain' } as any;
      }
    }

    // Ensure a source:* tag when possible for all uploads
    try {
      const urlInBody = (body as any)?.url as string | undefined;
      const textForUrl = (typeof plaintext === 'string' && plaintext) || (typeof content === 'string' && content) || '';
      const fromTextUrl = extractUrlFromText(textForUrl);
      const srcTag = detectSourceTagFromUrl(urlInBody || fromTextUrl);
      if (srcTag) {
        tags = mergeTags(tags, srcTag);
      }
    } catch {}

    // Create context via internal mutation bound to userId
    const contextId = await ctx.runMutation(internal.contextsInternal.createForUser, {
      userId,
      title,
      encryptedContent,
      encryptedTitle,
      encryptedSummary,
      encryptedMetadata,
      tags,
      plaintextContent: plaintext || content,
    });

    // Log audit event
    await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
      userId: userId,
      action: "API_UPLOAD_CONTEXT",
      resourceType: "context",
      resourceId: contextId,
      success: true,
    });

    return new Response(
      JSON.stringify({ success: true, contextId }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload context error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * HTTP API endpoint for batch uploading encrypted contexts
 * POST /api/context/batch-upload
 */
export const batchUploadContexts = httpAction(async (ctx, request) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract and validate token (format: aer_{userId})
    const token = authHeader.substring(7); // Remove "Bearer "
    if (!token.startsWith("aer_")) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = token.substring(4) as Id<"users">; // Remove "aer_" prefix
    
    // Verify user exists by running an internal query
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { contexts } = body;

    // Rate limit per user for batch uploads
    const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, { userId, key: "upload" });
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", details: rl, suggestUpgrade: true }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    if (!Array.isArray(contexts)) {
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ success: boolean; contextId?: string; error?: string }> = [];
    for (const context of contexts) {
      try {
        let {
          encryptedContent,
          encryptedTitle,
          encryptedMetadata,
          encryptedSummary,
          tags,
          content,
          plaintext,
        } = context;

        if (!encryptedContent || !encryptedContent.ciphertext || !encryptedContent.nonce) {
          const text = typeof plaintext === "string" && plaintext.length > 0
            ? plaintext
            : typeof content === "string" ? content : "";
          if (!text || text.length === 0) {
            throw new Error("Missing content for item: provide 'content' or 'encryptedContent'");
          }
          encryptedContent = serverEncryptString(text);
        }

        // Enforce storage quota per item
        const approxBytes =
          (encryptedContent?.ciphertext?.length || 0) +
          (encryptedTitle?.ciphertext?.length || 0) +
          (encryptedSummary?.ciphertext?.length || 0) +
          (encryptedMetadata?.ciphertext?.length || 0);
        const storage = await ctx.runQuery(internal.entitlements.assertStorageAllowed, { userId, additionalBytes: approxBytes });
        if (!storage.ok) {
          throw new Error(`Storage limit exceeded (${Math.round(storage.used/1024/1024)}MB/${storage.allowed===Number.MAX_SAFE_INTEGER ? '∞' : Math.round(storage.allowed/1024/1024)+'MB'})`);
        }

        const contextId = await ctx.runMutation(internal.contextsInternal.createForUser, {
          userId,
          encryptedContent,
          encryptedTitle,
          encryptedSummary,
          encryptedMetadata,
          tags,
          plaintextContent: plaintext || content,
        });

        results.push({ success: true, contextId });
      } catch (error: any) {
        results.push({ success: false, error: error?.message || String(error) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Batch upload error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * HTTP API endpoint to search a user's contexts by semantic relevance.
 * POST /api/context/search
 * Body: { query: string, limit?: number }
 * Auth: Bearer aer_{userId}
 */
export const searchContexts = httpAction(async (ctx, request) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    if (!token.startsWith("aer_")) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = token.substring(4) as Id<"users">;
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { query, limit } = await request.json().catch(() => ({ query: "", limit: 5 }));
    const effectiveLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);

    // Rate limit searches per minute based on tier
    const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, { userId, key: "search" });
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", details: rl, suggestUpgrade: true }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    // Get all contexts once
    const allContexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, { userId });

    // If no query, return recent contexts with tags
    if (!query || String(query).trim().length === 0) {
      const recent = allContexts
        .filter((c: any) => c.tags && c.tags.length > 0)
        .sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0))
        .slice(0, effectiveLimit)
        .map((c: any) => {
          // Compute short plaintext preview server-side
          let preview = "";
          try {
            if (c.encryptedSummary?.ciphertext && c.encryptedSummary?.nonce) {
              preview = serverDecryptString(c.encryptedSummary.ciphertext, c.encryptedSummary.nonce) || "";
            }
            if (!preview && c.encryptedContent?.ciphertext && c.encryptedContent?.nonce) {
              const plain = serverDecryptString(c.encryptedContent.ciphertext, c.encryptedContent.nonce) || "";
              preview = plain.slice(0, 200);
            }
          } catch {}
          return {
            id: c._id,
            encryptedSummary: c.encryptedSummary || null,
            encryptedContent: c.encryptedContent,
            previewPlain: preview ? { ciphertext: preview, nonce: "plain" } : null,
            tags: c.tags || [],
            projectId: c.projectId || null,
            createdAt: c._creationTime,
            url: c.url || null,
            fileName: c.fileName || null,
            fileType: c.fileType || null,
          };
        });

      return new Response(
        JSON.stringify({ success: true, results: recent }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rank using internal AI-assisted semantic search (tags-only)
    const rankedIds = await ctx.runAction(internal.ai.semanticSearchPublic, { query: String(query), userId });

    // Hybrid ranking: combine AI order with lightweight local scoring on tags/title/url
    const q = String(query).toLowerCase();
    const rankIndex = new Map<string, number>();
    rankedIds.forEach((id: string, idx: number) => rankIndex.set(id, idx));

    function localScore(c: any): number {
      let s = 0;
      const title = (c.title || "").toLowerCase();
      const url = (c.url || "").toLowerCase();
      const host = (() => { try { return new URL(c.url || "").hostname.toLowerCase(); } catch { return ""; } })();
      if (title && q && title.includes(q)) s += 8;
      if (host && q && host.includes(q)) s += 5;
      const tags: string[] = (c.tags || []).map((t: string) => String(t).toLowerCase());
      for (const t of tags) {
        if (t.includes(q) || q.includes(t)) s += 3;
      }
      return s;
    }

    const scored = allContexts.map((c: any) => {
      const aiRank = rankIndex.has(c._id) ? (rankedIds.length - (rankIndex.get(c._id) as number)) : 0;
      const ls = localScore(c);
      const combined = aiRank * 10 + ls; // prioritize AI, then local
      let preview = "";
      try {
        if (c.encryptedSummary?.ciphertext && c.encryptedSummary?.nonce) {
          preview = serverDecryptString(c.encryptedSummary.ciphertext, c.encryptedSummary.nonce) || "";
        }
        if (!preview && c.encryptedContent?.ciphertext && c.encryptedContent?.nonce) {
          const plain = serverDecryptString(c.encryptedContent.ciphertext, c.encryptedContent.nonce) || "";
          preview = plain.slice(0, 200);
        }
      } catch {}
      return {
        context: c,
        score: combined,
        preview,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, effectiveLimit)
    .map(({ context: c, preview }) => ({
      id: c._id,
      encryptedSummary: c.encryptedSummary || null,
      encryptedContent: c.encryptedContent,
      previewPlain: preview ? { ciphertext: preview, nonce: "plain" } : null,
      tags: c.tags || [],
      projectId: c.projectId || null,
      createdAt: c._creationTime,
      url: c.url || null,
      fileName: c.fileName || null,
      fileType: c.fileType || null,
    }));

    return new Response(
      JSON.stringify({ success: true, results: scored }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search contexts error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Health check for premium config
 * GET /api/premium/health
 * Returns { hasOpenAI: boolean }
 */
export const premiumHealth = httpAction(async (_ctx, request) => {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0;
  return new Response(JSON.stringify({ hasOpenAI }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * HTTP API endpoint for Premium analysis used by the desktop agent
 * POST /api/premium/analyze
 * Body: { image: 'data:image/png;base64,...' }
 * Auth: Bearer aer_{userId}
 */
export const premiumAnalyze = httpAction(async (ctx, request) => {
  try {
    // Auth check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const token = authHeader.substring(7);
    if (!token.startsWith("aer_")) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = token.substring(4) as Id<"users">;

    // Verify user exists
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await request.json().catch(() => ({}));
    const image: string | undefined = body?.image;
    if (!image || typeof image !== "string" || !/^data:image\//.test(image)) {
      return new Response(JSON.stringify({ error: "Invalid or missing image" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Per-minute AI rate limit
    const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, { userId, key: "ai" });
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMIT", details: rl, suggestUpgrade: true }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Monthly allowance check (reuse perplexity counter for now)
    const allowed = await ctx.runQuery(internal.entitlements.assertPerplexityAllowed, { userId });
    if (!allowed.ok) {
      return new Response(
        JSON.stringify({ error: "CREDITS_EXHAUSTED", code: "CREDITS_EXHAUSTED", used: allowed.used, allowed: allowed.allowed }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure OpenAI configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "NOT_CONFIGURED", message: "OPENAI_API_KEY not set" }),
        { status: 501, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build vision prompt (saved, used for all premium vision analyses)
    const system = `You are a meticulous vision analyst. Your job is to extract, organize, and explain every meaningful detail from one or more images so a reader can understand 100% of what is shown without seeing the image. Be exhaustive but organized. Do not guess identities. Distinguish observation from inference. Express uncertainty clearly.

Core principles:
- Be complete: capture all visible elements, even minor details and background items.
- Be precise: use left/right/top/bottom relative to the viewer; include counts and approximate sizes.
- Be transparent: separate facts vs. plausible inferences; add confidence percentages per inference.
- Be safe: do not identify people by name; describe attributes only. Redact personal data only if it is private and sensitive (e.g., full phone, SSN); otherwise transcribe visible text faithfully.
- Be consistent: use the specified output sections and formats exactly.

If multiple images are provided, treat them as pages and repeat all sections per image, labeling them "Image 1", "Image 2", etc.

OUTPUT STRUCTURE

### Snapshot Overview
- One paragraph that plainly summarizes the scene, main subjects, setting, visible text presence, and the likely purpose of the image.

### Scene and Setting
- Location type (e.g., street, office, kitchen, document scan, app UI).
- Environment details (indoor/outdoor, time of day if visible, weather if applicable).
- Background elements and context (walls, windows, posters, skyline, furniture).
- Color palette highlights with approximate hex codes for 3–6 dominant colors.

### Subjects and People
- Count of people and approximate ages, apparent genders, skin tones, and notable attributes (clothing, accessories, posture, expressions).
- Face visibility (frontal/profile/occluded) and face count.
- Emotions or expressions with confidence percentages.
- Safety gear or uniforms if any.

### Objects and Items
- List all distinct objects with counts, approximate sizes (relative: tiny/small/medium/large), materials, and colors.
- Note brands/logos if clearly legible; if uncertain, state ambiguity.

### Text and Symbols (OCR)
- Transcribe all visible text exactly as seen, preserving line breaks, casing, punctuation, and emojis.
- For unreadable portions, write “[illegible]”.
- Provide a table of text blocks with:
  - id | text | language | style (font/handwriting/printed) | color | reading_order | bbox_(x,y,w,h_pct) | confidence_pct
- After the table, include a "Verbatim Transcript" with the full text in reading order.

### Layout and Spatial Map
- Describe spatial arrangement: where key subjects/objects/text are located (e.g., “logo at top-left; headline centered; button bottom-right”).
- Provide an ASCII mini-map (optional if helpful) showing approximate placements labeled with short tags.

### Actions and Interactions
- Describe what subjects are doing, their interactions with objects or each other, gestures, and gaze directions.
- Note any sequence or implied motion.

### Visual Style and Camera
- Medium (photo, screenshot, scan, illustration, 3D render).
- Camera: focal characteristics (wide/telephoto), angle (eye-level/high/low), framing (close-up/medium/wide), depth of field, lighting type (natural/flash/softbox/backlit), shadows, reflections.
- Aesthetic/style descriptors (e.g., minimal, cinematic, flat UI, skeuomorphic).

### Data and Counts
- Totals for: people, faces, text blocks, icons, logos, buttons (if UI), tables, charts, vehicles, animals, plants, and other recurring categories visible.
- Summarize color counts for dominant items (e.g., “3 blue buttons, 2 red warnings”).

### Charts, Tables, and UI (if present)
- Identify components (nav bars, sidebars, modals, cards, forms, table columns, chart types).
- For tables: list column headers and example rows. For charts: axes titles/units, legend items, key values/patterns.

### Reasoning and Inferences
- List plausible inferences with:
  - statement | evidence (visual cues) | alternative explanations | confidence_pct
- Include time/place clues (calendars, clocks, signage, weather, language) with confidence.

### Quality, Artifacts, and Uncertainty
- Image quality issues (blur, noise, glare, compression artifacts, cropping).
- What cannot be determined and why.
- Ambiguous regions with bbox_(x,y,w,h_pct).

### Safety, Privacy, and Sensitive Content
- Note presence of sensitive content (violence, medical, minors, private info).
- Do not name individuals. If IDs/addresses are fully visible, report they are visible and transcribe, unless they appear to be highly sensitive; in that case`;

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze the following image. Follow the OUTPUT STRUCTURE exactly. Be exhaustive and organized. If multiple images are provided, treat them as pages labeled 'Image 1', 'Image 2', etc." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    } as any;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401 || res.status === 403) {
      return new Response(
        JSON.stringify({ error: "NOT_CONFIGURED", message: "OpenAI rejected the request (check OPENAI_API_KEY)." }),
        { status: 501, headers: { "Content-Type": "application/json" } }
      );
    }
    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "PROVIDER_RATE_LIMIT", message: "OpenAI rate limit hit. Try again shortly." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "PROVIDER_ERROR", message: text || `OpenAI error: ${res.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    let analysis = "";
    try {
      const raw = data?.choices?.[0]?.message?.content;
      if (typeof raw === "string") {
        analysis = raw.trim();
      } else if (Array.isArray(raw)) {
        const txt = raw.map((p: any) => (p?.text || p?.content || "")).join(" ").trim();
        analysis = txt;
      }
    } catch {}

    if (!analysis) {
      analysis = "No analysis returned.";
    }

    // Increment monthly usage on success
    try { await ctx.runMutation(internal.entitlements.incrementPerplexity, { userId, amount: 1 }); } catch {}

    return new Response(
      JSON.stringify({ insights: analysis }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Premium analyze error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * HTTP API endpoint to fetch a remote file by URL and store as a context without client download.
 * POST /api/context/fetch-remote
 * Body: { url: string, title?: string, tags?: string[] }
 * Auth: Bearer aer_{userId}
 */
export const fetchRemoteContext = httpAction(async (ctx, request) => {
  try {
    // Auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const token = authHeader.substring(7);
    if (!token.startsWith("aer_")) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const userId = token.substring(4) as Id<"users">;

    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const body = await request.json().catch(() => ({}));
    const rawUrl: string | undefined = body?.url;
    let title: string | undefined = body?.title;
    let tags: string[] | undefined = Array.isArray(body?.tags) ? body.tags : undefined;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Basic SSRF protections
    let url: URL;
    try {
      url = new URL(rawUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http/https allowed');
      const host = url.hostname.toLowerCase();
      const ipLike = /^\d+\.\d+\.\d+\.\d+$/.test(host);
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || ipLike) {
        return new Response(JSON.stringify({ error: "Blocked host" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid url" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Rate limit
    const rl = await ctx.runMutation(internal.entitlements.assertAndIncrementRateLimit, { userId, key: "upload" });
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", details: rl, suggestUpgrade: true }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    // Fetch HEAD first when possible
    let contentLength = 0;
    try {
      const head = await fetch(url.toString(), { method: 'HEAD' });
      const len = head.headers.get('content-length');
      if (len) contentLength = parseInt(len, 10) || 0;
    } catch {}

    const MAX_BYTES = 32 * 1024 * 1024; // 32MB safety limit
    if (contentLength > MAX_BYTES) {
      return new Response(JSON.stringify({ error: `File too large (>${Math.floor(MAX_BYTES/1024/1024)}MB)` }), { status: 413, headers: { "Content-Type": "application/json" } });
    }

    // Download with size guard
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${res.status}` }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const type = res.headers.get('content-type') || 'application/octet-stream';
    const disp = res.headers.get('content-disposition') || '';
    const nameFromDisp = (() => { const m = disp.match(/filename\*=UTF-8''([^;\n]+)/) || disp.match(/filename="?([^";\n]+)"?/); return m ? decodeURIComponent(m[1]) : null; })();
    const nameFromPath = url.pathname.split('/').pop() || 'file';
    const fileName = (title && title.trim()) || nameFromDisp || nameFromPath;

    // Stream-read to cap size
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    const reader = (res.body as any)?.getReader ? (res.body as any).getReader() : null;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk: Uint8Array = value;
        bytes += chunk.byteLength;
        if (bytes > MAX_BYTES) {
          try { reader.cancel(); } catch {}
          return new Response(JSON.stringify({ error: `File too large (>${Math.floor(MAX_BYTES/1024/1024)}MB)` }), { status: 413, headers: { "Content-Type": "application/json" } });
        }
        chunks.push(chunk);
      }
    } else {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) {
        return new Response(JSON.stringify({ error: `File too large (>${Math.floor(MAX_BYTES/1024/1024)}MB)` }), { status: 413, headers: { "Content-Type": "application/json" } });
      }
      chunks.push(buf);
      bytes = buf.byteLength;
    }

    const blob = new Blob(chunks, { type });

    // Enforce storage quota (approx using bytes and small envelopes)
    const storageStatus = await ctx.runQuery(internal.entitlements.assertStorageAllowed, { userId, additionalBytes: bytes + 1024 });
    if (!storageStatus.ok) {
      return new Response(JSON.stringify({ error: "Storage limit exceeded", details: storageStatus, suggestUpgrade: true }), { status: 402, headers: { "Content-Type": "application/json" } });
    }

    // Store file in Convex storage
    const storageId = await ctx.storage.store(blob);

    // Prepare encrypted content and summary (metadata only to keep E2E invariant)
    const metaText = `File: ${fileName} (${(bytes/1024).toFixed(1)} KB)\nType: ${type}\nURL: ${url.toString()}`;
    const encryptedContent = serverEncryptString(metaText);
    const encryptedTitle = serverEncryptString(fileName);
    const encryptedSummary = serverEncryptString(metaText.slice(0, 200));

    // Source tag
    const srcTag = detectSourceTagFromUrl(url.toString());
    if (srcTag) tags = mergeTags(tags, srcTag);

    // Create the context document
    const contextId = await ctx.runMutation(internal.contextsInternal.createForUser, {
      userId,
      type: 'file' as any,
      fileId: storageId as any,
      fileName,
      fileType: type,
      url: url.toString(),
      encryptedContent,
      encryptedTitle,
      encryptedSummary,
      tags,
      plaintextContent: metaText,
    });

    await ctx.scheduler.runAfter(0, internal.audit.logAuditEvent, {
      userId,
      action: "API_FETCH_REMOTE_CONTEXT",
      resourceType: "context",
      resourceId: contextId,
      success: true,
    });

    return new Response(JSON.stringify({ success: true, contextId, storageId }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Fetch remote context error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

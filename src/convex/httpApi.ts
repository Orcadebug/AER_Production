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

import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { serverEncryptString, serverDecryptString } from "./crypto";

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

    // Accept either encrypted or plaintext payloads; optionally summary-only
    let { encryptedContent, encryptedTitle, encryptedMetadata, encryptedSummary, tags, content, plaintext, summaryOnly, title } = body || {};

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

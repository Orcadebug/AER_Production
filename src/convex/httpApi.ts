import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { serverEncryptString } from "./crypto";

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

    // Accept either encrypted or plaintext payloads
    let { encryptedContent, encryptedTitle, encryptedMetadata, encryptedSummary, tags, content, plaintext } = body || {};

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
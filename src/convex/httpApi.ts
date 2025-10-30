import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
    const {
      title,
      content,
      plaintext,
      type,
      encryptedContent,
      encryptedTitle,
      encryptedMetadata,
      encryptedSummary,
    } = body;

    // Prepare encrypted fields with a graceful fallback if client didn't send them
    let encContent = encryptedContent as { ciphertext: string; nonce: string } | undefined;
    let encTitle = encryptedTitle as { ciphertext: string; nonce: string } | undefined;
    let encSummary = encryptedSummary as { ciphertext: string; nonce: string } | undefined;

    // Accept plaintext content from either 'content' or 'plaintext' field
    const plaintextContent = plaintext || content;

    // If encrypted content is missing, but plaintext content exists, wrap it in a fallback envelope
    if (!encContent || !encContent.ciphertext || !encContent.nonce) {
      if (typeof plaintextContent === "string" && plaintextContent.length > 0) {
        const summary =
          plaintextContent.length > 200 ? plaintextContent.slice(0, 200).trim() + "..." : plaintextContent.trim();

        // Fallback "encryption" envelope so the server can accept and store.
        // Note: Not truly encrypted. This is a temporary compatibility layer.
        encContent = { ciphertext: plaintextContent, nonce: "plain" };
        encTitle =
          encTitle ||
          (title ? { ciphertext: String(title), nonce: "plain" } : undefined);
        encSummary =
          encSummary || { ciphertext: summary, nonce: "plain" };
      } else {
        return new Response(JSON.stringify({ error: "Missing content (provide either 'content', 'plaintext', or 'encryptedContent')" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Create context via mutation (now also passing encryptedSummary + plaintextContent if provided)
    const contextId = await ctx.runMutation(api.contexts.create, {
      title: title || "Untitled",
      type: type || "note",
      encryptedContent: encContent,
      encryptedTitle: encTitle,
      encryptedSummary: encSummary,
      encryptedMetadata,
      plaintextContent: typeof plaintextContent === "string" ? plaintextContent : undefined,
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
        const {
          title,
          content,
          plaintext,
          type,
          encryptedContent,
          encryptedTitle,
          encryptedMetadata,
          encryptedSummary,
        } = context;

        let encContent = encryptedContent as { ciphertext: string; nonce: string } | undefined;
        let encTitle = encryptedTitle as { ciphertext: string; nonce: string } | undefined;
        let encSummary = encryptedSummary as { ciphertext: string; nonce: string } | undefined;

        const plaintextContent = plaintext || content;

        if (!encContent || !encContent.ciphertext || !encContent.nonce) {
          if (typeof plaintextContent === "string" && plaintextContent.length > 0) {
            const summary =
              plaintextContent.length > 200 ? plaintextContent.slice(0, 200).trim() + "..." : plaintextContent.trim();

            encContent = { ciphertext: plaintextContent, nonce: "plain" };
            encTitle =
              encTitle ||
              (title ? { ciphertext: String(title), nonce: "plain" } : undefined);
            encSummary =
              encSummary || { ciphertext: summary, nonce: "plain" };
          } else {
            throw new Error("Missing content (provide either 'content', 'plaintext', or 'encryptedContent')");
          }
        }

        const contextId = await ctx.runMutation(api.contexts.create, {
          title: title || "Untitled",
          type: type || "note",
          encryptedContent: encContent,
          encryptedTitle: encTitle,
          encryptedSummary: encSummary,
          encryptedMetadata,
          plaintextContent: typeof plaintextContent === "string" ? plaintextContent : undefined,
        });

        results.push({ success: true, contextId });
      } catch (error) {
        results.push({ success: false, error: String(error) });
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
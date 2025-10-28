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
    const { title, content, type, encryptedContent, encryptedTitle, encryptedMetadata } = body;

    // Validate required fields
    if (!encryptedContent || !encryptedContent.ciphertext || !encryptedContent.nonce) {
      return new Response(
        JSON.stringify({ error: "Missing encrypted content" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create context via mutation
    const contextId = await ctx.runMutation(api.contexts.create, {
      title: title || "Untitled",
      type: type || "note",
      encryptedContent,
      encryptedTitle,
      encryptedMetadata,
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

    const results = [];
    for (const context of contexts) {
      try {
        const contextId = await ctx.runMutation(api.contexts.create, {
          title: context.title || "Untitled",
          type: context.type || "note",
          encryptedContent: context.encryptedContent,
          encryptedTitle: context.encryptedTitle,
          encryptedMetadata: context.encryptedMetadata,
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
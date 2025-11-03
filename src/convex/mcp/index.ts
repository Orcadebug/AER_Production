import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * MCP HTTP Endpoint
 * Exposes MCP tools via HTTP for AI assistants
 */

export const mcpEndpoint = httpAction(async (ctx, request) => {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Accept either Aer token (aer_{userId}) or OAuth access token
    const bearer = authHeader.substring(7);

    let userId: Id<"users"> | null = null;

    if (bearer.startsWith("aer_")) {
      userId = bearer.substring(4) as Id<"users">;
      const user = await ctx.runQuery(internal.users.getUserById, { userId });
      if (!user) userId = null;
    } else {
      // Look up OAuth access token
      const tokenRow = await ctx.runQuery(internal.oauthInternal.getAccessToken, { accessToken: bearer });
      if (tokenRow && tokenRow.expiresAt > Date.now()) {
        userId = tokenRow.userId as Id<"users">;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { tool, args } = body;

    if (!tool) {
      return new Response(
        JSON.stringify({ error: "Missing tool parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Add userId to args for all tool calls
    const argsWithUserId = { ...args, userId };

    // Route to appropriate MCP tool
    let result;
    switch (tool) {
      case "list_contexts":
        result = await ctx.runAction(internal.mcp.server.listContexts, argsWithUserId);
        break;
      case "search_contexts":
        result = await ctx.runAction(internal.mcp.server.searchContexts, argsWithUserId);
        break;
      case "list_tags":
        result = await ctx.runAction(internal.mcp.server.listTags, argsWithUserId);
        break;
      case "get_contexts_by_tags":
        result = await ctx.runAction(internal.mcp.server.getContextsByTags, argsWithUserId);
        break;
      case "get_user_stats":
        result = await ctx.runAction(internal.mcp.server.getUserStats, argsWithUserId);
        break;
      case "generate_tags":
        result = await ctx.runAction(internal.mcp.server.generateTagsForContent, args);
        break;
      case "chat_with_context":
        result = await ctx.runAction(internal.mcp.aiModels.chatWithContext, argsWithUserId);
        break;
      case "generate_with_model":
        result = await ctx.runAction(internal.mcp.aiModels.generateWithModel, argsWithUserId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown tool: ${tool}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MCP endpoint error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
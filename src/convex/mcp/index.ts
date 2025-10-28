import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

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

    const body = await request.json();
    const { tool, args } = body;

    if (!tool) {
      return new Response(
        JSON.stringify({ error: "Missing tool parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Route to appropriate MCP tool
    let result;
    switch (tool) {
      case "list_contexts":
        result = await ctx.runAction(internal.mcp.server.listContexts, args);
        break;
      case "search_contexts":
        result = await ctx.runAction(internal.mcp.server.searchContexts, args);
        break;
      case "list_tags":
        result = await ctx.runAction(internal.mcp.server.listTags, args);
        break;
      case "get_contexts_by_tags":
        result = await ctx.runAction(internal.mcp.server.getContextsByTags, args);
        break;
      case "get_user_stats":
        result = await ctx.runAction(internal.mcp.server.getUserStats, args);
        break;
      case "generate_tags":
        result = await ctx.runAction(internal.mcp.server.generateTagsForContent, args);
        break;
      case "chat_with_context":
        result = await ctx.runAction(internal.mcp.aiModels.chatWithContext, args);
        break;
      case "generate_with_model":
        result = await ctx.runAction(internal.mcp.aiModels.generateWithModel, args);
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

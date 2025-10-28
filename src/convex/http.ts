import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { uploadContext, batchUploadContexts } from "./httpApi";
import { mcpEndpoint } from "./mcp/index";

const http = httpRouter();

auth.addHttpRoutes(http);

// E2E encrypted API endpoints
http.route({
  path: "/api/context/upload",
  method: "POST",
  handler: uploadContext,
});

http.route({
  path: "/api/context/batch-upload",
  method: "POST",
  handler: batchUploadContexts,
});

// MCP endpoint for AI assistants
http.route({
  path: "/api/mcp",
  method: "POST",
  handler: mcpEndpoint,
});

export default http;
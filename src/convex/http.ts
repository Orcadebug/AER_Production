import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { uploadContext, batchUploadContexts } from "./httpApi";
import { mcpEndpoint } from "./mcp/index";
import { oauthAuthorize, oauthToken } from "./oauth";
import { stripeWebhook } from "./paymentsWebhook";
import { createProCheckout, checkoutOptions } from "./payApi";

const http = httpRouter();

// Add auth routes first
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

// Payments webhook
http.route({
  path: "/api/stripe/webhook",
  method: "POST",
  handler: stripeWebhook,
});

// Create checkout session
http.route({
  path: "/api/pay/checkout",
  method: "OPTIONS",
  handler: checkoutOptions,
});
http.route({
  path: "/api/pay/checkout",
  method: "POST",
  handler: createProCheckout,
});

// MCP endpoint for AI assistants
http.route({
  path: "/api/mcp",
  method: "POST",
  handler: mcpEndpoint,
});

// OAuth 2.0 endpoints for Claude connectors
http.route({
  path: "/api/oauth/authorize",
  method: "GET",
  handler: oauthAuthorize,
});
http.route({
  path: "/api/oauth/authorize",
  method: "POST",
  handler: oauthAuthorize,
});
http.route({
  path: "/api/oauth/token",
  method: "POST",
  handler: oauthToken,
});

// Export the router as default
export default http;

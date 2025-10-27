import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { uploadContext, batchUploadContexts } from "./httpApi";

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

export default http;
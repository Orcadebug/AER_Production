/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as audit from "../audit.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as auth from "../auth.js";
import type * as contexts from "../contexts.js";
import type * as contextsInternal from "../contextsInternal.js";
import type * as crypto from "../crypto.js";
import type * as entitlements from "../entitlements.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as httpApi from "../httpApi.js";
import type * as mcp_aiModels from "../mcp/aiModels.js";
import type * as mcp_index from "../mcp/index.js";
import type * as mcp_server from "../mcp/server.js";
import type * as oauth from "../oauth.js";
import type * as oauthInternal from "../oauthInternal.js";
import type * as oauthPublic from "../oauthPublic.js";
import type * as payApi from "../payApi.js";
import type * as payments from "../payments.js";
import type * as paymentsInternal from "../paymentsInternal.js";
import type * as paymentsWebhook from "../paymentsWebhook.js";
import type * as projects from "../projects.js";
import type * as projectsInternal from "../projectsInternal.js";
import type * as redeem from "../redeem.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  audit: typeof audit;
  "auth/emailOtp": typeof auth_emailOtp;
  auth: typeof auth;
  contexts: typeof contexts;
  contextsInternal: typeof contextsInternal;
  crypto: typeof crypto;
  entitlements: typeof entitlements;
  feedback: typeof feedback;
  http: typeof http;
  httpApi: typeof httpApi;
  "mcp/aiModels": typeof mcp_aiModels;
  "mcp/index": typeof mcp_index;
  "mcp/server": typeof mcp_server;
  oauth: typeof oauth;
  oauthInternal: typeof oauthInternal;
  oauthPublic: typeof oauthPublic;
  payApi: typeof payApi;
  payments: typeof payments;
  paymentsInternal: typeof paymentsInternal;
  paymentsWebhook: typeof paymentsWebhook;
  projects: typeof projects;
  projectsInternal: typeof projectsInternal;
  redeem: typeof redeem;
  tags: typeof tags;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

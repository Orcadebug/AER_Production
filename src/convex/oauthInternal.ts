import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const upsertClient = internalMutation({
  args: { clientId: v.string(), name: v.string(), redirectUri: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oauth_clients")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    if (existing.length === 0) {
      await ctx.db.insert("oauth_clients", {
        clientId: args.clientId,
        name: args.name,
        redirectUris: [args.redirectUri],
        createdAt: Date.now(),
      });
    } else {
      const client = existing[0];
      const set = new Set(client.redirectUris);
      set.add(args.redirectUri);
      await ctx.db.patch(client._id, { redirectUris: Array.from(set) });
    }
  },
});

export const createAuthCode = internalMutation({
  args: {
    code: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    scope: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("oauth_auth_codes", {
      code: args.code,
      clientId: args.clientId,
      userId: args.userId,
      redirectUri: args.redirectUri,
      scope: args.scope,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const getAuthCodeByCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("oauth_auth_codes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .collect();
    return rows[0] || null;
  },
});

export const deleteAuthCode = internalMutation({
  args: { id: v.id("oauth_auth_codes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const createAccessToken = internalMutation({
  args: {
    accessToken: v.string(),
    userId: v.id("users"),
    clientId: v.string(),
    scope: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("oauth_tokens", {
      accessToken: args.accessToken,
      userId: args.userId,
      clientId: args.clientId,
      scope: args.scope,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const getAccessToken = internalQuery({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("oauth_tokens")
      .withIndex("by_token", (q) => q.eq("accessToken", args.accessToken))
      .collect();
    return rows[0] || null;
  },
});

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";
import { internal } from "./_generated/api";

function randomId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export const createAuthCodeForClient = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    state: v.optional(v.string()),
    scope: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const code = randomId("ac_");
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await ctx.runMutation(internal.oauthInternal.createAuthCode, {
      code,
      clientId: args.clientId,
      userId: user._id,
      redirectUri: args.redirectUri,
      scope: args.scope,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      expiresAt,
    });

    return { code };
  },
});
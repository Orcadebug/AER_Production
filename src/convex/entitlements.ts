import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Entitlements and usage enforcement

type Tier = "free" | "beta" | "pro" | "owner";

const LIMITS: Record<Tier, { perplexityPerMonth: number; storageBytes: number | "unlimited" }> = {
  free: { perplexityPerMonth: 30, storageBytes: 100 * 1024 * 1024 }, // 100 MB
  beta: { perplexityPerMonth: 100, storageBytes: 500 * 1024 * 1024 }, // 500 MB
  pro: { perplexityPerMonth: 300, storageBytes: 10 * 1024 * 1024 * 1024 }, // 10 GB
  owner: { perplexityPerMonth: Number.MAX_SAFE_INTEGER, storageBytes: "unlimited" },
};

function startOfMonthMs(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export const getUserTier = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Tier> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return "free";
    const tier = (user as any).membershipTier as Tier | undefined;
    return tier || "free";
  },
});

export const getUsage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const monthStart = startOfMonthMs();
    const rows = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("monthStart", monthStart))
      .collect();
    const usage = rows[0] || null;
    const tier = (await ctx.runQuery(internal.entitlements.getUserTier, { userId: args.userId })) as any as Tier;
    const limits = LIMITS[tier];
    return { usage, limits, tier };
  },
});

export const ensureUsageRow = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const monthStart = startOfMonthMs();
    const rows = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("monthStart", monthStart))
      .collect();
    if (rows.length > 0) return rows[0]._id;
    return await ctx.db.insert("usage", {
      userId: args.userId,
      monthStart,
      perplexityCalls: 0,
      storageBytes: 0,
    });
  },
});

export const incrementPerplexity = internalMutation({
  args: { userId: v.id("users"), amount: v.number() },
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(internal.entitlements.ensureUsageRow, { userId: args.userId });
    const row = await ctx.db.get(id as Id<"usage">);
    if (!row) return;
    await ctx.db.patch(id as Id<"usage">, { perplexityCalls: row.perplexityCalls + args.amount });
  },
});

export const addStorageBytes = internalMutation({
  args: { userId: v.id("users"), bytes: v.number() },
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(internal.entitlements.ensureUsageRow, { userId: args.userId });
    const row = await ctx.db.get(id as Id<"usage">);
    if (!row) return;
    await ctx.db.patch(id as Id<"usage">, { storageBytes: row.storageBytes + args.bytes });
  },
});

export const assertPerplexityAllowed = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { usage, limits, tier } = (await ctx.runQuery(internal.entitlements.getUsage, { userId: args.userId })) as any;
    const used = usage?.perplexityCalls || 0;
    const allowed = LIMITS[(tier as Tier)].perplexityPerMonth;
    return { allowed, used, ok: used < allowed };
  },
});

// Public query: current user's usage & limits
export const getMyUsage = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal, {} as any);
    if (!user) return null;
    const { usage, limits, tier } = (await ctx.runQuery(internal.entitlements.getUsage, { userId: user._id })) as any;
    return {
      tier,
      allowedPerplexity: limits.perplexityPerMonth,
      usedPerplexity: usage?.perplexityCalls || 0,
      storageBytes: usage?.storageBytes || 0,
    };
  },
});

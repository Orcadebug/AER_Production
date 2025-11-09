import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Entitlements and usage enforcement

type Tier = "free" | "beta" | "pro" | "max" | "owner";

const LIMITS: Record<Tier, { perplexityPerMonth: number; storageBytes: number | "unlimited" }> = {
  free: { perplexityPerMonth: 30, storageBytes: 100 * 1024 * 1024 }, // 100 MB
  beta: { perplexityPerMonth: 100, storageBytes: 500 * 1024 * 1024 }, // 500 MB
  pro: { perplexityPerMonth: 300, storageBytes: 10 * 1024 * 1024 * 1024 }, // 10 GB
  max: { perplexityPerMonth: 1000, storageBytes: 100 * 1024 * 1024 * 1024 }, // 100 GB
  owner: { perplexityPerMonth: Number.MAX_SAFE_INTEGER, storageBytes: "unlimited" },
};

function startOfMonthMs(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export const getUserTier = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Tier> => {
    const user: any = await ctx.db.get(args.userId);
    if (!user) return "free";
    const tier = user.membershipTier as Tier | undefined;
    const periodEnd = user.membershipPeriodEnd as number | undefined;
    const expired = typeof periodEnd === "number" && periodEnd > 0 && Date.now() > periodEnd;
    if (!tier || expired) return "free";
    return tier;
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
      searchRequests: 0,
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

export const incrementSearchCount = internalMutation({
  args: { userId: v.id("users"), amount: v.number() },
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(internal.entitlements.ensureUsageRow, { userId: args.userId });
    const row = await ctx.db.get(id as Id<"usage">) as any;
    if (!row) return;
    const current = typeof row.searchRequests === 'number' ? row.searchRequests : 0;
    await ctx.db.patch(id as Id<"usage">, { searchRequests: current + args.amount });
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
    const daily = (await ctx.runQuery(internal.entitlements.getDailyPremiumUsage, { userId: user._id })) as any;
    return {
      tier,
      allowedPerplexity: limits.perplexityPerMonth,
      usedPerplexity: usage?.perplexityCalls || 0,
      usedSearchesThisMonth: usage?.searchRequests || 0,
      usedPremiumImagesToday: daily?.used || 0,
      storageBytes: usage?.storageBytes || 0,
    };
  },
});

// =========================
// Daily usage (premium images)
// =========================
function startOfDayMs(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const ensureDailyUsageRow = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const dayStart = startOfDayMs();
    const rows = await ctx.db
      .query("daily_usage")
      .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("dayStart", dayStart))
      .collect();
    if (rows.length > 0) return rows[0]._id;
    return await ctx.db.insert("daily_usage", {
      userId: args.userId,
      dayStart,
      premiumImages: 0,
    });
  },
});

export const incrementDailyPremiumImages = internalMutation({
  args: { userId: v.id("users"), amount: v.number() },
  handler: async (ctx, args) => {
    const id = await ctx.runMutation(internal.entitlements.ensureDailyUsageRow, { userId: args.userId });
    const row = await ctx.db.get(id as Id<"daily_usage">) as any;
    if (!row) return;
    await ctx.db.patch(id as Id<"daily_usage">, { premiumImages: (row.premiumImages || 0) + args.amount });
  },
});

export const getDailyPremiumUsage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const dayStart = startOfDayMs();
    const rows = await ctx.db
      .query("daily_usage")
      .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("dayStart", dayStart))
      .collect();
    const usage = rows[0] || null;
    return { used: usage?.premiumImages || 0 };
  },
});

// =========================
// Storage limit enforcement
// =========================
export const getStorageStatus = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { usage, limits, tier } = (await ctx.runQuery(internal.entitlements.getUsage, { userId: args.userId })) as any;
    const used = usage?.storageBytes || 0;
    const allowed = limits.storageBytes === "unlimited" ? Number.MAX_SAFE_INTEGER : (limits.storageBytes as number);
    return { used, allowed, tier };
  },
});

export const assertStorageAllowed = internalQuery({
  args: { userId: v.id("users"), additionalBytes: v.number() },
  handler: async (ctx, args) => {
    const { used, allowed, tier } = (await ctx.runQuery(internal.entitlements.getStorageStatus, { userId: args.userId })) as any;
    const ok = used + args.additionalBytes <= allowed;
    return { ok, used, allowed, tier };
  },
});

// =========================
// Per-minute rate limiting
// =========================

type RLKey = "api" | "upload" | "search" | "ai";
const RL_LIMITS: Record<Tier, Record<RLKey, { limit: number; windowMs: number }>> = {
  free:  { api: { limit: 60, windowMs: 60_000 }, upload: { limit: 30, windowMs: 60_000 }, search: { limit: 60, windowMs: 60_000 }, ai: { limit: 20, windowMs: 60_000 } },
  beta:  { api: { limit: 120, windowMs: 60_000 }, upload: { limit: 60, windowMs: 60_000 }, search: { limit: 120, windowMs: 60_000 }, ai: { limit: 40, windowMs: 60_000 } },
  pro:   { api: { limit: 300, windowMs: 60_000 }, upload: { limit: 150, windowMs: 60_000 }, search: { limit: 300, windowMs: 60_000 }, ai: { limit: 100, windowMs: 60_000 } },
  max:   { api: { limit: 600, windowMs: 60_000 }, upload: { limit: 300, windowMs: 60_000 }, search: { limit: 600, windowMs: 60_000 }, ai: { limit: 200, windowMs: 60_000 } },
  owner: { api: { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 }, upload: { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 }, search: { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 }, ai: { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 } },
};

export const assertAndIncrementRateLimit = internalMutation({
  args: { userId: v.id("users"), key: v.string() },
  handler: async (ctx, args) => {
    const key = args.key as RLKey;
    const tier = (await ctx.runQuery(internal.entitlements.getUserTier, { userId: args.userId })) as Tier;
    const cfg = RL_LIMITS[tier][key] || RL_LIMITS[tier].api;

    const now = Date.now();
    const windowMs = cfg.windowMs;
    const identifier = `${key}:${args.userId}`;

    // Fetch or initialize rate limit row
    const rows = await ctx.db
      .query("rate_limits")
      .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
      .collect();

    let row = rows[0] as { _id: Id<"rate_limits">; count: number; resetTime: number; blocked: boolean; blockUntil?: number } | undefined;
    if (!row) {
      const id = await ctx.db.insert("rate_limits", {
        identifier,
        count: 0,
        resetTime: now + windowMs,
        blocked: false,
        blockUntil: undefined,
      });
      row = { _id: id as Id<"rate_limits">, count: 0, resetTime: now + windowMs, blocked: false };
    }

    // Reset window if elapsed
    if ((row.resetTime || 0) <= now) {
      await ctx.db.patch(row._id as Id<"rate_limits">, { count: 0, resetTime: now + windowMs, blocked: false, blockUntil: undefined });
      row = { ...row, count: 0, resetTime: now + windowMs };
    }

    const current = row.count || 0;
    const limit = cfg.limit;

    if (current + 1 > limit) {
      const retryAfterMs = Math.max(0, row.resetTime - now);
      return { ok: false, limit, used: current, retryAfterMs, tier, key };
    }

    await ctx.db.patch(row._id as Id<"rate_limits">, { count: current + 1 });
    return { ok: true, limit, used: current + 1, resetAtMs: row.resetTime, tier, key };
  },
});

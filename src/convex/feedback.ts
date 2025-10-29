import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const create = mutation({
  args: {
    type: v.union(v.literal("bug"), v.literal("feature"), v.literal("question")),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    return await ctx.db.insert("feedback", {
      userId: user._id,
      userEmail: user.email || "anonymous",
      type: args.type,
      title: args.title,
      description: args.description,
      status: "open",
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("feedback")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("feedback"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const feedback = await ctx.db.get(args.id);
    if (!feedback || feedback.userId !== user._id) {
      throw new Error("Feedback not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
    });
  },
});

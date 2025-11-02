import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const createForUser = internalMutation({
  args: { userId: v.id("users"), name: v.string(), description: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("projects", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      color: args.color || "#8BA888",
    });
    return id;
  },
});

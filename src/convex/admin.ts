import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const deleteAllUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // Delete all user's contexts
    const contexts = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    for (const context of contexts) {
      await ctx.db.delete(context._id);
    }

    // Delete all user's projects
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    for (const project of projects) {
      await ctx.db.delete(project._id);
    }

    // Delete all user's tags
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }

    return { success: true, message: "All data deleted successfully" };
  },
});

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const contexts = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const tags = await ctx.db
      .query("tags")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return {
      totalContexts: contexts.length,
      totalProjects: projects.length,
      totalTags: tags.length,
      totalFiles: contexts.filter((c) => c.type === "file").length,
    };
  },
});

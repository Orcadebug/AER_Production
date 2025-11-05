import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";
import { internal } from "./_generated/api";
import { serverDecryptString } from "./crypto";

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

// Backfill tags/summary/title+project for current user's contexts
export const backfillMyContexts = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const all = await ctx.db
      .query("contexts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    const totalContexts = all.length;
    const targets = (args.limit && args.limit > 0) ? all.slice(0, args.limit) : all;

    let scheduled = 0;
    for (const c of targets) {
      // Try to recover a plaintext preview
      let preview = "";
      try {
        if ((c as any).encryptedContent?.ciphertext && (c as any).encryptedContent?.nonce) {
          const p = serverDecryptString((c as any).encryptedContent.ciphertext, (c as any).encryptedContent.nonce);
          if (p) preview = p.substring(0, 1500);
        }
      } catch {}
      if (!preview && (c as any).encryptedSummary) {
        const s = (c as any).encryptedSummary as any;
        if (s.nonce === "plain") preview = s.ciphertext.substring(0, 1500);
        else {
          try {
            const p = serverDecryptString(s.ciphertext, s.nonce);
            if (p) preview = p.substring(0, 1500);
          } catch {}
        }
      }
      if (!preview) continue; // cannot enrich without preview

      // Schedule missing pieces
      try {
        if (!(c as any).tags || (c as any).tags.length === 0) {
          await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTags, {
            userId: user._id,
            contextId: (c as any)._id,
            content: preview,
            title: (c as any).title || "",
            totalContexts,
          });
          scheduled++;
        }
        if (!(c as any).encryptedSummary) {
          await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateEncryptedSummary, {
            userId: user._id,
            contextId: (c as any)._id,
            content: preview,
          });
          scheduled++;
        }
        // Title + project refinement
        await ctx.scheduler.runAfter(0, internal.ai.generateAndUpdateTitleAndProject, {
          userId: user._id,
          contextId: (c as any)._id,
          content: preview,
          currentTitle: (c as any).title || "",
        });
      } catch {}
    }

    return { success: true, processed: targets.length, scheduled };
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

export const makeUserAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      role: "admin",
    });

    return { success: true, message: `User ${args.email} is now an admin` };
  },
});
"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * HTTP API endpoint for uploading encrypted context
 * POST /api/context/upload
 */
export const uploadEncryptedContext = action({
  args: {
    encryptedContent: v.string(),
    encryptedTitle: v.string(),
    encryptedMetadata: v.string(),
    type: v.union(v.literal("note"), v.literal("file"), v.literal("web")),
    projectId: v.optional(v.id("projects")),
    isEncrypted: v.boolean(),
    encryptionVersion: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current user
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Log audit event
    await ctx.runMutation(internal.encryption.logAuditEvent, {
      userId: user._id,
      action: "UPLOAD_ENCRYPTED_CONTEXT",
      resourceType: "context",
      success: true,
    });

    // Create encrypted context
    const contextId = await ctx.runMutation(internal.contexts.createEncrypted, {
      userId: user._id,
      encryptedContent: args.encryptedContent,
      encryptedTitle: args.encryptedTitle,
      encryptedMetadata: args.encryptedMetadata,
      type: args.type,
      projectId: args.projectId,
      isEncrypted: args.isEncrypted,
      encryptionVersion: args.encryptionVersion,
    });

    return { success: true, contextId };
  },
});

/**
 * HTTP API endpoint for batch upload
 * POST /api/context/batch-upload
 */
export const batchUploadEncryptedContexts = action({
  args: {
    contexts: v.array(
      v.object({
        encryptedContent: v.string(),
        encryptedTitle: v.string(),
        encryptedMetadata: v.string(),
        type: v.union(v.literal("note"), v.literal("file"), v.literal("web")),
        projectId: v.optional(v.id("projects")),
      })
    ),
    isEncrypted: v.boolean(),
    encryptionVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const results = [];
    for (const context of args.contexts) {
      try {
        const contextId = await ctx.runMutation(internal.contexts.createEncrypted, {
          userId: user._id,
          encryptedContent: context.encryptedContent,
          encryptedTitle: context.encryptedTitle,
          encryptedMetadata: context.encryptedMetadata,
          type: context.type,
          projectId: context.projectId,
          isEncrypted: args.isEncrypted,
          encryptionVersion: args.encryptionVersion,
        });
        results.push({ success: true, contextId });
      } catch (error) {
        results.push({ success: false, error: String(error) });
      }
    }

    await ctx.runMutation(internal.encryption.logAuditEvent, {
      userId: user._id,
      action: "BATCH_UPLOAD_ENCRYPTED_CONTEXTS",
      resourceType: "context",
      success: true,
    });

    return { results };
  },
});

/**
 * Get encrypted context feed
 * GET /api/context/feed
 */
export const getEncryptedFeed = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const contexts = await ctx.runQuery(internal.contexts.listEncrypted, {
      userId: user._id,
      limit: args.limit || 50,
    });

    return { contexts };
  },
});

/**
 * Delete encrypted context
 * DELETE /api/context/:id
 */
export const deleteEncryptedContext = action({
  args: {
    contextId: v.id("contexts"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    if (!user) {
      throw new Error("Unauthorized");
    }

    await ctx.runMutation(internal.contexts.removeEncrypted, {
      userId: user._id,
      contextId: args.contextId,
    });

    await ctx.runMutation(internal.encryption.logAuditEvent, {
      userId: user._id,
      action: "DELETE_ENCRYPTED_CONTEXT",
      resourceType: "context",
      resourceId: args.contextId,
      success: true,
    });

    return { success: true };
  },
});

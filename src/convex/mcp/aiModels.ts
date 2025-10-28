"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import Perplexity from "@perplexity-ai/perplexity_ai";

/**
 * Multi-Model AI Service
 * Supports switching between different AI models while maintaining context
 */

type AIModel = "openai-gpt4" | "openai-gpt3.5" | "perplexity-sonar" | "perplexity-sonar-pro";

interface AIModelConfig {
  provider: "openai" | "perplexity";
  model: string;
  temperature: number;
  maxTokens: number;
}

const MODEL_CONFIGS: Record<AIModel, AIModelConfig> = {
  "openai-gpt4": {
    provider: "openai",
    model: "gpt-4-turbo-preview",
    temperature: 0.3,
    maxTokens: 2000,
  },
  "openai-gpt3.5": {
    provider: "openai",
    model: "gpt-3.5-turbo",
    temperature: 0.3,
    maxTokens: 1500,
  },
  "perplexity-sonar": {
    provider: "perplexity",
    model: "sonar",
    temperature: 0.3,
    maxTokens: 2000,
  },
  "perplexity-sonar-pro": {
    provider: "perplexity",
    model: "sonar-pro",
    temperature: 0.2,
    maxTokens: 3000,
  },
};

/**
 * Generate response using specified AI model
 */
export const generateWithModel = internalAction({
  args: {
    model: v.union(
      v.literal("openai-gpt4"),
      v.literal("openai-gpt3.5"),
      v.literal("perplexity-sonar"),
      v.literal("perplexity-sonar-pro")
    ),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
    contextData: v.optional(v.array(v.object({
      title: v.string(),
      content: v.string(),
      tags: v.array(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const config = MODEL_CONFIGS[args.model as AIModel];

    // Build context-aware prompt
    let fullPrompt = args.prompt;
    if (args.contextData && args.contextData.length > 0) {
      const contextSection = args.contextData
        .map((item, idx) => `[Context ${idx + 1}]\nTitle: ${item.title}\nTags: ${item.tags.join(", ")}\nContent: ${item.content}\n`)
        .join("\n");
      fullPrompt = `${contextSection}\n\nUser Query: ${args.prompt}`;
    }

    try {
      if (config.provider === "openai") {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY not configured");
        }

        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const messages: Array<{ role: "system" | "user"; content: string }> = [];
        if (args.systemPrompt) {
          messages.push({ role: "system", content: args.systemPrompt });
        }
        messages.push({ role: "user", content: fullPrompt });

        const response = await openai.chat.completions.create({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        });

        return {
          success: true,
          model: args.model,
          provider: "openai",
          response: response.choices[0]?.message?.content || "",
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
          },
        };
      } else if (config.provider === "perplexity") {
        if (!process.env.PERPLEXITY_API_KEY) {
          throw new Error("PERPLEXITY_API_KEY not configured");
        }

        const perplexity = new Perplexity({
          apiKey: process.env.PERPLEXITY_API_KEY,
        });

        const messages: Array<{ role: "system" | "user"; content: string }> = [];
        if (args.systemPrompt) {
          messages.push({ role: "system", content: args.systemPrompt });
        }
        messages.push({ role: "user", content: fullPrompt });

        const response = await perplexity.chat.completions.create({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        });

        return {
          success: true,
          model: args.model,
          provider: "perplexity",
          response: response.choices[0]?.message?.content || "",
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        };
      }

      throw new Error(`Unsupported provider: ${config.provider}`);
    } catch (error) {
      return {
        success: false,
        model: args.model,
        provider: config.provider,
        error: error instanceof Error ? error.message : String(error),
        response: "",
      };
    }
  },
});

/**
 * Chat with AI using context from user's encrypted notes
 */
export const chatWithContext = internalAction({
  args: {
    userId: v.id("users"),
    model: v.union(
      v.literal("openai-gpt4"),
      v.literal("openai-gpt3.5"),
      v.literal("perplexity-sonar"),
      v.literal("perplexity-sonar-pro")
    ),
    query: v.string(),
    includeRelevantContexts: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    let contextData: Array<{ title: string; content: string; tags: string[] }> = [];

    // If requested, fetch relevant contexts using semantic search
    if (args.includeRelevantContexts) {
      const searchResult = await ctx.runAction(internal.mcp.server.searchContexts, {
        userId: args.userId,
        query: args.query,
      });

      if (searchResult.success && searchResult.results.length > 0) {
        // Note: We can only include metadata here since content is encrypted
        // The AI will work with titles and tags
        contextData = searchResult.results.slice(0, 5).map((r: any) => ({
          title: r.title,
          content: `[Encrypted content - Type: ${r.type}]`,
          tags: r.tags,
        }));
      }
    }

    const systemPrompt = `You are an AI assistant helping a user with their personal knowledge base. 
The user has an encrypted context system with notes, files, and web content.
You have access to metadata (titles, tags, types) but not the actual encrypted content.
Help the user organize, search, and understand their knowledge base.`;

    return await ctx.runAction(internal.mcp.aiModels.generateWithModel, {
      model: args.model,
      prompt: args.query,
      systemPrompt,
      contextData: contextData.length > 0 ? contextData : undefined,
    });
  },
});

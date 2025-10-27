"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

// Lazy initialization to avoid requiring API key at module load time
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate hierarchical tags from content (general to specific)
 * Tag granularity increases with user's total content count
 */
export const generateTags = internalAction({
  args: {
    content: v.string(),
    title: v.string(),
    totalContexts: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Calculate tag count based on content volume
      const baseTagCount = 3;
      const additionalTags = Math.floor(args.totalContexts / 50); // +1 tag per 50 items
      const maxTags = Math.min(baseTagCount + additionalTags, 10);

      const prompt = `Analyze this content and generate ${maxTags} hierarchical tags, ordered from most general to most specific.

Title: ${args.title}
Content: ${args.content.substring(0, 1000)}

Rules:
1. Start with broad categories (e.g., "technology", "business", "personal")
2. Progress to more specific topics (e.g., "web development", "react", "hooks")
3. End with highly specific concepts unique to this content
4. Use lowercase, single words or short phrases (2-3 words max)
5. Separate tags with commas
6. Return ONLY the tags, no explanations

Example: technology, programming, javascript, react, state management, custom hooks

Tags:`;

      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });

      const tagsText = response.choices[0]?.message?.content?.trim() || "";
      const tags = tagsText
        .split(",")
        .map((tag: string) => tag.trim().toLowerCase())
        .filter((tag: string) => tag.length > 0)
        .slice(0, maxTags);

      return tags;
    } catch (error) {
      console.error("Error generating tags:", error);
      // Fallback to basic tags if AI fails
      return ["general", "note"];
    }
  },
});

/**
 * Generate tags and update context (called as scheduled function)
 */
export const generateAndUpdateTags = internalAction({
  args: {
    contextId: v.id("contexts"),
    content: v.string(),
    title: v.string(),
    totalContexts: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const tags = await ctx.runAction(internal.ai.generateTags, {
        content: args.content,
        title: args.title,
        totalContexts: args.totalContexts,
      });

      // Update the context with generated tags
      await ctx.runMutation(internal.contextsInternal.updateTags, {
        contextId: args.contextId,
        tags,
      });
    } catch (error) {
      console.error("Failed to generate and update tags:", error);
    }
  },
});

/**
 * Semantic search: match query to tags and rank results
 */
export const semanticSearch = internalAction({
  args: {
    query: v.string(),
    allContextsWithTags: v.array(
      v.object({
        contextId: v.string(),
        tags: v.array(v.string()),
        title: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    try {
      if (args.allContextsWithTags.length === 0) {
        return [];
      }

      // Create a mapping of contexts with their tags
      const contextsText = args.allContextsWithTags
        .map(
          (c, idx) =>
            `${idx}. Title: "${c.title}" | Tags: ${c.tags.join(", ")}`
        )
        .join("\n");

      const prompt = `Given this search query: "${args.query}"

Rank these items by relevance (most to least relevant). Consider semantic meaning, not just keyword matching.

Items:
${contextsText}

Return ONLY a comma-separated list of item numbers in order of relevance (e.g., "3,7,1,5,2").
If an item is completely irrelevant, exclude it.

Ranking:`;

      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 100,
      });

      const rankingText = response.choices[0]?.message?.content?.trim() || "";
      const rankings = rankingText
        .split(",")
        .map((n: string) => parseInt(n.trim()))
        .filter((n: number) => !isNaN(n) && n >= 0 && n < args.allContextsWithTags.length);

      // Return context IDs in ranked order
      return rankings.map((idx: number) => args.allContextsWithTags[idx].contextId);
    } catch (error) {
      console.error("Error in semantic search:", error);
      // Fallback to original order
      return args.allContextsWithTags.map((c) => c.contextId);
    }
  },
});
"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import Perplexity from "@perplexity-ai/perplexity_ai";

// Lazy initialization to avoid requiring API key at module load time
function getPerplexity() {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }
  return new Perplexity({
    apiKey: process.env.PERPLEXITY_API_KEY,
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

      const perplexity = getPerplexity();
      const response = await perplexity.chat.completions.create({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content;
      const tagsText = typeof content === "string" ? content.trim() : "";
      const tags = tagsText
        .split(",")
        .map((tag: string) => tag.trim().toLowerCase())
        .filter((tag: string) => tag.length > 0)
        // de-duplicate while preserving order
        .filter((tag: string, idx: number, arr: string[]) => arr.indexOf(tag) === idx)
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
 * Generate a brief 2-3 sentence summary of content
 */
export const generateSummary = internalAction({
  args: {
    content: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const prompt = `Reduce the following text by identifying and removing low-information tokens (articles, redundant adjectives, filler phrases) while keeping all high-value technical terms, numbers, logical operators, and key concepts intact. Then summarize in 2-3 clear, concise sentences focusing on main points and key information.

Title: ${args.title}
Content: ${args.content.substring(0, 2000)}

Provide only the summary, no additional text or formatting:`;

      const perplexity = getPerplexity();
      const response = await perplexity.chat.completions.create({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content;
      const summary = typeof content === "string" ? content.trim() : "";
      
      return summary || args.content.substring(0, 150) + "...";
    } catch (error) {
      console.error("Error generating summary:", error);
      // Fallback to truncation
      return args.content.substring(0, 150) + "...";
    }
  },
});

/**
 * Generate tags and summary, then return them (not store directly)
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
 * Generate summary and update the context (stores as a "plain" envelope)
 */
export const generateAndUpdateSummary = internalAction({
  args: {
    contextId: v.id("contexts"),
    content: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const summary = await ctx.runAction(internal.ai.generateSummary, {
        content: args.content,
        title: args.title,
      });

      // Update the context with generated summary as a plain envelope
      await ctx.runMutation(internal.contextsInternal.updateSummary, {
        contextId: args.contextId,
        summary,
      });
    } catch (error) {
      console.error("Failed to generate and update summary:", error);
    }
  },
});

/**
 * Semantic search: match query to tags and rank results
 * This is now a public action that can be called from mutations
 */
export const semanticSearchPublic = internalAction({
  args: {
    query: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string[]> => {
    try {
      // Get all user contexts with tags
      const allContexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
        userId: args.userId,
      });

      const contextsWithTags = allContexts
        .filter((c: any) => c.tags && c.tags.length > 0)
        .map((c: any, idx: number) => ({
          index: idx,
          contextId: c._id,
          tags: c.tags,
          title: c.title,
        }));

      if (contextsWithTags.length === 0) {
        return allContexts.map((c: any) => c._id);
      }

      // Create a mapping of contexts with their tags
      const contextsText = contextsWithTags
        .map(
          (c: any) =>
            `${c.index}. Title: "${c.title}" | Tags: ${c.tags.join(", ")}`
        )
        .join("\n");

      const prompt = `Given this search query: "${args.query}"

Rank these items by relevance (most to least relevant). Consider semantic meaning, not just keyword matching.

Items:
${contextsText}

Return ONLY a comma-separated list of item numbers in order of relevance (e.g., "3,7,1,5,2").
If an item is completely irrelevant, exclude it.

Ranking:`;

      const perplexity = getPerplexity();
      const response = await perplexity.chat.completions.create({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content;
      const rankingText = typeof content === "string" ? content.trim() : "";
      const rankings = rankingText
        .split(",")
        .map((n: string) => parseInt(n.trim()))
        .filter((n: number) => !isNaN(n) && n >= 0 && n < contextsWithTags.length);

      // Return context IDs in ranked order
      const rankedIds = rankings.map((idx: number) => contextsWithTags[idx].contextId);
      
      // Add any contexts that weren't ranked at the end
      const unrankedIds = allContexts
        .map((c: any) => c._id)
        .filter((id: string) => !rankedIds.includes(id));
      
      return [...rankedIds, ...unrankedIds];
    } catch (error) {
      console.error("Error in semantic search:", error);
      // Fallback to original order
      const allContexts: any[] = await ctx.runQuery(internal.contextsInternal.getAllContextsForUser, {
        userId: args.userId,
      });
      return allContexts.map((c: any) => c._id);
    }
  },
});

/**
 * Match a search query to relevant tags using AI
 */
export const matchQueryToTags = action({
  args: {
    query: v.string(),
    allTags: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<string[]> => {
    try {
      if (args.allTags.length === 0) {
        return [];
      }

      const prompt = `Given this search query: "${args.query}"

Available tags: ${args.allTags.join(", ")}

Return the most relevant tags that match this query, ordered from most to least relevant.
Consider semantic meaning and intent, not just exact keyword matches.

Rules:
1. Return only tags from the available list
2. Order by relevance (most relevant first)
3. Include 3-10 tags maximum
4. Return ONLY a comma-separated list of tags, no explanations

Relevant tags:`;

      const perplexity = getPerplexity();
      const response = await perplexity.chat.completions.create({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content;
      const tagsText = typeof content === "string" ? content.trim() : "";
      const matchedTags = tagsText
        .split(",")
        .map((tag: string) => tag.trim().toLowerCase())
        .filter((tag: string) => args.allTags.includes(tag))
        .slice(0, 10);

      return matchedTags;
    } catch (error) {
      console.error("Error matching query to tags:", error);
      // Fallback to simple keyword matching
      const queryLower = args.query.toLowerCase();
      return args.allTags.filter((tag: string) => 
        tag.toLowerCase().includes(queryLower) || 
        queryLower.includes(tag.toLowerCase())
      ).slice(0, 5);
    }
  },
});
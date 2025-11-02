/**
 * Rate Limiting Utilities
 * Implements rate limiting to prevent abuse and DDoS attacks
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetTime < now && (!entry.blocked || (entry.blockUntil && entry.blockUntil < now))) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Check if request should be rate limited
   * @param identifier - Unique identifier (userId, IP, etc.)
   * @param points - Number of points allowed
   * @param duration - Duration in seconds
   * @param blockDuration - How long to block after exceeding limit (in seconds)
   * @returns true if allowed, false if rate limited
   */
  consume(
    identifier: string,
    points: number = 100,
    duration: number = 60,
    blockDuration: number = 600
  ): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    // Check if blocked
    if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((entry.blockUntil - now) / 1000)} seconds`);
    }

    // Initialize or reset if expired
    if (!entry || entry.resetTime < now) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + duration * 1000,
        blocked: false,
      });
      return true;
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > points) {
      entry.blocked = true;
      entry.blockUntil = now + blockDuration * 1000;
      throw new Error(`Rate limit exceeded. Too many requests. Try again in ${blockDuration} seconds`);
    }

    return true;
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Get current rate limit status
   */
  getStatus(identifier: string): RateLimitEntry | null {
    return this.limits.get(identifier) || null;
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different operations
 */
export const RATE_LIMITS = {
  // Authentication attempts: 5 per minute, block for 15 minutes
  AUTH: { points: 5, duration: 60, blockDuration: 900 },

  // API mutations: 100 per minute, block for 10 minutes
  MUTATION: { points: 100, duration: 60, blockDuration: 600 },

  // API queries: 300 per minute
  QUERY: { points: 300, duration: 60, blockDuration: 300 },

  // File uploads: 10 per hour
  FILE_UPLOAD: { points: 10, duration: 3600, blockDuration: 3600 },

  // Email sending: 3 per hour, block for 24 hours
  EMAIL: { points: 3, duration: 3600, blockDuration: 86400 },
} as const;

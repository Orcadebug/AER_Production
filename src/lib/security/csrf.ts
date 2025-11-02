/**
 * CSRF Protection Utilities
 * Implements Cross-Site Request Forgery protection
 */

import crypto from "crypto";

export interface CSRFToken {
  token: string;
  timestamp: number;
}

/**
 * Generate a CSRF token for a given session
 * @param sessionToken - The user's session token
 * @returns CSRF token string
 */
export function generateCSRFToken(sessionToken: string): string {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const payload = `${sessionToken}:${timestamp}:${randomBytes}`;

  const token = crypto
    .createHmac("sha256", process.env.CSRF_SECRET || "change-this-secret")
    .update(payload)
    .digest("hex");

  return `${token}:${timestamp}:${randomBytes}`;
}

/**
 * Validate a CSRF token
 * @param token - The CSRF token to validate
 * @param sessionToken - The user's session token
 * @param maxAgeMs - Maximum age of token in milliseconds (default: 1 hour)
 * @returns true if valid, false otherwise
 */
export function validateCSRFToken(
  token: string,
  sessionToken: string,
  maxAgeMs: number = 3600000
): boolean {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;

    const [tokenHash, timestamp, randomBytes] = parts;
    const tokenTimestamp = parseInt(timestamp, 10);

    // Check token age
    if (Date.now() - tokenTimestamp > maxAgeMs) {
      return false;
    }

    // Recreate expected token
    const payload = `${sessionToken}:${timestamp}:${randomBytes}`;
    const expectedToken = crypto
      .createHmac("sha256", process.env.CSRF_SECRET || "change-this-secret")
      .update(payload)
      .digest("hex");

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash),
      Buffer.from(expectedToken)
    );
  } catch (error) {
    console.error("CSRF validation error:", error);
    return false;
  }
}

/**
 * Middleware to validate CSRF tokens on mutations
 */
export function validateCSRF(
  csrfToken: string | undefined,
  sessionToken: string
): void {
  if (!csrfToken) {
    throw new Error("CSRF token missing");
  }

  if (!validateCSRFToken(csrfToken, sessionToken)) {
    throw new Error("Invalid CSRF token");
  }
}

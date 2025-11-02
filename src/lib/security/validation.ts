/**
 * Input Validation and Sanitization Utilities
 * Prevents injection attacks and validates user input
 */

import path from "path";

/**
 * Sanitize string input to prevent XSS
 * For production, consider using DOMPurify for more comprehensive sanitization
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Validate file path to prevent path traversal
 * @param userPath - User-provided file path
 * @param baseDir - Base directory to constrain to
 * @returns Validated path or throws error
 */
export function validateFilePath(userPath: string, baseDir: string): string {
  // Normalize the path
  const normalizedPath = path.normalize(userPath);

  // Resolve to absolute path
  const resolvedPath = path.resolve(baseDir, normalizedPath);
  const resolvedBase = path.resolve(baseDir);

  // Ensure resolved path is within base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error("Invalid file path: Path traversal detected");
  }

  // Check for dangerous characters
  if (/[<>:"|?*]/.test(userPath)) {
    throw new Error("Invalid file path: Contains illegal characters");
  }

  return resolvedPath;
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function validateURL(url: string, allowedDomains?: string[]): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // Check against allowed domains if provided
    if (allowedDomains && allowedDomains.length > 0) {
      return allowedDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    }

    // Prevent localhost and private IP access
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize search query to prevent injection
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove special characters that could be used for injection
  return query
    .replace(/[^\w\s-]/g, "")
    .trim()
    .substring(0, 200); // Limit length
}

/**
 * Validate numeric input with bounds
 */
export function validateNumber(
  value: number,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
): boolean {
  if (!Number.isFinite(value)) return false;
  if (!Number.isSafeInteger(value)) return false;
  return value >= min && value <= max;
}

/**
 * Safe integer addition with overflow protection
 */
export function safeAdd(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new Error("Input values must be safe integers");
  }

  const result = a + b;

  if (!Number.isSafeInteger(result)) {
    throw new Error("Integer overflow detected");
  }

  if (result > Number.MAX_SAFE_INTEGER || result < Number.MIN_SAFE_INTEGER) {
    throw new Error("Result exceeds safe integer range");
  }

  return result;
}

/**
 * Safe integer multiplication with overflow protection
 */
export function safeMultiply(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new Error("Input values must be safe integers");
  }

  const result = a * b;

  if (!Number.isSafeInteger(result)) {
    throw new Error("Integer overflow detected");
  }

  return result;
}

/**
 * Validate JSON input
 */
export function validateJSON(input: string, maxSize: number = 1048576): any {
  if (input.length > maxSize) {
    throw new Error("JSON input exceeds maximum size");
  }

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error("Invalid JSON input");
  }
}

/**
 * Sanitize object keys to prevent prototype pollution
 */
export function sanitizeObjectKeys(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const dangerous = ["__proto__", "constructor", "prototype"];

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectKeys);
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && !dangerous.includes(key)) {
      sanitized[key] = sanitizeObjectKeys(obj[key]);
    }
  }

  return sanitized;
}

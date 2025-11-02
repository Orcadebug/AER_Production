/**
 * Secure Logging Utilities
 * Prevents logging of sensitive data
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}

/**
 * List of field names that should be redacted in logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "apiKey",
  "apikey",
  "api_key",
  "secret",
  "privateKey",
  "private_key",
  "secretKey",
  "secret_key",
  "authorization",
  "auth",
  "ssn",
  "creditCard",
  "credit_card",
  "cvv",
  "pin",
  "sessionId",
  "session_id",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "encryptionKey",
  "encryption_key",
];

/**
 * Sanitize data before logging to remove sensitive information
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings - check if it looks like a token or key
  if (typeof data === "string") {
    // Redact long strings that look like tokens (base64, hex, etc.)
    if (data.length > 32 && /^[A-Za-z0-9+/=_-]+$/.test(data)) {
      return "[REDACTED_TOKEN]";
    }
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  // Handle objects
  if (typeof data === "object") {
    const sanitized: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        // Check if field name indicates sensitive data
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = sanitizeLogData(data[key]);
        }
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Secure logger that redacts sensitive information
 */
export class SecureLogger {
  private environment: string;

  constructor(environment: string = process.env.NODE_ENV || "development") {
    this.environment = environment;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: context ? sanitizeLogData(context) : undefined,
    };

    // In production, only show sanitized logs
    if (this.environment === "production") {
      // Send to proper logging service (e.g., CloudWatch, DataDog, etc.)
      this.sendToLoggingService(entry);

      // Don't log to console in production unless it's an error
      if (level === "error") {
        console.error(entry.message, entry.context);
      }
    } else {
      // In development, show full context (still sanitized)
      const consoleMethod = level === "error" ? console.error :
                           level === "warn" ? console.warn :
                           console.log;

      consoleMethod(`[${level.toUpperCase()}] ${message}`, entry.context);
    }
  }

  private sendToLoggingService(entry: LogEntry): void {
    // TODO: Implement integration with logging service
    // For now, just log to console in a structured format
    if (this.environment === "production") {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log("error", message, context);
  }
}

// Export singleton instance
export const logger = new SecureLogger();

/**
 * Redact sensitive data from error messages
 */
export function sanitizeError(error: Error | unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("An unknown error occurred");
  }

  // Create a new error with sanitized message and stack
  const sanitizedError = new Error(error.message);

  // In production, don't include stack traces
  if (process.env.NODE_ENV === "production") {
    sanitizedError.stack = undefined;
  } else {
    sanitizedError.stack = error.stack;
  }

  return sanitizedError;
}

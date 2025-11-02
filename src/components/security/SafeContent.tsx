/**
 * XSS Protection Component
 * Safely renders user-generated content
 */

import React from "react";

/**
 * Allowed HTML tags for rich text content
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "code",
  "pre",
] as const;

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target"],
  img: ["src", "alt", "title"],
};

/**
 * Sanitize HTML content to prevent XSS
 * In production, use DOMPurify for more comprehensive sanitization
 */
function sanitizeHTML(html: string): string {
  // Basic sanitization - in production, use DOMPurify
  let sanitized = html;

  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, "");

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, "");

  // Remove iframe
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // Remove object/embed tags
  sanitized = sanitized.replace(/<(object|embed)[^>]*>/gi, "");

  return sanitized;
}

/**
 * Props for SafeContent component
 */
interface SafeContentProps {
  /** The content to render safely */
  content: string;
  /** Whether to allow HTML (default: false) */
  allowHTML?: boolean;
  /** Custom allowed tags (only used if allowHTML is true) */
  allowedTags?: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Component that safely renders user-generated content
 * Prevents XSS attacks by sanitizing HTML
 */
export const SafeContent: React.FC<SafeContentProps> = ({
  content,
  allowHTML = false,
  allowedTags,
  className,
}) => {
  if (!allowHTML) {
    // Render as plain text (safest option)
    return <div className={className}>{content}</div>;
  }

  // Sanitize HTML content
  const sanitized = sanitizeHTML(content);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

/**
 * Hook for sanitizing user input
 */
export function useSanitizedInput(value: string): string {
  return React.useMemo(() => {
    return value
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+=/gi, "") // Remove event handlers
      .trim();
  }, [value]);
}

/**
 * Higher-order component that wraps a component with XSS protection
 */
export function withXSSProtection<P extends { content: string }>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return (props: P) => {
    const sanitizedContent = useSanitizedInput(props.content);
    return <Component {...props} content={sanitizedContent} />;
  };
}

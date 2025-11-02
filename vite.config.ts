import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Security headers
    headers: {
      // Prevent MIME type sniffing
      "X-Content-Type-Options": "nosniff",
      // Prevent clickjacking
      "X-Frame-Options": "DENY",
      // Enable XSS protection
      "X-XSS-Protection": "1; mode=block",
      // Force HTTPS
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      // Content Security Policy
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://brilliant-caribou-800.convex.site https://brilliant-caribou-800.convex.cloud",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://brilliant-caribou-800.convex.site https://brilliant-caribou-800.convex.cloud wss://brilliant-caribou-800.convex.cloud",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
      // Referrer Policy
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // Permissions Policy (formerly Feature Policy)
      "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    },
    // CORS configuration
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
      exposedHeaders: ["X-CSRF-Token"],
      maxAge: 86400, // 24 hours
    },
  },
  build: {
    // Security: Enable source maps only in development
    sourcemap: process.env.NODE_ENV === "development",
    // Use default esbuild minification (no terser dependency)
    minify: "esbuild",
  },
});

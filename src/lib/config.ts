// Application configuration
// Update these values when you're ready to rebrand
export const APP_CONFIG = {
  // Branding
  appName: "Aer",
  appDescription: "Your Personal Context Operating System",
  
  // Auth provider branding (shown in auth footer)
  authProvider: {
    name: "Aer",
    url: import.meta.env.VITE_APP_URL || "https://yourdomain.com",
  },
  
  // Support and documentation
  supportUrl: import.meta.env.VITE_SUPPORT_URL || "https://yourdomain.com/support",
  docsUrl: import.meta.env.VITE_DOCS_URL || "https://yourdomain.com/docs",
  
  // API Configuration
  convexUrl: import.meta.env.VITE_CONVEX_URL || "",
} as const;

// Helper to check if using default auth provider
export const isUsingDefaultAuth = () => APP_CONFIG.authProvider.name === "Aer";
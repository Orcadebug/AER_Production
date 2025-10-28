// Application configuration
// Update these values when you're ready to rebrand
export const APP_CONFIG = {
  // Branding
  appName: "Aer",
  appDescription: "Your Personal Context Operating System",
  
  // Auth provider branding (shown in auth footer)
  authProvider: {
    name: "Aer",
    url: "https://yourdomain.com",
  },
  
  // Support and documentation
  supportUrl: "https://yourdomain.com/support",
  docsUrl: "https://yourdomain.com/docs",
} as const;

// Helper to check if using default auth provider
export const isUsingDefaultAuth = () => APP_CONFIG.authProvider.name === "Aer";
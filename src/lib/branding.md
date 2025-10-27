# Rebranding Guide

When you're ready to move away from vly.ai branding:

## Step 1: Update Configuration
Edit `src/lib/config.ts` and update:
- `authProvider.name` - Your new auth provider name
- `authProvider.url` - Your new auth provider URL
- `supportUrl` - Your support page URL
- `docsUrl` - Your documentation URL

## Step 2: Backend Email Configuration
The email OTP service is currently using vly.ai's email service.
When ready to switch:
1. Set up your own email service (Resend, SendGrid, etc.)
2. Update `src/convex/auth/emailOtp.ts` with your email service endpoint
3. Update environment variables for your email service API keys

## Step 3: Remove vly.ai Toolbar (Optional)
The `VlyToolbar` component in `src/main.tsx` is for development.
For production, you can remove:
- Import: `import { VlyToolbar } from "../vly-toolbar-readonly.tsx";`
- Component: `<VlyToolbar />`

## Step 4: Update Environment Variables
Review and update any vly.ai specific environment variables:
- `VITE_VLY_APP_ID` - Replace with your own app identifier if needed

## Files to Review
- `src/lib/config.ts` - Main configuration
- `src/convex/auth/emailOtp.ts` - Email service (requires backend changes)
- `src/main.tsx` - Remove VlyToolbar for production
- `src/instrumentation.tsx` - Error reporting (already uses config)
- `src/pages/Auth.tsx` - Auth footer (already uses config)

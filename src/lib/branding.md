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
When ready to switch to Resend:
1. Sign up for Resend at https://resend.com
2. Get your Resend API key from the dashboard
3. Update `src/convex/auth/emailOtp.ts` to use Resend's API endpoint
4. Add your Resend API key to Convex environment variables (RESEND_API_KEY)

## Step 3: Deployment Setup
Your architecture uses:
- **Vercel** - Frontend hosting (connect your GitHub repo)
- **Convex** - Backend and database (already configured)
- **GitHub** - Version control and CI/CD
- **Resend** - Email OTP delivery

### Vercel Setup:
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_CONVEX_URL` - Your Convex deployment URL
3. Deploy automatically on push to main branch

### Convex Setup:
1. Run `npx convex deploy` for production
2. Set environment variables in Convex dashboard:
   - `RESEND_API_KEY` - Your Resend API key
   - `SITE_URL` - Your production domain

## Step 4: Remove vly.ai Toolbar (Optional)
The `VlyToolbar` component in `src/main.tsx` is for development.
For production, you can remove:
- Import: `import { VlyToolbar } from "../vly-toolbar-readonly.tsx";`
- Component: `<VlyToolbar />`

## Step 5: Update Environment Variables
Review and update any vly.ai specific environment variables:
- `VITE_VLY_APP_ID` - Replace with your own app identifier if needed

## Files to Review
- `src/lib/config.ts` - Main configuration
- `src/convex/auth/emailOtp.ts` - Email service (requires backend changes)
- `src/main.tsx` - Remove VlyToolbar for production
- `src/instrumentation.tsx` - Error reporting (already uses config)
- `src/pages/Auth.tsx` - Auth footer (already uses config)
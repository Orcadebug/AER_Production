# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AER is a modern full-stack application with end-to-end encryption, real-time collaboration features, and AI-powered content analysis. The frontend is built with React 19, Vite, and Tailwind CSS. The backend uses Convex for serverless functions and real-time database.

### Tech Stack
- **Frontend**: Vite + React 19 + React Router v7 + TypeScript + Tailwind v4
- **UI Components**: Shadcn UI + Radix UI
- **Backend**: Convex (serverless + real-time database)
- **Authentication**: Convex Auth (email OTP + anonymous users)
- **AI**: Perplexity AI (tag generation, semantic search, summaries)
- **3D Graphics**: Three.js with React Three Fiber
- **Animations**: Framer Motion
- **Styling**: Tailwind CSS v4 with oklch color format

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server with HMR
pnpm dev

# Build for production (type-check + Vite build)
pnpm build

# Run linter
pnpm lint

# Format code
pnpm format

# Preview production build locally
pnpm preview
```

## Project Structure

```
src/
├── pages/                  # Page components (routing targets)
│   ├── Auth.tsx           # Authentication page
│   ├── Dashboard.tsx      # Main dashboard
│   ├── Landing.tsx        # Public landing page
│   ├── Settings.tsx       # User settings
│   ├── Support.tsx        # Support/feedback page
│   ├── OAuthConsent.tsx   # OAuth consent flow
│   ├── Terms.tsx          # Terms of service
│   ├── Privacy.tsx        # Privacy policy
│   └── NotFound.tsx       # 404 page
├── components/
│   ├── ui/                # Shadcn UI primitives (don't modify)
│   ├── security/          # Security components (ErrorBoundary, SafeContent)
│   └── [other components] # Feature-specific components
├── hooks/
│   ├── use-auth.ts        # Authentication hook
│   ├── use-encryption.ts  # Client-side encryption
│   └── use-mobile.ts      # Mobile detection
├── lib/                   # Utility functions and helpers
├── types/                 # TypeScript type definitions
├── convex/                # Backend serverless functions & database
│   ├── _generated/        # Auto-generated Convex API types
│   ├── schema.ts          # Database schema definition
│   ├── auth/              # Authentication setup (DO NOT MODIFY)
│   ├── auth.ts            # Auth exports
│   ├── auth.config.ts     # Auth configuration
│   ├── users.ts           # User queries/mutations
│   ├── contexts.ts        # Context/note management
│   ├── contextsInternal.ts # Internal context helpers
│   ├── projects.ts        # Project management
│   ├── projectsInternal.ts # Internal project helpers
│   ├── tags.ts            # Tag management
│   ├── ai.ts              # AI tag generation & semantic search
│   ├── httpApi.ts         # HTTP endpoints for external integrations
│   ├── http.ts            # HTTP utilities
│   ├── oauth.ts           # OAuth flow
│   ├── oauthInternal.ts   # Internal OAuth helpers
│   ├── oauthPublic.ts     # Public OAuth endpoints
│   ├── payments.ts        # Payment management
│   ├── payApi.ts          # Payment API endpoints
│   ├── paymentsWebhook.ts # Payment webhook handlers
│   ├── paymentsInternal.ts # Internal payment helpers
│   ├── audit.ts           # Audit logging
│   ├── admin.ts           # Admin functions
│   ├── entitlements.ts    # Entitlements/permissions
│   ├── redeem.ts          # Redemption code handling
│   ├── crypto.ts          # Encryption utilities
│   ├── feedback.ts        # Feedback/support tickets
│   └── mcp/               # Model context protocol for AI integrations
│       ├── index.ts       # MCP integration entry point
│       ├── aiModels.ts    # AI model configuration
│       └── server.ts      # MCP server
├── instrumentation.tsx    # Analytics and observability
├── index.css              # Tailwind configuration & color variables
└── main.tsx               # Application entry point with routing
```

## Critical Authentication Files (DO NOT MODIFY)

- `src/convex/auth/` - Core Convex Auth setup directory
- `src/convex/auth.ts` - Auth exports
- `src/convex/auth.config.ts` - Auth configuration
- `src/convex/auth/emailOtp.ts` - Email OTP provider configuration
- `src/main.tsx` - Routes and auth provider setup with ConvexAuthProvider

## Key Architecture Patterns

### Frontend Architecture

**Routing**: React Router v7 centralized in `src/main.tsx`. Routes include `/`, `/dashboard`, `/settings`, `/support`, `/terms`, `/privacy`, `/auth`, `/oauth/consent`. Add new routes there and create corresponding page components in `src/pages/`.

**Authentication Hook**: Always use `useAuth()` hook from `@/hooks/use-auth` to access user data. Example:
```typescript
const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

**Protected Routes**: Check `isAuthenticated` and redirect to `/auth` for unauthenticated users. The `/auth` page handles all login/signup flows.

**UI Component Pattern**: Use Shadcn UI primitives from `src/components/ui/` with Tailwind classes. Follow conventions:
- Use `cursor-pointer` on clickable elements (not default)
- Use `tracking-tight font-bold` for titles
- Avoid nested cards—prefer borders without shadows
- Always ensure mobile responsiveness
- Use `motion` component from framer-motion for animations

**Theming**: Override colors in `src/index.css` using oklch format. Components automatically support light/dark mode via `dark` className.

### Backend Architecture

**Database Schema**: Defined in `src/convex/schema.ts`. Key tables:
- `users` - User profiles with role-based access (admin/user/member)
- `contexts` - Main content table with end-to-end encryption (plaintext title for search, encrypted content)
- `projects` - User project organization
- `tags` - AI-generated semantic tags for search
- `feedback` - Support tickets
- `auditLog` - Encryption event logging
- `payments` - Payment transactions and history
- `entitlements` - User feature entitlements

**Convex Patterns**:
- **Queries**: Get data, use in React components via `useQuery()` hook
- **Mutations**: Modify data, use via `useMutation()` hook
- **Actions**: External API calls (require `"use node"`), use via `useAction()` hook
- **Internal Functions**: Server-only helpers, prefixed with `internal.*`, defined in `*Internal.ts` files

**CRUD Operations**: Use pre-built CRUD helpers in files like `users.ts`:
```typescript
import { crud } from "convex-helpers/server/crud";
const { create, read, update, destroy } = crud(schema, "tableName");
```

**HTTP API**: Public endpoints in `src/convex/httpApi.ts` for external integrations. All endpoints require bearer token authentication. Payment webhooks in `paymentsWebhook.ts`.

**AI Integration**: 
- Tag generation (`generateTags` action) creates 3-10 hierarchical tags based on content
- Semantic search (`semanticSearchPublic`) ranks contexts by relevance
- Summary generation (`generateSummary`) creates 2-3 sentence summaries
- Perplexity AI API requires `PERPLEXITY_API_KEY` environment variable
- MCP integration in `src/convex/mcp/` for AI model context protocol

**Payments & Entitlements**: 
- Stripe integration via `payments.ts` and `payApi.ts`
- Payment webhooks handled in `paymentsWebhook.ts`
- Feature entitlements managed in `entitlements.ts`
- Redemption codes handled in `redeem.ts`

**OAuth Flow**: 
- OAuth configuration in `oauth.ts`, `oauthInternal.ts`, `oauthPublic.ts`
- OAuth consent flow page at `/oauth/consent`

**Encryption Model**: 
- Content is encrypted client-side and stored as `{ciphertext, nonce}` objects
- Titles are plaintext for indexing/search but can have encrypted versions
- Keys are stored client-side only; metadata stored on server for audit purposes

### Authentication Flow

1. User navigates to `/auth`
2. Email OTP verification via Convex Auth
3. User created/logged in with `useAuth()` hook
4. On success, redirect via `redirectAfterAuth` parameter (currently `/dashboard`)
5. Protected pages check `isAuthenticated` and use `user` object

## Important Development Notes

### Common Type Issues
- Document IDs: Use `_id` field, typed as `Id<"TableName">`, not `string`
- Document objects: Type as `Doc<"TableName">`
- Return types: Never use validators for return types in Convex

### Data Handling
- Handle null/undefined cases for all Convex queries on frontend and backend
- Use `@/folder` path syntax for all imports (configured in tsconfig.json)
- Import from `convex/react` for hooks: `useQuery`, `useMutation`, `useAction`

### API Endpoints
- POST `/api/context/upload` - Single context upload with bearer token
- POST `/api/context/batch-upload` - Batch context upload
- POST `/api/search` - Semantic search endpoint
- POST `/api/tags` - Generate tags for content
- POST `/api/payment` - Payment endpoints (Stripe)
- Bearer token format: `aer_{userId}`

### File Uploads
- `fileId` references Convex storage (actual files not encrypted)
- `fileName`, `fileType`, `url` store metadata
- Storage cleanup should be handled when contexts are deleted

### UI Conventions
- Use `Loader2` icon from lucide-react for loading states (not skeletons)
- Use `toast()` from sonner for notifications
- Ensure dialogs with large content have scrollable areas
- Prefer dialogs over new pages for modals

## Environment Variables

**Client-side** (in `.env` or Vite config):
- `VITE_CONVEX_URL` - Convex deployment URL

**Server-side** (Convex dashboard):
- `PERPLEXITY_API_KEY` - Perplexity AI API key for tag/summary generation
- `JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL` - Auth-specific keys

## Testing

Currently no test suite configured. Check `package.json` for any test commands before running.

## Linting & Type Checking

Run before committing:
```bash
pnpm lint           # ESLint with TypeScript
pnpm build          # TypeScript compilation (includes tsc -b)
```

ESLint config: `eslint.config.js` with TypeScript, React Hooks, and Prettier integration.

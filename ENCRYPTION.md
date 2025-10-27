# End-to-End Encryption Implementation

## Overview

Aer now implements end-to-end encryption (E2E) for all user context data. This means:
- All content is encrypted **client-side** before being sent to the server
- The server stores only encrypted data and cannot read user content
- Only the user's browser can decrypt their data using their private key
- All encryption/decryption events are logged for audit compliance

## Architecture

### Key Management
- Each user has a unique RSA-2048 key pair (public/private keys)
- Private keys are encrypted with a user-derived key before storage
- Keys are generated on first login and stored in the database
- Key version tracking allows for future key rotation

### Encryption Flow
1. **Client-side encryption:**
   - User creates content in the web app
   - Content is encrypted using AES-256-GCM with a symmetric key
   - Symmetric key is encrypted with user's public key
   - Encrypted content + encrypted key sent to server

2. **Server storage:**
   - Server receives encrypted payload
   - Validates user authentication
   - Stores encrypted data without decryption
   - Logs audit event

3. **Client-side decryption:**
   - User requests their data
   - Server returns encrypted content
   - Client decrypts using user's private key
   - Content displayed in UI

### API Endpoints

All endpoints require authentication via JWT/session token:

- `POST /api/context/upload` - Upload single encrypted context
- `POST /api/context/batch-upload` - Upload multiple encrypted contexts
- `GET /api/context/feed` - Retrieve encrypted context feed
- `DELETE /api/context/:id` - Delete specific context
- `DELETE /api/context/all` - Delete all user data

### Security Features

1. **User Scoping:** All data is cryptographically linked to authenticated user
2. **Encryption at Rest:** Data stored encrypted in Convex database
3. **Encryption in Transit:** HTTPS for all API calls
4. **Audit Logging:** All encryption events logged with timestamps
5. **Key Rotation:** Version tracking allows future key updates
6. **No Server Access:** Server cannot decrypt user content

### Database Schema

New fields added to support E2E encryption:

**Users table:**
- `publicKey` - User's RSA public key
- `encryptedPrivateKey` - User's encrypted private key
- `keyVersion` - Key version for rotation

**Contexts table:**
- `encryptedContent` - Encrypted content data
- `encryptedTitle` - Encrypted title
- `encryptedMetadata` - Encrypted metadata
- `encryptedTags` - Encrypted tags
- `isEncrypted` - Flag indicating encryption status
- `encryptionVersion` - Encryption algorithm version

**Audit Logs table:**
- `userId` - User who performed action
- `action` - Type of action (UPLOAD, DELETE, etc.)
- `resourceType` - Type of resource (context, project, etc.)
- `resourceId` - ID of affected resource
- `success` - Whether action succeeded
- `errorMessage` - Error details if failed

## Usage

### Frontend Integration


# End-to-End Encryption Implementation

## Overview

Aer now implements end-to-end encryption (E2E) for all user content. This means:
- All sensitive data is encrypted **client-side** before being sent to the server
- The server stores only encrypted data and cannot read user content
- Decryption happens only in the user's browser using their encryption key
- Encryption keys are stored in browser sessionStorage (cleared on tab close)

## Architecture

### Encryption Library
- **TweetNaCl** (NaCl/libsodium): Industry-standard cryptography library
- **Symmetric encryption**: Uses `secretbox` (XSalsa20-Poly1305)
- **Key derivation**: PBKDF2 with 100,000 iterations for password-based keys

### Key Management
- Each user has a unique symmetric encryption key
- Keys are generated on first login and stored in sessionStorage
- Keys are never sent to the server
- Keys are cleared when the user signs out or closes the tab

### Encrypted Fields

#### Contexts (Notes/Files)
- `encryptedContent`: The actual note/file content
- `encryptedTitle`: The full title (plaintext title kept for search)
- `encryptedSummary`: AI-generated summary
- `encryptedMetadata`: Additional metadata

#### Projects
- `encryptedName`: Full project name
- `encryptedDescription`: Project description

#### Tags
- `encryptedName`: Full tag name

### Plaintext Fields (for indexing)
- `title`: Truncated/sanitized version for search indexing
- `type`: Context type (note/file/web)
- `userId`: For user scoping
- Timestamps and IDs

## Usage

### Frontend (React)


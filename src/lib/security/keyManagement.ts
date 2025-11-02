/**
 * Secure Key Management
 * Handles encryption keys and secrets securely
 *
 * IMPORTANT: In production, use a proper KMS like AWS KMS, Azure Key Vault, or HashiCorp Vault
 */

import crypto from "crypto";

/**
 * Key derivation configuration
 */
const KEY_DERIVATION_CONFIG = {
  algorithm: "pbkdf2",
  iterations: 600000, // OWASP recommended minimum for PBKDF2-SHA256
  keyLength: 32, // 256 bits
  digest: "sha256",
  saltLength: 16,
} as const;

/**
 * Derive a cryptographic key from a password
 * @param password - The password to derive from
 * @param salt - Salt for key derivation (if not provided, generates new one)
 * @returns Object containing derived key and salt
 */
export async function deriveKey(
  password: string,
  salt?: Buffer
): Promise<{ key: Buffer; salt: Buffer }> {
  const actualSalt = salt || crypto.randomBytes(KEY_DERIVATION_CONFIG.saltLength);

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      actualSalt,
      KEY_DERIVATION_CONFIG.iterations,
      KEY_DERIVATION_CONFIG.keyLength,
      KEY_DERIVATION_CONFIG.digest,
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve({ key: derivedKey, salt: actualSalt });
      }
    );
  });
}

/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - Data to encrypt
 * @param key - Encryption key (32 bytes)
 * @returns Encrypted data with IV and auth tag
 */
export function encryptWithKey(
  plaintext: string,
  key: Buffer
): { ciphertext: string; iv: string; authTag: string } {
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (256 bits)");
  }

  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param ciphertext - Encrypted data
 * @param key - Decryption key (32 bytes)
 * @param iv - Initialization vector
 * @param authTag - Authentication tag
 * @returns Decrypted plaintext
 */
export function decryptWithKey(
  ciphertext: string,
  key: Buffer,
  iv: string,
  authTag: string
): string {
  if (key.length !== 32) {
    throw new Error("Decryption key must be 32 bytes (256 bits)");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a secure random token
 * @param length - Length in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash a password using Argon2 (requires argon2 package)
 * For now, using scrypt as a fallback
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);

  return new Promise((resolve, reject) => {
    // Using scrypt instead of argon2 for Node.js compatibility
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else {
        // Format: algorithm$salt$hash
        resolve(`scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`);
      }
    });
  });
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    throw new Error("Invalid password hash format");
  }

  const salt = Buffer.from(parts[1], "hex");
  const storedHash = parts[2];

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else {
        const derivedHash = derivedKey.toString("hex");
        // Use timing-safe comparison
        resolve(
          crypto.timingSafeEqual(
            Buffer.from(storedHash, "hex"),
            Buffer.from(derivedHash, "hex")
          )
        );
      }
    });
  });
}

/**
 * Encrypt environment variable value
 * This is used to encrypt secrets before storing them
 */
export function encryptSecret(secret: string, masterKey: string): string {
  const key = crypto.createHash("sha256").update(masterKey).digest();
  const result = encryptWithKey(secret, key);
  return `${result.iv}:${result.authTag}:${result.ciphertext}`;
}

/**
 * Decrypt environment variable value
 */
export function decryptSecret(encrypted: string, masterKey: string): string {
  const [iv, authTag, ciphertext] = encrypted.split(":");
  const key = crypto.createHash("sha256").update(masterKey).digest();
  return decryptWithKey(ciphertext, key, iv, authTag);
}

/**
 * Get secret from environment with optional decryption
 * Supports both plain and encrypted secrets
 */
export function getSecret(key: string, encrypted: boolean = false): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Secret ${key} not found in environment`);
  }

  if (!encrypted) {
    return value;
  }

  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error("MASTER_ENCRYPTION_KEY not configured");
  }

  try {
    return decryptSecret(value, masterKey);
  } catch (error) {
    throw new Error(`Failed to decrypt secret ${key}`);
  }
}

import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

/**
 * Client-side encryption utilities using TweetNaCl (NaCl/libsodium)
 * All encryption happens in the browser before data is sent to the server
 */

export interface EncryptedData {
  ciphertext: string;
  nonce: string;
}

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

/**
 * Generate a new encryption key pair for a user
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}

/**
 * Derive a symmetric key from password (for key encryption)
 * In production, use a proper KDF like Argon2 or PBKDF2
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(salt);

  // Use Web Crypto API for key derivation
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * Encrypt data using symmetric encryption (secretbox)
 * This is used for encrypting user content
 */
export function encryptData(data: string, secretKey: string): EncryptedData {
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(data);
  const keyUint8 = decodeBase64(secretKey);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

  const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt data using symmetric encryption (secretbox)
 */
export function decryptData(
  encryptedData: EncryptedData,
  secretKey: string
): string | null {
  try {
    const ciphertext = decodeBase64(encryptedData.ciphertext);
    const nonce = decodeBase64(encryptedData.nonce);
    const keyUint8 = decodeBase64(secretKey);

    const decrypted = nacl.secretbox.open(ciphertext, nonce, keyUint8);

    if (!decrypted) {
      return null;
    }

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

/**
 * Generate a symmetric key for encrypting user data
 */
export function generateSymmetricKey(): string {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  return encodeBase64(key);
}

/**
 * Store encryption key securely in browser
 * Uses sessionStorage for security (cleared on tab close)
 */
export function storeEncryptionKey(userId: string, key: string): void {
  sessionStorage.setItem(`encryption_key_${userId}`, key);
}

/**
 * Retrieve encryption key from browser storage
 */
export function getEncryptionKey(userId: string): string | null {
  return sessionStorage.getItem(`encryption_key_${userId}`);
}

/**
 * Clear encryption key from browser storage
 */
export function clearEncryptionKey(userId: string): void {
  sessionStorage.removeItem(`encryption_key_${userId}`);
}

/**
 * Encrypt object fields
 */
export function encryptObject(
  obj: Record<string, any>,
  secretKey: string,
  fieldsToEncrypt: string[]
): Record<string, any> {
  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (obj[field] !== undefined && obj[field] !== null) {
      const value = typeof obj[field] === "string" ? obj[field] : JSON.stringify(obj[field]);
      encrypted[field] = encryptData(value, secretKey);
    }
  }

  return encrypted;
}

/**
 * Decrypt object fields
 */
export function decryptObject(
  obj: Record<string, any>,
  secretKey: string,
  fieldsToDecrypt: string[]
): Record<string, any> | null {
  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (obj[field] && typeof obj[field] === "object" && obj[field].ciphertext) {
      const decryptedValue = decryptData(obj[field], secretKey);
      if (decryptedValue === null) {
        return null;
      }
      decrypted[field] = decryptedValue;
    }
  }

  return decrypted;
}

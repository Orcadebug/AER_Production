import nacl from "tweetnacl";

function b64encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // @ts-ignore
  return btoa(binary);
}

function b64decode(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  // @ts-ignore
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function getServerKey(): Uint8Array {
  const keyB64 = process.env.SERVER_ENC_KEY_B64;
  if (!keyB64) {
    throw new Error("SERVER_ENC_KEY_B64 is not set");
  }
  const key = b64decode(keyB64);
  if (key.length !== 32) {
    throw new Error("SERVER_ENC_KEY_B64 must decode to 32 bytes");
  }
  return key;
}

export function serverEncryptString(plaintext: string): { ciphertext: string; nonce: string } {
  const key = getServerKey();
  const nonce = nacl.randomBytes(24);
  const message = new TextEncoder().encode(plaintext);
  const boxed = nacl.secretbox(message, nonce, key);
  return { ciphertext: b64encode(boxed), nonce: b64encode(nonce) };
}

export function serverDecryptString(ciphertextB64: string, nonceB64: string): string | null {
  try {
    const key = getServerKey();
    const ciphertext = b64decode(ciphertextB64);
    const nonce = b64decode(nonceB64);
    const opened = nacl.secretbox.open(ciphertext, nonce, key);
    if (!opened) return null;
    return new TextDecoder().decode(opened);
  } catch (e) {
    return null;
  }
}

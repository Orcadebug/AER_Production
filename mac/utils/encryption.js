const crypto = require('crypto');
const nacl = require('tweetnacl');

// For compatibility with web/extension decryption, derive a 32-byte key from userId (token format aer_{userId})
function keyFromToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('aer_')) {
    throw new Error('Invalid token format; expected aer_{userId}');
  }
  const userId = token.substring(4);
  return new Uint8Array(crypto.createHash('sha256').update(userId, 'utf8').digest());
}

// No-op to keep call sites simple
async function ensureKey() {}
ensureKey.sync = () => {};

async function encryptBuffer(dataBuf, token) {
  const key = keyFromToken(token);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msg = Buffer.isBuffer(dataBuf) ? new Uint8Array(dataBuf) : new Uint8Array(Buffer.from(String(dataBuf)));
  const boxed = nacl.secretbox(msg, nonce, key);
  return {
    ciphertext: Buffer.from(boxed).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64')
  };
}

module.exports = { ensureKey, encryptBuffer };

import base64
import os
from typing import Tuple
from nacl.secret import SecretBox
from nacl.exceptions import CryptoError


def b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode('utf-8')


def b64decode(data: str) -> bytes:
    return base64.b64decode(data.encode('utf-8'))


def generate_key() -> str:
    """Generate a new 32-byte key encoded in base64."""
    key = os.urandom(SecretBox.KEY_SIZE)
    return b64encode(key)


def encrypt_json(json_bytes: bytes, key_b64: str) -> Tuple[str, str]:
    """Encrypt arbitrary bytes using XSalsa20-Poly1305 (libsodium SecretBox).

    Returns (ciphertext_b64, nonce_b64)
    """
    key = b64decode(key_b64)
    if len(key) != SecretBox.KEY_SIZE:
        raise ValueError("Invalid key length; expected 32-byte base64 key")
    nonce = os.urandom(24)
    box = SecretBox(key)
    ct = box.encrypt(json_bytes, nonce)
    # PyNaCl prepends nonce to ciphertext; we used explicit nonce so slice after 24
    ciphertext = ct.ciphertext
    return b64encode(ciphertext), b64encode(nonce)


def decrypt_to_bytes(ciphertext_b64: str, nonce_b64: str, key_b64: str) -> bytes:
    key = b64decode(key_b64)
    nonce = b64decode(nonce_b64)
    box = SecretBox(key)
    try:
        # SecretBox expects nonce+ciphertext
        ct = b64decode(ciphertext_b64)
        combined = nonce + ct
        return box.decrypt(combined)
    except CryptoError as e:
        raise ValueError("Decryption failed") from e

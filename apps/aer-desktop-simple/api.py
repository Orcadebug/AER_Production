import requests
import io
import json
import base64
from PIL import Image
from typing import Tuple
from crypto import encrypt_json


def upload_context(image: Image.Image, text: str, token: str, api_url: str, enc_key_b64: str) -> str:
    """Encrypt screenshot payload client-side and upload to Aer API."""
    try:
        # Prepare image as base64 PNG
        image_buffer = io.BytesIO()
        image.save(image_buffer, format='PNG')
        image_bytes = image_buffer.getvalue()
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')

        # Build plaintext payload for encryption
        payload = {
            'kind': 'screenshot',
            'ocrText': text or '',
            'image': {
                'mime': 'image/png',
                'data': image_b64,
            },
            'createdAt': __import__('time').time(),
        }
        plaintext = json.dumps(payload).encode('utf-8')

        ciphertext_b64, nonce_b64 = encrypt_json(plaintext, enc_key_b64)

        body = {
            'encryptedContent': { 'ciphertext': ciphertext_b64, 'nonce': nonce_b64 },
            'encryptedTitle': None,
            'encryptedSummary': None,
            'encryptedMetadata': None,
            'tags': [],
        }

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }

        response = requests.post(
            f"{api_url}/api/context/upload",
            data=json.dumps(body),
            headers=headers,
            timeout=30
        )
        
        if response.status_code in (200, 201):
            return "Successfully uploaded to Aer"
        else:
            raise Exception(f"Upload failed: {response.status_code} - {response.text}")
    
    except requests.exceptions.Timeout:
        raise Exception("Upload timeout - check your internet connection")
    except requests.exceptions.ConnectionError:
        raise Exception("Connection error - check your API URL")
    except Exception as e:
        raise Exception(f"Upload error: {str(e)}")

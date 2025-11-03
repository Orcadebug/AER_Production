import requests
import io
from PIL import Image
from typing import Tuple

def upload_context(image: Image.Image, text: str, token: str, api_url: str) -> str:
    """Upload screenshot and extracted text to Aer API."""
    try:
        # Prepare image for upload
        image_buffer = io.BytesIO()
        image.save(image_buffer, format='PNG')
        image_buffer.seek(0)
        
        # Prepare files and data
        files = {
            'file': ('screenshot.png', image_buffer, 'image/png')
        }
        
        data = {
            'title': 'Screenshot',
            'content': text or '(Screenshot with no extracted text)',
        }
        
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        # Upload to Aer
        response = requests.post(
            f"{api_url}/api/context/upload",
            files=files,
            data=data,
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

import platform
from PIL import Image, ImageGrab
import pytesseract
from typing import Optional

def capture_screen() -> Image.Image:
    """Capture the current screen."""
    try:
        # Simple cross-platform screenshot using PIL
        screenshot = ImageGrab.grab()
        return screenshot
    except Exception as e:
        raise Exception(f"Failed to capture screenshot: {e}")

def extract_text(image: Image.Image) -> str:
    """Extract text from image using Tesseract OCR."""
    try:
        # Try to extract text using pytesseract
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text: {e}")

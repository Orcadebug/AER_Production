# Aer Capture - Linux Desktop App

A simple, user-friendly desktop app for capturing screenshots, extracting text via OCR, and uploading them to Aer.

**Linux only** · One-click install · Works on Ubuntu, Debian, Fedora, Arch

## Features

- 📸 **One-click screenshot capture** with live preview
- 🔤 **Automatic OCR** to extract text from screenshots
- 🔐 **End-to-end encryption** (client-side with a user key)
- 🚀 **One-click send** to upload to Aer
- ⚙️ **Simple settings** for API token and preferences
- 🎨 **Clean, minimal UI** similar to the Chrome extension
- 🔒 **Secure token storage** in `~/.aer-capture/config.json`

## Quick Install (Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/Orcadebug/AER_Production/main/apps/aer-desktop-simple/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/Orcadebug/AER_Production.git
cd AER_Production/apps/aer-desktop-simple
chmod +x install.sh
./install.sh
```

## Running the App

After installation:

```bash
aer-capture
```

Or from source:

```bash
python3 main.py
```

## Configuration

1. Click **⚙️ Settings** in the app
2. Enter your Aer API token (format: `aer_xxxxx`)
3. Click "Generate New Key" to create your encryption key (save it if using multiple devices)
4. Optionally change the API URL (default: `https://aercarbon.com`)
5. Toggle "Auto-extract text from screenshots" if needed
6. Click **Save**

## Usage

1. Click **📸 Take Screenshot**
2. App captures screen and shows preview
3. Text is automatically extracted via OCR
4. Review the extracted text
5. Click **✓ Send to Aer** to upload
6. Success notification appears when done

## Getting Your API Token

1. Go to https://aercarbon.com
2. Log in to your account
3. Go to Settings → API Tokens
4. Copy your token or create a new one

## System Requirements

- **Linux** (Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch Linux)
- Python 3.8+
- Tesseract OCR
- Qt6 libraries

## Manual Installation

### 1. Install Tesseract OCR

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install tesseract-ocr
```

**Fedora/RHEL:**
```bash
sudo dnf install tesseract
```

**Arch Linux:**
```bash
sudo pacman -S tesseract
```

### 2. Install Python Dependencies

```bash
cd apps/aer-desktop-simple
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the App

```bash
python3 main.py
```

## Troubleshooting

**"Tesseract is not installed" error:**
```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr

# Fedora
sudo dnf install tesseract

# Arch
sudo pacman -S tesseract
```

**"Upload failed" error:**
- Check your API token in Settings
- Verify your API URL is correct
- Check your internet connection

**Screenshot capture fails:**
- Try running with: `python3 -u main.py` to see error messages
- Ensure display server is available (run `echo $DISPLAY`)

**"Qt.qpa.plugin: Could not find the Qt platform plugin" error:**
```bash
sudo apt install libqt6gui6 libqt6core6
```

## Project Structure

```
apps/aer-desktop-simple/
├── main.py              # Entry point
├── config.py            # Configuration management
├── capture.py           # Screenshot & OCR
├── api.py              # Upload functionality
├── requirements.txt     # Python dependencies
├── install.sh          # Installation script
├── ui/
│   ├── __init__.py
│   ├── main_window.py  # Main UI window
│   └── settings_dialog.py  # Settings dialog
└── README.md           # This file
```

## Uninstall

```bash
# If installed via install.sh
sudo rm /usr/local/bin/aer-capture
rm -rf ~/.aer-capture
```

## License

Private project - Aer

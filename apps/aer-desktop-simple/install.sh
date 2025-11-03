#!/bin/bash
set -e

echo "🚀 Installing Aer Capture for Linux..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Linux
if [[ ! "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${YELLOW}⚠️  This script is for Linux only${NC}"
    exit 1
fi

# Detect Linux distro
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
else
    echo "Could not detect Linux distribution"
    exit 1
fi

echo -e "${BLUE}Detected: $PRETTY_NAME${NC}"

# Handle EOL Ubuntu releases (e.g., oracular) by switching to old-releases
if [[ "$DISTRO" == "ubuntu" || "$DISTRO" == "debian" ]]; then
    if [[ "$VERSION_CODENAME" == "oracular" || "$VERSION_CODENAME" == "mantic" ]] || \
       grep -Rq 'ubuntu-ports.*oracular' /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null; then
        echo -e "${YELLOW}Detected EOL Ubuntu sources; switching to old-releases.ubuntu.com...${NC}"
        sudo sed -i.bak -E 's|http://ports.ubuntu.com/ubuntu-ports|http://old-releases.ubuntu.com/ubuntu|g; s|http://(archive|security).ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list || true
        for f in /etc/apt/sources.list.d/*.list; do 
            [ -f "$f" ] && sudo sed -i.bak -E 's|http://ports.ubuntu.com/ubuntu-ports|http://old-releases.ubuntu.com/ubuntu|g; s|http://(archive|security).ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' "$f" || true
        done
        sudo apt-get update || true
    fi
fi

# Install Tesseract if not present
if ! command -v tesseract &> /dev/null; then
    echo -e "${YELLOW}Installing Tesseract OCR...${NC}"
    
    case "$DISTRO" in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y tesseract-ocr
            ;;
        fedora|rhel|centos)
            sudo dnf install -y tesseract
            ;;
        arch)
            sudo pacman -Sy --noconfirm tesseract
            ;;
        *)
            echo -e "${YELLOW}Please install tesseract manually for your distro${NC}"
            echo "See README.md for instructions"
            ;;
    esac
else
    echo -e "${GREEN}✓ Tesseract already installed${NC}"
fi

# Install Qt6 libraries if needed
echo -e "${YELLOW}Installing Qt6 libraries...${NC}"
case "$DISTRO" in
    ubuntu|debian)
        sudo apt-get install -y libqt6gui6 libqt6core6
        ;;
    fedora|rhel|centos)
        sudo dnf install -y qt6-qtbase
        ;;
    arch)
        sudo pacman -Sy --noconfirm qt6-base
        ;;
esac

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo -e "${GREEN}✓ Found Python $PYTHON_VERSION${NC}"

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create virtual environment
echo -e "${YELLOW}Creating virtual environment...${NC}"
python3 -m venv "$SCRIPT_DIR/venv"
source "$SCRIPT_DIR/venv/bin/activate"

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install --upgrade pip
pip install -r "$SCRIPT_DIR/requirements.txt"

# Create executable wrapper
echo -e "${YELLOW}Setting up executable...${NC}"
WRAPPER_PATH="/usr/local/bin/aer-capture"
PYTHON_PATH="$SCRIPT_DIR/venv/bin/python3"
MAIN_PATH="$SCRIPT_DIR/main.py"

sudo tee "$WRAPPER_PATH" > /dev/null <<EOF
#!/bin/bash
$PYTHON_PATH $MAIN_PATH
EOF

sudo chmod +x "$WRAPPER_PATH"

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo -e "${BLUE}To run Aer Capture:${NC}"
echo "  aer-capture"
echo ""
echo -e "${BLUE}To uninstall:${NC}"
echo "  sudo rm /usr/local/bin/aer-capture"
echo "  rm -rf ~/.aer-capture"

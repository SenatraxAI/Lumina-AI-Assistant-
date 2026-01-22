#!/bin/bash
# Setup_Lumina.sh (macOS Installer)

echo "========================================"
echo "  LUMINA AI: macOS SETUP ASSISTANT 🍎"
echo "========================================"
echo ""

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed!"
    echo "Please install it: brew install python"
    exit 1
fi

# 2. Setup Venv
echo "[1/3] Creating virtual environment..."
if [ ! -d "server/venv" ]; then
    python3 -m venv server/venv
fi

echo "[2/3] Installing dependencies..."
source server/venv/bin/activate
pip install -r server/requirements.txt --quiet

# 3. Register Native Host
echo "[3/3] Registering Lumina Bridge with Chrome..."

# Get absolute path for manifest
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

ABSOLUTE_PATH=$(pwd)
HOST_JSON="$ABSOLUTE_PATH/server/com.lumina.bridge.json"
BRIDGE_SH="$ABSOLUTE_PATH/server/bridge.sh"

# Make bridge executable
chmod +x "$BRIDGE_SH"

# Update path in JSON
# Note: uses perl because sed -i is inconsistent on Mac
perl -i -pe "s|bridge.bat|$BRIDGE_SH|g" "$HOST_JSON"

# Link to Chrome folder
cp "$HOST_JSON" "$MANIFEST_DIR/com.lumina.bridge.json"

echo ""
echo "========================================"
echo "  🎉 macOS SETUP COMPLETE!"
echo "========================================"
echo ""
echo "1. Go to chrome://extensions"
echo "2. Copy your Extension ID"
echo "3. Run this again or manually update com.lumina.bridge.json if ID changes."
echo ""
echo "Press Enter to finish..."
read

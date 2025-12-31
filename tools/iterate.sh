#!/bin/bash
# Quick iteration script for continent layout development
# Usage: ./iterate.sh [--num-apps N] [--seed S] [other args]

echo "========================================"
echo "HexMap Layout Iterator"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Run the layout generator
echo ""
echo "Generating layout..."
python3 continent_layout.py --generate "$@"

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Layout generation failed"
    exit 1
fi

echo ""
echo "Layout written to src/data.json"

# Check if dev server is running
if ! lsof -i :3000 >/dev/null 2>&1; then
    echo ""
    echo "Dev server not running. Start it with: npm start"
    echo "Then re-run this script."
else
    echo ""
    echo "Dev server running. Refresh browser to see changes."
    echo "(React may not hot-reload JSON changes)"
fi

echo ""
echo "========================================"
echo "Done! Refresh http://localhost:3000"
echo "========================================"

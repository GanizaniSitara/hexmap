#!/bin/bash

# Visual Testing Runner for HexMap
# This script runs Playwright tests against the local dev server

echo "🧪 HexMap Visual Testing"
echo "======================="
echo ""

# Check if playwright is installed
if ! python3 -c "import playwright" 2>/dev/null; then
    echo "📦 Installing Playwright..."
    pip install playwright
    python3 -m playwright install chromium
fi

echo "🚀 Starting dev server and running visual tests..."
echo ""

# Run tests with server management
python3 with_server.py --server "npm start" --port 3000 -- python3 test_hexmap_visual.py

echo ""
echo "✅ Tests complete! Check test-screenshots/ for visual results"

"""
Visual QA Screenshot Capture for HexMap.
Captures screenshots at key states for Claude Code to analyze.

Run with: python with_server.py --server "npm start" --port 3000 --timeout 60 -- python test_visual_qa.py
"""

import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

# Create screenshots directory
SCREENSHOTS_DIR = './test-screenshots'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


def run_screenshot_capture():
    """Capture screenshots at key application states for visual QA."""
    print("=" * 60)
    print("HexMap Visual QA - Screenshot Capture")
    print("=" * 60)

    screenshots_captured = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            # Load the application (use PORT env var or default to 3333)
            port = os.environ.get('PORT', '3333')
            print(f"\n[1/6] Loading application on port {port}...")
            page.goto(f'http://localhost:{port}')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)  # Wait for D3 rendering

            # Screenshot 1: Initial load - Cluster mode (default)
            print("[2/6] Capturing Cluster mode (default view)...")
            path = f'{SCREENSHOTS_DIR}/qa-01-cluster-mode.png'
            page.screenshot(path=path, full_page=True)
            screenshots_captured.append(path)
            print(f"  Saved: {path}")

            # Screenshot 2: Status mode
            print("[3/6] Capturing Status mode...")
            toggle = page.get_by_text('Status', exact=False).first
            if toggle.is_visible():
                toggle.click()
                page.wait_for_timeout(1000)
            path = f'{SCREENSHOTS_DIR}/qa-02-status-mode.png'
            page.screenshot(path=path, full_page=True)
            screenshots_captured.append(path)
            print(f"  Saved: {path}")

            # Switch back to Cluster mode
            cluster_btn = page.get_by_text('Cluster', exact=False).first
            if cluster_btn.is_visible():
                cluster_btn.click()
                page.wait_for_timeout(500)

            # Screenshot 3: Zoomed in view
            print("[4/6] Capturing zoomed in view...")
            svg = page.locator('svg').first
            box = svg.bounding_box()
            if box:
                center_x = box['x'] + box['width'] / 2
                center_y = box['y'] + box['height'] / 2
                page.mouse.move(center_x, center_y)
                page.mouse.wheel(0, -400)  # Zoom in
                page.wait_for_timeout(1000)
            path = f'{SCREENSHOTS_DIR}/qa-03-zoomed-in.png'
            page.screenshot(path=path, full_page=True)
            screenshots_captured.append(path)
            print(f"  Saved: {path}")

            # Reset zoom
            page.mouse.wheel(0, 400)
            page.wait_for_timeout(500)

            # Screenshot 4: Hover state (show tooltip/connections)
            print("[5/6] Capturing hover interaction...")
            try:
                # Click on center cluster to zoom and center it
                clusters = page.locator('[id^="cluster-"]')
                if clusters.count() > 0:
                    clusters.nth(2).click()  # Click middle cluster
                    page.wait_for_timeout(1500)

                # Now find a visible hexagon and hover
                hexagons = page.locator('path.hexagon')
                hovered = False
                for i in range(min(hexagons.count(), 15)):
                    try:
                        hex_elem = hexagons.nth(i)
                        if hex_elem.is_visible():
                            hex_elem.hover(timeout=3000)
                            page.wait_for_timeout(500)
                            hovered = True
                            break
                    except Exception:
                        continue

                if not hovered:
                    print("  Warning: Could not hover any hexagon")

                path = f'{SCREENSHOTS_DIR}/qa-04-hover-state.png'
                page.screenshot(path=path, full_page=True)
                screenshots_captured.append(path)
                print(f"  Saved: {path}")
            except Exception as e:
                print(f"  Warning: Hover test failed: {e}")

            # Reset - go back to initial view by reloading
            page.reload()
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(1000)

            # Screenshot 5: Mobile responsive view
            print("[6/6] Capturing mobile responsive view...")
            page.set_viewport_size({'width': 375, 'height': 667})
            page.wait_for_timeout(1000)
            path = f'{SCREENSHOTS_DIR}/qa-05-mobile.png'
            page.screenshot(path=path, full_page=True)
            screenshots_captured.append(path)
            print(f"  Saved: {path}")

        finally:
            browser.close()

    # Print summary
    print("\n" + "=" * 60)
    print("SCREENSHOT CAPTURE COMPLETE")
    print("=" * 60)
    print(f"Captured {len(screenshots_captured)} screenshots:")
    for path in screenshots_captured:
        print(f"  - {path}")
    print("\nTo analyze these screenshots, ask Claude Code:")
    print('  "Analyze the screenshots in test-screenshots/ for visual issues"')
    print("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(run_screenshot_capture())

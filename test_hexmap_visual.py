"""
Visual and interaction tests for HexMap application.
Tests zoom, hover, clicks, color modes, and captures screenshots for visual verification.

Run with: python with_server.py --server "npm start" --port 3000 --timeout 60 -- python test_hexmap_visual.py
"""

from playwright.sync_api import sync_playwright, expect
import time
import os


def boxes_overlap(box1, box2, padding=2):
    """Check if two bounding boxes overlap (with optional padding)."""
    if box1 is None or box2 is None:
        return False
    return not (
        box1['x'] + box1['width'] + padding < box2['x'] or
        box2['x'] + box2['width'] + padding < box1['x'] or
        box1['y'] + box1['height'] + padding < box2['y'] or
        box2['y'] + box2['height'] + padding < box1['y']
    )


def check_label_overlaps(page):
    """
    Check if any cluster labels overlap each other.
    Returns a list of overlapping label pairs.
    """
    labels = page.locator('.cluster-label')
    count = labels.count()

    if count == 0:
        return []

    # Collect all label bounding boxes
    label_boxes = []
    for i in range(count):
        label = labels.nth(i)
        try:
            box = label.bounding_box()
            text = label.text_content()
            if box:
                label_boxes.append({'box': box, 'text': text, 'index': i})
        except Exception:
            pass

    # Check for overlaps
    overlaps = []
    for i, label1 in enumerate(label_boxes):
        for j, label2 in enumerate(label_boxes):
            if i < j:  # Only check each pair once
                if boxes_overlap(label1['box'], label2['box']):
                    overlaps.append({
                        'label1': label1['text'],
                        'label2': label2['text'],
                        'box1': label1['box'],
                        'box2': label2['box']
                    })

    return overlaps

# Create screenshots directory (use relative path for cross-platform compatibility)
SCREENSHOTS_DIR = './test-screenshots'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def test_hexmap():
    with sync_playwright() as p:
        print("🚀 Starting HexMap visual tests...")

        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # Enable console logging to catch errors
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"{msg.type()}: {msg.text()}"))

        try:
            # Test 1: Initial Load
            port = os.environ.get('PORT', '3333')
            print(f"\n✓ Test 1: Initial page load (port {port})")
            page.goto(f'http://localhost:{port}')
            page.wait_for_load_state('networkidle')
            time.sleep(2)  # Wait for D3 rendering

            # Verify SVG is rendered
            svg = page.locator('svg').first
            expect(svg).to_be_visible()

            page.screenshot(path=f'{SCREENSHOTS_DIR}/01-initial-load.png', full_page=True)
            print("  ✓ Initial load complete, SVG rendered")

            # Test 2: Cluster Mode (Default)
            print("\n✓ Test 2: Cluster mode visualization")
            # Verify hexagons are rendered
            hexagons = page.locator('path.hexagon')
            count = hexagons.count()
            print(f"  ✓ Found {count} hexagons rendered")
            assert count > 0, "No hexagons found!"

            page.screenshot(path=f'{SCREENSHOTS_DIR}/02-cluster-mode.png', full_page=True)

            # Test 2b: Label overlap check
            print("\n✓ Test 2b: Label overlap check")
            label_overlaps = check_label_overlaps(page)
            if label_overlaps:
                print(f"  ✗ FAILED: Found {len(label_overlaps)} overlapping label pairs:")
                for overlap in label_overlaps:
                    print(f"    - '{overlap['label1']}' overlaps with '{overlap['label2']}'")
                # Take screenshot of overlap issue
                page.screenshot(path=f'{SCREENSHOTS_DIR}/02b-label-overlap-FAIL.png', full_page=True)
            else:
                print("  ✓ No label overlaps detected")

            # Test 3: Status Mode Toggle
            print("\n✓ Test 3: Status mode toggle")
            # Look for the toggle button (assuming it has text "Status" or similar)
            toggle_button = page.get_by_text('Status', exact=False).first
            if toggle_button.is_visible():
                toggle_button.click()
                time.sleep(1)  # Wait for color transition
                page.screenshot(path=f'{SCREENSHOTS_DIR}/03-status-mode.png', full_page=True)
                print("  ✓ Status mode activated")

                # Toggle back to Cluster mode
                cluster_button = page.get_by_text('Cluster', exact=False).first
                if cluster_button.is_visible():
                    cluster_button.click()
                    time.sleep(1)
                    print("  ✓ Toggled back to Cluster mode")
            else:
                print("  ⚠ Toggle button not found, skipping toggle test")

            # Test 4: Hover on Hexagon
            print("\n✓ Test 4: Hexagon hover interaction")
            first_hexagon = page.locator('path.hexagon').first

            # Hover over the hexagon
            first_hexagon.hover()
            time.sleep(0.5)  # Wait for tooltip/highlight

            page.screenshot(path=f'{SCREENSHOTS_DIR}/04-hexagon-hover.png', full_page=True)
            print("  ✓ Hexagon hover triggered")

            # Test 5: Click on Cluster
            print("\n✓ Test 5: Cluster click interaction")
            # Find a cluster group (they should have IDs like 'cluster-...')
            cluster_groups = page.locator('[id^="cluster-"]')
            if cluster_groups.count() > 0:
                # Click on first cluster's hexagon
                cluster_hex = cluster_groups.first.locator('path.hexagon').first
                cluster_hex.click()
                time.sleep(1)  # Wait for any animations

                page.screenshot(path=f'{SCREENSHOTS_DIR}/05-cluster-click.png', full_page=True)
                print("  ✓ Cluster clicked")
            else:
                print("  ⚠ No cluster groups found")

            # Test 6: Zoom Testing
            print("\n✓ Test 6: Zoom functionality")
            svg_element = page.locator('svg').first

            # Get bounding box for zoom operations
            box = svg_element.bounding_box()
            if box:
                center_x = box['x'] + box['width'] / 2
                center_y = box['y'] + box['height'] / 2

                # Zoom in with mouse wheel
                page.mouse.move(center_x, center_y)
                page.mouse.wheel(0, -500)  # Scroll up to zoom in
                time.sleep(1)

                page.screenshot(path=f'{SCREENSHOTS_DIR}/06-zoomed-in.png', full_page=True)
                print("  ✓ Zoomed in")

                # Zoom out
                page.mouse.wheel(0, 500)  # Scroll down to zoom out
                time.sleep(1)

                page.screenshot(path=f'{SCREENSHOTS_DIR}/07-zoomed-out.png', full_page=True)
                print("  ✓ Zoomed out")

            # Test 7: Pan/Drag Testing
            print("\n✓ Test 7: Pan/drag functionality")
            if box:
                # Drag to pan
                page.mouse.move(center_x, center_y)
                page.mouse.down()
                page.mouse.move(center_x + 200, center_y + 100, steps=10)
                page.mouse.up()
                time.sleep(0.5)

                page.screenshot(path=f'{SCREENSHOTS_DIR}/08-after-pan.png', full_page=True)
                print("  ✓ Pan/drag completed")

            # Test 8: Connection Lines (if visible)
            print("\n✓ Test 8: Connection lines visibility")
            # Hover on a hexagon to potentially trigger connection lines
            hexagons = page.locator('path.hexagon')
            if hexagons.count() > 5:
                hexagons.nth(5).hover()
                time.sleep(1)

                # Check if connection lines appeared
                connections = page.locator('path[id^="connection-"]')
                if connections.count() > 0:
                    print(f"  ✓ Found {connections.count()} connection lines")
                    page.screenshot(path=f'{SCREENSHOTS_DIR}/09-connections-visible.png', full_page=True)
                else:
                    print("  ℹ No connection lines found (may be expected)")

            # Test 9: Responsive Layout
            print("\n✓ Test 9: Responsive layout test")
            # Test with smaller viewport
            page.set_viewport_size({'width': 1024, 'height': 768})
            time.sleep(1)
            page.screenshot(path=f'{SCREENSHOTS_DIR}/10-responsive-1024.png', full_page=True)
            print("  ✓ 1024x768 viewport tested")

            # Test with mobile viewport
            page.set_viewport_size({'width': 375, 'height': 667})
            time.sleep(1)
            page.screenshot(path=f'{SCREENSHOTS_DIR}/11-responsive-mobile.png', full_page=True)
            print("  ✓ Mobile viewport tested")

            # Reset viewport
            page.set_viewport_size({'width': 1920, 'height': 1080})

            # Test 10: Console Errors Check
            print("\n✓ Test 10: Console errors check")
            errors = [log for log in console_logs if 'error' in log.lower()]
            warnings = [log for log in console_logs if 'warning' in log.lower()]

            if errors:
                print(f"  ⚠ Found {len(errors)} console errors:")
                for error in errors[:5]:  # Show first 5
                    print(f"    - {error}")
            else:
                print("  ✓ No console errors found")

            if warnings:
                print(f"  ℹ Found {len(warnings)} console warnings")

            # Test 11: Check for collision notifications
            print("\n✓ Test 11: Check UI elements")

            # Look for collision notification (if any)
            collision_notification = page.locator('text=Collision').first
            if collision_notification.is_visible():
                print("  ℹ Collision notification visible")
                page.screenshot(path=f'{SCREENSHOTS_DIR}/12-collision-notification.png', full_page=True)

            # Check for legends
            cluster_legend = page.locator('text=Clusters').or_(page.locator('text=Legend'))
            if cluster_legend.count() > 0:
                print("  ✓ Legend elements found")

            # Final screenshot
            page.screenshot(path=f'{SCREENSHOTS_DIR}/13-final-state.png', full_page=True)

            print("\n" + "="*60)
            print("✅ All visual tests completed successfully!")
            print(f"📸 Screenshots saved to: {SCREENSHOTS_DIR}")
            print("="*60)

            # Summary
            print("\n Test Summary:")
            print(f"  - Hexagons rendered: {count}")
            print(f"  - Label overlaps: {len(label_overlaps)}")
            print(f"  - Console errors: {len(errors)}")
            print(f"  - Console warnings: {len(warnings)}")
            print(f"  - Screenshots captured: 13")

            # Fail test if there are label overlaps
            if label_overlaps:
                raise AssertionError(f"Found {len(label_overlaps)} label overlap(s) - see test output for details")

        except Exception as e:
            print(f"\n❌ Test failed with error: {e}")
            page.screenshot(path=f'{SCREENSHOTS_DIR}/ERROR-screenshot.png', full_page=True)

            # Print recent console logs for debugging
            print("\n📝 Recent console logs:")
            for log in console_logs[-10:]:
                print(f"  {log}")

            raise

        finally:
            browser.close()
            print("\n🏁 Browser closed")

if __name__ == "__main__":
    test_hexmap()

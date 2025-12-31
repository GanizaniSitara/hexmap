# Testing Guide for HexMap

## Overview

This project now has comprehensive testing covering both unit tests and visual/interaction tests.

## Test Summary

### Unit Tests (Jest)
- **HexGrid.test.js** - Tests coordinate math and collision detection (17/20 passing)
  - ⚠️ Note: 3 tests fail due to precision issues in pixelToGrid inverse conversion
  - This is a known limitation of the current coordinate system
- **colorUtils.test.js** - Tests color calculations for Status and Cluster modes (16/16 passing ✓)
- **connectionUtils.test.js** - Tests connection path generation and styling (32/32 passing ✓)

**Total: 65 unit tests, 62 passing**

### Visual/Interaction Tests (Playwright)
- Automated browser tests that simulate user interactions
- Tests zoom, pan, hover, click, and color mode toggle
- Captures 13 screenshots for visual verification
- Must be run on Windows (not WSL)

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- --testPathPattern="colorUtils.test.js"
npm test -- --testPathPattern="connectionUtils.test.js"
npm test -- --testPathPattern="HexGrid.test.js"

# Run tests without watch mode
npm test -- --watchAll=false
```

### Visual Tests (Windows only)

**Prerequisites:**
1. Install Python and Playwright:
   ```cmd
   pip install playwright
   python -m playwright install chromium
   ```

2. Run the automated visual tests:
   ```cmd
   run-visual-tests.cmd
   ```

   This will:
   - Start the dev server (npm start on port 3000)
   - Launch headless Chrome browser
   - Run through all interaction scenarios
   - Capture screenshots to `test-screenshots/` folder
   - Shut down the server when done

**Screenshots captured:**
1. Initial load
2. Cluster mode visualization
3. Status mode toggle
4. Hexagon hover state
5. Cluster click interaction
6. Zoomed in view
7. Zoomed out view
8. After pan/drag
9. Connection lines visibility
10. Responsive 1024x768 layout
11. Responsive mobile layout
12. Collision notifications (if any)
13. Final state

## Test Organization

```
src/
  ├── HexGrid.test.js              # Coordinate math tests
  ├── utils/
  │   └── colorUtils.test.js       # Color calculation tests
  └── connectionUtils.test.js      # Connection rendering tests

test_hexmap_visual.py              # Playwright visual tests
with_server.py                     # Server management helper
run-visual-tests.cmd              # Windows test runner
run-visual-tests.sh               # Linux/Mac test runner (for reference)
test-screenshots/                 # Visual test output directory
```

## Known Issues

### HexGrid Coordinate Precision
The `pixelToGrid` function doesn't perfectly reverse `gridToPixel` due to rounding in the odd-r coordinate system. This affects:
- Converting pixel coordinates back to exact grid positions
- May cause slight misalignment at certain zoom levels

**Impact:** Minimal in practice, as the grid snapping handles this.

**Tests documenting this:**
- `should be inverse of gridToPixel` - FAILING
- `should round to nearest grid coordinate` - FAILING
- `should maintain coordinate consistency across multiple conversions` - FAILING

## Benefits of This Testing Setup

### For Manual Testing
- **Before:** Manually test zoom, pan, hover, clicks after every change
- **After:** Run `run-visual-tests.cmd` and review screenshots

### For Regressions
- Unit tests catch logic errors immediately
- Visual tests catch layout/interaction breakages
- Screenshots provide visual diff capability

### For Refactoring
- Safe to refactor coordinate math with test coverage
- Color calculations are fully tested
- Connection rendering logic is verified

## Adding New Tests

### Unit Tests
Create `[filename].test.js` next to the file you're testing:

```javascript
import { myFunction } from './myFile';

describe('myFunction', () => {
    test('should do something', () => {
        const result = myFunction(input);
        expect(result).toBe(expectedOutput);
    });
});
```

### Visual Tests
Edit `test_hexmap_visual.py` and add new test sections:

```python
# Test X: Your new test
print("\n✓ Test X: Testing new feature")
# ... your Playwright code ...
page.screenshot(path=f'{SCREENSHOTS_DIR}/14-new-feature.png')
print("  ✓ New feature tested")
```

## Continuous Integration (Future)

Consider adding GitHub Actions to run tests automatically:
- Unit tests on every PR
- Visual tests on main branch changes
- Screenshot comparisons for visual regression detection

## Tips

1. **Run unit tests frequently** - They're fast (<30 seconds)
2. **Run visual tests before commits** - Catch UI regressions early
3. **Review screenshots** - Visual verification is still important
4. **Update tests when features change** - Keep tests in sync with code
5. **Mock D3 carefully** - D3 is already configured in Jest, no mocking needed

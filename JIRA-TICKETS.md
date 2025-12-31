# JIRA Tickets for HexMap Testing

Copy these tickets into your JIRA HexMap project. Each ticket is ready to paste.

---

## Ticket 1: Run Visual Tests and Review Screenshots

**Title:** Run Playwright Visual Tests for First Time

**Type:** Task

**Priority:** High

**Description:**
Run the newly created automated visual tests to verify all interactions work correctly and review the generated screenshots.

**Steps:**
1. Open Windows terminal (not WSL)
2. Navigate to the HexMap project directory
3. Run: `run-visual-tests.cmd`
4. Wait for tests to complete (~2 minutes)
5. Review all screenshots in the `test-screenshots/` folder
6. Verify all 13 screenshots look correct:
   - 01-initial-load.png
   - 02-cluster-mode.png
   - 03-status-mode.png
   - 04-hexagon-hover.png
   - 05-cluster-click.png
   - 06-zoomed-in.png
   - 07-zoomed-out.png
   - 08-after-pan.png
   - 09-connections-visible.png
   - 10-responsive-1024.png
   - 11-responsive-mobile.png
   - 12-collision-notification.png (if applicable)
   - 13-final-state.png

**Acceptance Criteria:**
- [ ] All visual tests run successfully
- [ ] All 13 screenshots are generated
- [ ] Screenshots show expected visual output
- [ ] No unexpected console errors in test output

**Notes:**
- If Playwright is not installed, the script will install it automatically
- Tests run in headless Chrome browser
- See TESTING.md for troubleshooting

---

## Ticket 2: Fix HexGrid Coordinate Precision Issues

**Title:** Investigate and Fix pixelToGrid Coordinate Conversion Precision

**Type:** Bug

**Priority:** Medium

**Description:**
The HexGrid coordinate conversion has precision issues where `pixelToGrid()` doesn't perfectly reverse `gridToPixel()`. This causes 3 unit tests to fail.

**Failing Tests:**
- `should be inverse of gridToPixel`
- `should round to nearest grid coordinate`
- `should maintain coordinate consistency across multiple conversions`

**Steps to Reproduce:**
1. Run: `npm test -- --testPathPattern="HexGrid.test.js"`
2. Observe 3 failing tests in the pixelToGrid section

**Investigation Steps:**
1. Review the odd-r coordinate system implementation in `src/HexGrid.js:22-36`
2. Check if rounding logic needs adjustment for the inverse conversion
3. Consider using floating-point tolerance instead of exact equality
4. Test with various grid positions, especially odd rows (where offset is applied)

**Potential Solutions:**
- Improve rounding algorithm in pixelToGrid
- Add tolerance to coordinate comparison
- Use a different hex coordinate system (axial, cube, etc.)
- Document as expected behavior if impact is minimal

**Acceptance Criteria:**
- [ ] All 20 HexGrid tests pass
- [ ] Coordinate conversions are reversible within acceptable tolerance
- [ ] No visual impact on hex positioning
- [ ] Documentation updated if tolerance is added

**Files to Modify:**
- `src/HexGrid.js` (lines 22-36)
- `src/HexGrid.test.js` (potentially adjust expectations)

---

## Ticket 3: Add Visual Regression Testing with Screenshot Comparison

**Title:** Implement Visual Regression Testing with Baseline Screenshots

**Type:** Story

**Priority:** Low

**Description:**
Enhance the visual testing setup to automatically detect visual changes by comparing screenshots against baseline images.

**Current State:**
- Visual tests capture 13 screenshots
- Manual review required to spot differences

**Desired State:**
- Automated comparison against baseline screenshots
- Automatic failure if visual differences detected
- Easy process to update baselines when changes are intentional

**Implementation Steps:**
1. Install Playwright's visual comparison features or a tool like Percy/Chromatic
2. Run current visual tests to establish baseline screenshots
3. Commit baseline screenshots to repository
4. Update `test_hexmap_visual.py` to include image comparison
5. Configure acceptable diff threshold (e.g., 0.1% pixel difference)
6. Add command to update baselines: `run-visual-tests.cmd --update-baseline`
7. Document the process in TESTING.md

**Tools to Consider:**
- Playwright's built-in `toMatchSnapshot()`
- Percy (percy.io) - SaaS solution
- Chromatic (chromatic.com) - SaaS solution with Storybook integration
- pixelmatch - Open source image comparison library

**Acceptance Criteria:**
- [ ] Visual tests automatically detect unexpected UI changes
- [ ] Baseline screenshots are version-controlled
- [ ] Clear process to approve and update baselines
- [ ] Test failures show visual diff highlighting changes
- [ ] Documentation updated with visual regression workflow

**Effort Estimate:** 3-5 hours

---

## Ticket 4: Set Up GitHub Actions for Automated Testing

**Title:** Configure CI/CD Pipeline with GitHub Actions for Test Automation

**Type:** Story

**Priority:** Low

**Description:**
Set up GitHub Actions to automatically run tests on every push and pull request, ensuring no regressions are merged.

**Implementation Steps:**

1. Create `.github/workflows/tests.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --watchAll=false --coverage

  visual-tests:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: npm install
      - run: pip install playwright
      - run: python -m playwright install chromium
      - run: python with_server.py --server "npm start" --port 3000 -- python test_hexmap_visual.py
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-screenshots
          path: test-screenshots/
```

2. Test the workflow on a branch
3. Add status badge to README.md
4. Configure branch protection rules to require passing tests

**Acceptance Criteria:**
- [ ] Unit tests run automatically on every push/PR
- [ ] Visual tests run automatically on every push/PR
- [ ] Test failures prevent PR merging
- [ ] Screenshots uploaded as artifacts for review
- [ ] Status badge shows in README

**Benefits:**
- Catch bugs before they reach main branch
- Enforce code quality standards
- Visual test results available in PR for review

**Effort Estimate:** 2-3 hours

---

## Ticket 5: Add Unit Tests for Untested Components

**Title:** Increase Test Coverage for React Components and Utilities

**Type:** Task

**Priority:** Medium

**Description:**
Add unit tests for currently untested components and utilities to improve overall test coverage.

**Files Needing Tests:**
1. `src/utils/TooltipManager.js` - Tooltip display logic
2. `src/utils/ZoomUtils.js` - Zoom level utilities
3. `src/components/ZoomHandler.js` - Pan/zoom behavior
4. `src/components/ClusterManager.js` - Cluster selection logic
5. `src/ConnectionRenderer.js` - Connection rendering component

**Implementation Steps:**

For each file:
1. Create corresponding `.test.js` file
2. Test all exported functions/classes
3. Mock React/D3 dependencies as needed
4. Aim for >80% code coverage

**Example Test Structure:**
```javascript
// src/utils/TooltipManager.test.js
import TooltipManager from './TooltipManager';

describe('TooltipManager', () => {
    let tooltipManager;

    beforeEach(() => {
        tooltipManager = new TooltipManager();
    });

    test('should show tooltip at correct position', () => {
        // Test implementation
    });

    test('should hide tooltip when hide() is called', () => {
        // Test implementation
    });
});
```

**Acceptance Criteria:**
- [ ] All utility files have corresponding test files
- [ ] Test coverage >80% for new tests
- [ ] All tests pass
- [ ] Edge cases and error conditions tested

**Priority Order:**
1. TooltipManager (most complex utility)
2. ZoomUtils (pure functions, easy to test)
3. ClusterManager (component logic)
4. ZoomHandler (interaction logic)
5. ConnectionRenderer (visual rendering)

**Effort Estimate:** 5-8 hours total

---

## Ticket 6: Document Known Testing Limitations

**Title:** Create Testing Limitations and Known Issues Documentation

**Type:** Documentation

**Priority:** Low

**Description:**
Document the known limitations and issues with the testing setup so future developers understand the context.

**Items to Document:**

1. **HexGrid Coordinate Precision**
   - pixelToGrid not perfectly inverse of gridToPixel
   - Acceptable tolerance levels
   - When this matters vs. doesn't matter

2. **Visual Test Limitations**
   - Must run on Windows (not WSL)
   - Requires manual screenshot review (until visual regression added)
   - Headless browser differences from real browser

3. **Jest/D3 Integration**
   - Requires transformIgnorePatterns configuration
   - ES module handling quirks

4. **Test Data**
   - Uses src/data.json for tests
   - Changes to data.json may require test updates

**Create:** `TESTING-LIMITATIONS.md`

**Acceptance Criteria:**
- [ ] All known limitations documented
- [ ] Workarounds provided where applicable
- [ ] Links to relevant GitHub issues or discussions
- [ ] Updated when new limitations discovered

**Effort Estimate:** 1 hour

---

## Summary

**Quick Wins (Do First):**
- ✅ Ticket 1: Run Visual Tests (30 minutes)

**Important for Code Quality:**
- 🔧 Ticket 2: Fix Coordinate Precision (2-3 hours)
- 📝 Ticket 5: Add More Unit Tests (5-8 hours)

**Nice to Have:**
- 🎨 Ticket 3: Visual Regression Testing (3-5 hours)
- 🤖 Ticket 4: CI/CD Pipeline (2-3 hours)
- 📖 Ticket 6: Document Limitations (1 hour)

**Total Effort Estimate:** 13.5 - 20.5 hours

# Testing Limitations and Known Issues

This document outlines known limitations, quirks, and issues with the HexMap testing setup. Understanding these helps avoid confusion and sets realistic expectations.

---

## 1. HexGrid Coordinate Precision Issues

### Issue
The `pixelToGrid()` function in `HexGrid.js` does not perfectly reverse `gridToPixel()` conversions. Converting grid → pixel → grid may result in different coordinates than the original.

### Affected Tests
- `HexGrid.test.js`: "should be inverse of gridToPixel" ❌
- `HexGrid.test.js`: "should round to nearest grid coordinate" ❌
- `HexGrid.test.js`: "should maintain coordinate consistency across multiple conversions" ❌

### Root Cause
The odd-r horizontal coordinate system applies different offsets for odd/even rows:
```javascript
// gridToPixel - applies 0.5 offset for odd rows
const x = centerOffsetX + this.hexSize * Math.sqrt(3) * (q + 0.5 * (r & 1));

// pixelToGrid - reverse calculation with rounding
const q = (adjustedX * Math.sqrt(3)/3 - adjustedY / 3) / this.hexSize;
const r = adjustedY * 2/3 / this.hexSize;
return { q: Math.round(q), r: Math.round(r) };
```

The rounding in `Math.round()` doesn't account for the odd-row offset, causing drift in conversions.

### Impact
**Low** - In practice, this doesn't affect visual rendering because:
- Apps specify absolute `gridPosition` coordinates (don't rely on pixel conversion)
- The grid snapping handles minor positioning differences
- Users interact with hexagons directly, not by clicking arbitrary pixels

### When It Matters
- If you need to convert mouse click coordinates to exact grid positions
- If implementing drag-and-drop with precise grid snapping
- If building tools that rely on perfect coordinate reversibility

### Workarounds
1. **Use absolute positioning** (already done) - Apps have `gridPosition.q` and `gridPosition.r`
2. **Add tolerance** - Accept coordinates within ±1 grid unit
3. **Improve algorithm** - See Ticket 2 for potential fixes

### Future Work
See JIRA Ticket 2: "Fix HexGrid Coordinate Precision Issues"

---

## 2. Visual Test Platform Limitations

### Windows-Only Execution

**Issue:** Visual tests must run on Windows, not in WSL (Windows Subsystem for Linux).

**Reason:**
- The dev server (`npm start`) runs on Windows
- Playwright in WSL cannot access Windows localhost
- Python script needs to connect to `http://localhost:3000` on Windows

**Workaround:**
- Run `run-visual-tests.cmd` from Windows terminal (cmd or PowerShell)
- Don't run visual tests from WSL terminal

**File Paths:**
- Use relative paths (`./test-screenshots/`) for cross-platform compatibility
- Avoid absolute WSL paths (`/mnt/c/...`) in Python scripts

### Headless Browser Differences

**Issue:** Headless Chrome may render slightly differently than regular Chrome.

**Examples:**
- Font anti-aliasing differences
- Animation timing
- GPU rendering effects

**Impact:**
- Screenshots may look slightly different from what you see in browser
- Visual regression tests may need tolerance thresholds

**Workaround:**
- Use consistent environment for screenshot baseline captures
- Add pixel difference tolerance (e.g., 0.1%) when implementing visual regression

---

## 3. Jest and D3 ES Module Integration

### Configuration Required

**Issue:** D3 uses ES modules, but Jest expects CommonJS by default.

**Solution:** Configure `transformIgnorePatterns` in `package.json`:
```json
"jest": {
  "transformIgnorePatterns": [
    "node_modules/(?!(d3|d3-array|d3-...)/)"
  ]
}
```

**If You Get "Unexpected token 'export'" Errors:**
1. Check that `package.json` has the jest config
2. Make sure all D3 sub-packages are listed in transformIgnorePatterns
3. Clear Jest cache: `npm test -- --clearCache`

### Adding New D3 Dependencies

If you add new D3 packages (e.g., `d3-sankey`), you must:
1. Add them to `transformIgnorePatterns` in `package.json`
2. Restart Jest

---

## 4. Test Data Dependencies

### Using Production Data

**Current Approach:** Tests use `src/data.json` (the same data used in production).

**Pros:**
- Tests verify real-world scenarios
- No need to maintain separate test fixtures

**Cons:**
- Changes to `data.json` may break tests
- Tests depend on specific app names, positions, and IDs
- Can't test edge cases not present in production data

### When Tests Break After Data Changes

If you modify `data.json` and tests fail:

1. **Check collision detection tests** - May depend on specific positions
2. **Check connection tests** - May depend on specific app IDs
3. **Update test expectations** - Or create test-specific fixtures

### Future Improvement

Consider creating `src/data.test.json` with:
- Minimal test data
- Edge cases (empty clusters, collisions, etc.)
- Stable IDs that won't change

---

## 5. Manual Screenshot Review Required

### Current State

**Issue:** Visual tests capture screenshots but don't automatically detect visual regressions.

**Process:**
1. Run `run-visual-tests.cmd`
2. Manually review 13 screenshots in `test-screenshots/`
3. Compare against previous screenshots (if saved)
4. Verify no unexpected visual changes

**Limitations:**
- Time-consuming for frequent changes
- Easy to miss subtle differences
- No automatic pass/fail for visual changes

### Future: Visual Regression Testing

See JIRA Ticket 3: "Add Visual Regression Testing"

Options:
- **Playwright snapshots** - Built-in image comparison
- **Percy** - Cloud-based visual testing service
- **Chromatic** - Visual regression for Storybook
- **pixelmatch** - Open-source pixel-by-pixel comparison

---

## 6. Test Coverage Gaps

### Untested Components

The following files currently have **no unit tests**:

**High Priority:**
- `src/utils/TooltipManager.js` - Complex state management
- `src/components/ClusterManager.js` - Business logic

**Medium Priority:**
- `src/utils/ZoomUtils.js` - Pure functions (easy to test)
- `src/components/ZoomHandler.js` - Interaction logic

**Low Priority:**
- `src/ConnectionRenderer.js` - Mostly visual rendering
- `src/components/HexGridRenderer.js` - Heavy D3 integration

### Why These Aren't Tested Yet

**React Component Testing:**
- Requires React Testing Library or Enzyme
- D3 integration makes components harder to test
- Visual output is better verified by Playwright tests

**Recommended Approach:**
1. Test utility functions (TooltipManager, ZoomUtils) with Jest
2. Test React component logic with React Testing Library
3. Test visual rendering with Playwright (already done)

See JIRA Ticket 5: "Add More Unit Tests"

---

## 7. Performance and Timeout Considerations

### Test Timeouts

**Unit Tests (Jest):**
- Default timeout: 5 seconds per test
- Long-running tests may need custom timeout:
  ```javascript
  test('slow test', async () => {
    // ...
  }, 10000); // 10 second timeout
  ```

**Visual Tests (Playwright):**
- Page load timeout: 30 seconds
- Action timeout: 30 seconds (clicks, hovers)
- Custom timeouts available:
  ```python
  page.wait_for_selector('button', timeout=60000)
  ```

### Slow Test Warnings

If tests take >20 seconds:
- Jest will warn but continue
- Visual tests may need `time.sleep()` adjustments
- Consider test parallelization for large suites

---

## 8. Known Test Flakiness

### Visual Tests

**Potential Flaky Scenarios:**
1. **Network-dependent tests** - If dev server is slow to start
2. **Animation timing** - If animations haven't completed
3. **Race conditions** - If hover states don't register

**Mitigations:**
- Always `page.wait_for_load_state('networkidle')`
- Add `time.sleep()` after interactions (0.5-1 second)
- Use explicit waits: `page.wait_for_selector()`

### Unit Tests

**Currently stable** - All unit tests are deterministic with no flakiness observed.

---

## 9. CI/CD Considerations

### When You Add GitHub Actions (Ticket 4)

**Challenges:**
- **Windows runners are slower** than Linux runners
- **Playwright installation** adds ~1 minute to build time
- **Screenshot artifacts** need storage (GitHub Actions has limits)

**Recommendations:**
- Run unit tests on Linux (faster, cheaper)
- Run visual tests on Windows (required for this project)
- Use `actions/cache` to cache Playwright browsers
- Set artifact retention to 7 days for screenshots

---

## 10. Development Workflow Tips

### Running Tests Efficiently

**During Active Development:**
```bash
# Run tests in watch mode (auto-rerun on file changes)
npm test

# Run specific test file
npm test HexGrid.test.js
```

**Before Committing:**
```bash
# Run all tests once
npm test -- --watchAll=false

# Run visual tests (Windows)
run-visual-tests.cmd
```

**After Refactoring:**
```bash
# Run all unit tests
npm test -- --watchAll=false

# Run visual tests
run-visual-tests.cmd

# Review all screenshots carefully
```

### Debugging Failed Tests

**Unit Test Failures:**
1. Check the error message and stack trace
2. Run single test file for faster iteration
3. Add `console.log()` in test or source code
4. Use `test.only()` to run one test

**Visual Test Failures:**
1. Check console output for errors
2. Look at `ERROR-screenshot.png` (captured on failure)
3. Check browser console logs in test output
4. Run with `headless=False` for debugging (edit Python script)

---

## Summary Table

| Limitation | Severity | Workaround | Future Fix |
|------------|----------|------------|------------|
| Coordinate precision | Low | Use absolute positions | Ticket 2 |
| Windows-only visual tests | Medium | Run from Windows terminal | N/A (by design) |
| Manual screenshot review | Medium | Save baseline for comparison | Ticket 3 |
| Missing component tests | Low | Focus on utility tests first | Ticket 5 |
| No visual regression | Low | Manual review for now | Ticket 3 |
| D3 ES module config | Low | Already configured | N/A |
| Test data coupling | Low | Use production data | Future: test fixtures |

---

## Questions or Issues?

If you encounter testing issues not covered here:
1. Check `TESTING.md` for general testing guide
2. Check `JIRA-TICKETS.md` for planned improvements
3. Add new issues to this document
4. Create JIRA ticket for significant problems

**Last Updated:** 2025-12-09

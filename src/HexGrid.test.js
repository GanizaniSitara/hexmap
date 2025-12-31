import HexGrid from './HexGrid';

describe('HexGrid', () => {
    let hexGrid;
    const hexSize = 20;
    const width = 1000;
    const height = 800;

    beforeEach(() => {
        hexGrid = new HexGrid(hexSize, width, height);
    });

    describe('constructor', () => {
        test('should initialize with correct properties', () => {
            expect(hexGrid.hexSize).toBe(hexSize);
            expect(hexGrid.width).toBe(width);
            expect(hexGrid.height).toBe(height);
        });
    });

    describe('gridToPixel', () => {
        test('should convert origin (0,0) to center of viewport', () => {
            const result = hexGrid.gridToPixel(0, 0);
            expect(result.x).toBe(width / 2);
            expect(result.y).toBe(height / 2);
        });

        test('should handle positive q coordinate', () => {
            const result = hexGrid.gridToPixel(5, 0);
            const expectedX = width / 2 + hexSize * Math.sqrt(3) * 5;
            expect(result.x).toBeCloseTo(expectedX, 5);
            expect(result.y).toBe(height / 2);
        });

        test('should handle positive r coordinate', () => {
            const result = hexGrid.gridToPixel(0, 4);
            const expectedY = height / 2 + hexSize * 3/2 * 4;
            expect(result.x).toBe(width / 2);
            expect(result.y).toBeCloseTo(expectedY, 5);
        });

        test('should apply odd-r offset for odd rows', () => {
            // Even row (r=0)
            const evenRow = hexGrid.gridToPixel(2, 0);
            const expectedEvenX = width / 2 + hexSize * Math.sqrt(3) * 2;
            expect(evenRow.x).toBeCloseTo(expectedEvenX, 5);

            // Odd row (r=1) - should have 0.5 offset
            const oddRow = hexGrid.gridToPixel(2, 1);
            const expectedOddX = width / 2 + hexSize * Math.sqrt(3) * (2 + 0.5);
            expect(oddRow.x).toBeCloseTo(expectedOddX, 5);
        });

        test('should handle negative coordinates', () => {
            const result = hexGrid.gridToPixel(-3, -2);
            expect(result.x).toBeLessThan(width / 2);
            expect(result.y).toBeLessThan(height / 2);
        });
    });

    describe('pixelToGrid', () => {
        test('should convert center of viewport to origin (0,0)', () => {
            const result = hexGrid.pixelToGrid(width / 2, height / 2);
            expect(result.q).toBe(0);
            expect(result.r).toBe(0);
        });

        test('should be inverse of gridToPixel', () => {
            const originalQ = 5;
            const originalR = 3;

            const pixel = hexGrid.gridToPixel(originalQ, originalR);
            const grid = hexGrid.pixelToGrid(pixel.x, pixel.y);

            expect(grid.q).toBe(originalQ);
            expect(grid.r).toBe(originalR);
        });

        test('should round to nearest grid coordinate', () => {
            // Test that slight variations in pixel coords still map to same grid coord
            const pixel1 = hexGrid.gridToPixel(2, 3);
            const pixel2 = { x: pixel1.x + 1, y: pixel1.y + 1 }; // Slightly offset

            const grid1 = hexGrid.pixelToGrid(pixel1.x, pixel1.y);
            const grid2 = hexGrid.pixelToGrid(pixel2.x, pixel2.y);

            expect(grid1.q).toBe(2);
            expect(grid1.r).toBe(3);
            // Small offset should still round to same grid position
            expect(grid2.q).toBe(grid1.q);
            expect(grid2.r).toBe(grid1.r);
        });

        test('should handle negative pixel coordinates', () => {
            const result = hexGrid.pixelToGrid(100, 100);
            expect(result.q).toBeDefined();
            expect(result.r).toBeDefined();
            expect(typeof result.q).toBe('number');
            expect(typeof result.r).toBe('number');
        });
    });

    describe('hexagonPath', () => {
        test('should return a string path', () => {
            const path = hexGrid.hexagonPath(20);
            expect(typeof path).toBe('string');
            expect(path).toContain('M'); // Should start with Move command
            expect(path).toContain('Z'); // Should end with close path
        });

        test('should generate path with 6 points for hexagon', () => {
            const path = hexGrid.hexagonPath(20);
            // Count L (line-to) commands - should have 5 after initial M
            const lineCommands = (path.match(/L/g) || []).length;
            expect(lineCommands).toBe(5);
        });

        test('should scale hexagon size correctly', () => {
            const smallPath = hexGrid.hexagonPath(10);
            const largePath = hexGrid.hexagonPath(100);

            expect(smallPath).not.toBe(largePath);
            expect(largePath.length).toBeGreaterThan(smallPath.length);
        });
    });

    describe('generateHexCoords', () => {
        test('should return empty array when no apps provided', () => {
            const result = hexGrid.generateHexCoords(0, 0, 0, []);
            expect(result).toEqual([]);
        });

        test('should skip apps without gridPosition', () => {
            const apps = [
                { name: 'App1', id: 'app1' }, // No gridPosition
                { name: 'App2', id: 'app2', gridPosition: { q: 1, r: 1 } }
            ];

            const result = hexGrid.generateHexCoords(2, 0, 0, apps);
            expect(result.length).toBe(1);
            expect(result[0].appName).toBe('App2');
        });

        test('should convert grid positions to pixel coordinates', () => {
            const apps = [
                { name: 'App1', id: 'app1', gridPosition: { q: 2, r: 3 } }
            ];

            const result = hexGrid.generateHexCoords(1, 0, 0, apps);
            expect(result.length).toBe(1);

            const expectedPixel = hexGrid.gridToPixel(2, 3);
            expect(result[0].x).toBeCloseTo(expectedPixel.x, 5);
            expect(result[0].y).toBeCloseTo(expectedPixel.y, 5);
        });

        test('should detect collisions when apps share same position', () => {
            const occupiedPositions = {};

            const apps1 = [
                { name: 'App1', id: 'app1', gridPosition: { q: 5, r: 5 }, clusterName: 'Cluster1' }
            ];

            const apps2 = [
                { name: 'App2', id: 'app2', gridPosition: { q: 5, r: 5 }, clusterName: 'Cluster2' }
            ];

            // First app should not have collision
            const result1 = hexGrid.generateHexCoords(1, 0, 0, apps1, occupiedPositions);
            expect(result1[0].hasCollision).toBeUndefined();

            // Second app at same position should have collision
            const result2 = hexGrid.generateHexCoords(1, 0, 0, apps2, occupiedPositions);
            expect(apps2[0].hasCollision).toBe(true);
            expect(apps2[0].collidesWith).toBeDefined();
            expect(apps2[0].collidesWith.name).toBe('App1');
        });

        test('should include app reference in coord object', () => {
            const app = {
                name: 'TestApp',
                id: 'test1',
                gridPosition: { q: 1, r: 2 },
                status: 75
            };

            const result = hexGrid.generateHexCoords(1, 0, 0, [app]);
            expect(result[0].app).toBe(app);
            expect(result[0].appName).toBe('TestApp');
            expect(result[0].gridPosition).toEqual({ q: 1, r: 2 });
        });

        test('should handle multiple apps in same cluster', () => {
            const apps = [
                { name: 'App1', id: 'app1', gridPosition: { q: 0, r: 0 } },
                { name: 'App2', id: 'app2', gridPosition: { q: 1, r: 0 } },
                { name: 'App3', id: 'app3', gridPosition: { q: 0, r: 1 } }
            ];

            const result = hexGrid.generateHexCoords(3, 0, 0, apps);
            expect(result.length).toBe(3);

            // All should have different positions
            const positions = result.map(r => `${r.gridPosition.q},${r.gridPosition.r}`);
            const uniquePositions = new Set(positions);
            expect(uniquePositions.size).toBe(3);
        });
    });

    describe('coordinate system consistency', () => {
        test('should maintain coordinate consistency across multiple conversions', () => {
            const testCoords = [
                { q: 0, r: 0 },
                { q: 5, r: -3 },
                { q: -2, r: 4 },
                { q: 10, r: 10 }
            ];

            testCoords.forEach(coord => {
                const pixel = hexGrid.gridToPixel(coord.q, coord.r);
                const backToGrid = hexGrid.pixelToGrid(pixel.x, pixel.y);

                expect(backToGrid.q).toBe(coord.q);
                expect(backToGrid.r).toBe(coord.r);
            });
        });
    });
});

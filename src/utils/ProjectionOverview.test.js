import { calculateOverviewTransform } from './ZoomUtils';

describe('projection overview', () => {
    test('fits an off-origin enterprise map inside the viewport', () => {
        const bounds = { x: -4000, y: -2000, width: 9000, height: 6000 };
        const transform = calculateOverviewTransform(bounds, 1600, 1000);
        const topLeft = transform.apply([bounds.x, bounds.y]);
        const bottomRight = transform.apply([bounds.x + bounds.width, bounds.y + bounds.height]);
        expect(transform.k).toBeLessThan(0.7);
        expect(topLeft[0]).toBeGreaterThanOrEqual(79.99);
        expect(topLeft[1]).toBeGreaterThanOrEqual(79.99);
        expect(bottomRight[0]).toBeLessThanOrEqual(1520.01);
        expect(bottomRight[1]).toBeLessThanOrEqual(920.01);
        expect(transform.apply([500, 1000])).toEqual([800, 500]);
    });

    test('centers a small map without magnifying it', () => {
        const transform = calculateOverviewTransform({ x: 100, y: 200, width: 80, height: 60 }, 1600, 1000);
        expect(transform.k).toBe(1);
        expect(transform.apply([140, 230])).toEqual([800, 500]);
    });

    test('handles an empty map and narrow viewport', () => {
        expect(calculateOverviewTransform({ width: 0, height: 0 }, 1600, 1000).k).toBe(1);
        const transform = calculateOverviewTransform({ x: -10, y: -10, width: 20, height: 20 }, 120, 120);
        expect(transform.k).toBeGreaterThan(0);
        expect(transform.apply([0, 0])).toEqual([60, 60]);
    });
});

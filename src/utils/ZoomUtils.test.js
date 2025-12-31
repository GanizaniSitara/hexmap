import {
    shouldHexagonBeVisible,
    getVisibleHexagonsInCluster,
    calculateHexagonsCenter,
    getZoomThreshold,
    calculateClusterZoomTransform
} from './ZoomUtils';
import * as d3 from 'd3';

// Mock d3.select
jest.mock('d3', () => {
    const actualD3 = jest.requireActual('d3');
    return {
        ...actualD3,
        select: jest.fn(),
        zoomIdentity: actualD3.zoomIdentity
    };
});

describe('ZoomUtils', () => {
    describe('shouldHexagonBeVisible', () => {
        test('should always return true at any zoom level', () => {
            expect(shouldHexagonBeVisible({}, 0.5)).toBe(true);
            expect(shouldHexagonBeVisible({}, 1.0)).toBe(true);
            expect(shouldHexagonBeVisible({}, 2.0)).toBe(true);
            expect(shouldHexagonBeVisible({}, 5.0)).toBe(true);
        });

        test('should return true for null hexagon', () => {
            expect(shouldHexagonBeVisible(null, 1.0)).toBe(true);
        });

        test('should return true for undefined zoom level', () => {
            expect(shouldHexagonBeVisible({}, undefined)).toBe(true);
        });
    });

    describe('getVisibleHexagonsInCluster', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should return empty array when cluster does not exist', () => {
            d3.select.mockReturnValue({
                node: () => null,
                selectAll: jest.fn()
            });

            const result = getVisibleHexagonsInCluster('nonexistent', 1.0);
            expect(result).toEqual([]);
        });

        test('should return hexagon nodes when cluster exists', () => {
            const mockNodes = [
                { id: 'hex1' },
                { id: 'hex2' },
                { id: 'hex3' }
            ];

            d3.select.mockReturnValue({
                node: () => ({ id: 'cluster' }),
                selectAll: jest.fn().mockReturnValue({
                    nodes: () => mockNodes
                })
            });

            const result = getVisibleHexagonsInCluster('cluster_1', 1.0);
            expect(result).toEqual(mockNodes);
            expect(d3.select).toHaveBeenCalledWith('#cluster-cluster_1');
        });

        test('should return all hexagons regardless of zoom level', () => {
            const mockNodes = [{ id: 'hex1' }];

            d3.select.mockReturnValue({
                node: () => ({ id: 'cluster' }),
                selectAll: jest.fn().mockReturnValue({
                    nodes: () => mockNodes
                })
            });

            // Test different zoom levels
            expect(getVisibleHexagonsInCluster('cluster_1', 0.5)).toEqual(mockNodes);
            expect(getVisibleHexagonsInCluster('cluster_1', 1.0)).toEqual(mockNodes);
            expect(getVisibleHexagonsInCluster('cluster_1', 3.0)).toEqual(mockNodes);
        });
    });

    describe('calculateHexagonsCenter', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('should return {0,0} for empty array', () => {
            const result = calculateHexagonsCenter([]);
            expect(result).toEqual({ x: 0, y: 0 });
        });

        test('should return {0,0} for null input', () => {
            const result = calculateHexagonsCenter(null);
            expect(result).toEqual({ x: 0, y: 0 });
        });

        test('should return {0,0} for undefined input', () => {
            const result = calculateHexagonsCenter(undefined);
            expect(result).toEqual({ x: 0, y: 0 });
        });

        test('should calculate center for single hexagon', () => {
            const mockHexNode = {};

            d3.select.mockReturnValue({
                attr: () => 'translate(100,200)'
            });

            const result = calculateHexagonsCenter([mockHexNode]);
            expect(result.x).toBe(100);
            expect(result.y).toBe(200);
        });

        test('should calculate average center for multiple hexagons', () => {
            const mockHexNodes = [{}, {}, {}];

            let callCount = 0;
            d3.select.mockImplementation(() => ({
                attr: () => {
                    const transforms = [
                        'translate(0,0)',
                        'translate(100,200)',
                        'translate(200,100)'
                    ];
                    return transforms[callCount++];
                }
            }));

            const result = calculateHexagonsCenter(mockHexNodes);
            expect(result.x).toBeCloseTo(100, 5); // (0 + 100 + 200) / 3
            expect(result.y).toBeCloseTo(100, 5); // (0 + 200 + 100) / 3
        });

        test('should skip hexagons with missing transform', () => {
            const mockHexNodes = [{}, {}];

            let callCount = 0;
            d3.select.mockImplementation(() => ({
                attr: () => {
                    const transforms = [
                        'translate(100,100)',
                        null // Missing transform
                    ];
                    return transforms[callCount++];
                }
            }));

            const result = calculateHexagonsCenter(mockHexNodes);
            expect(result.x).toBe(100);
            expect(result.y).toBe(100);
        });

        test('should skip hexagons with invalid transform format', () => {
            const mockHexNodes = [{}, {}];

            let callCount = 0;
            d3.select.mockImplementation(() => ({
                attr: () => {
                    const transforms = [
                        'translate(100,100)',
                        'invalid-format'
                    ];
                    return transforms[callCount++];
                }
            }));

            const result = calculateHexagonsCenter(mockHexNodes);
            expect(result.x).toBe(100);
            expect(result.y).toBe(100);
        });

        test('should skip hexagons with NaN coordinates', () => {
            const mockHexNodes = [{}, {}];

            let callCount = 0;
            d3.select.mockImplementation(() => ({
                attr: () => {
                    const transforms = [
                        'translate(100,100)',
                        'translate(NaN,NaN)'
                    ];
                    return transforms[callCount++];
                }
            }));

            const result = calculateHexagonsCenter(mockHexNodes);
            expect(result.x).toBe(100);
            expect(result.y).toBe(100);
        });

        test('should handle negative coordinates', () => {
            const mockHexNodes = [{}, {}];

            let callCount = 0;
            d3.select.mockImplementation(() => ({
                attr: () => {
                    const transforms = [
                        'translate(-50,-100)',
                        'translate(50,100)'
                    ];
                    return transforms[callCount++];
                }
            }));

            const result = calculateHexagonsCenter(mockHexNodes);
            expect(result.x).toBe(0);   // (-50 + 50) / 2
            expect(result.y).toBe(0);   // (-100 + 100) / 2
        });
    });

    describe('getZoomThreshold', () => {
        test('should return "overview" for zoom <= 0.7', () => {
            expect(getZoomThreshold(0.3)).toBe('overview');
            expect(getZoomThreshold(0.5)).toBe('overview');
            expect(getZoomThreshold(0.7)).toBe('overview');
        });

        test('should return "intermediate" for zoom < 2.2', () => {
            expect(getZoomThreshold(0.71)).toBe('intermediate');
            expect(getZoomThreshold(1.0)).toBe('intermediate');
            expect(getZoomThreshold(1.5)).toBe('intermediate');
            expect(getZoomThreshold(2.0)).toBe('intermediate');
            expect(getZoomThreshold(2.1)).toBe('intermediate');
        });

        test('should return "detail" for zoom >= 2.2', () => {
            expect(getZoomThreshold(2.2)).toBe('detail');
            expect(getZoomThreshold(3.0)).toBe('detail');
            expect(getZoomThreshold(5.0)).toBe('detail');
            expect(getZoomThreshold(10.0)).toBe('detail');
        });

        test('should handle boundary values correctly', () => {
            expect(getZoomThreshold(0.7)).toBe('overview');
            expect(getZoomThreshold(0.700001)).toBe('intermediate');
            expect(getZoomThreshold(2.199999)).toBe('intermediate');
            expect(getZoomThreshold(2.2)).toBe('detail');
        });

        test('should handle edge cases', () => {
            expect(getZoomThreshold(0)).toBe('overview');
            expect(getZoomThreshold(-1)).toBe('overview'); // Negative zoom
        });
    });

    describe('calculateClusterZoomTransform', () => {
        beforeEach(() => {
            // Mock document.getElementById
            global.document.getElementById = jest.fn();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should return null when cluster element does not exist', () => {
            global.document.getElementById.mockReturnValue(null);

            const result = calculateClusterZoomTransform('nonexistent', 1000, 800);
            expect(result).toBeNull();
        });

        test('should calculate zoom transform for existing cluster', () => {
            const mockElement = {
                getBBox: () => ({
                    x: 100,
                    y: 50,
                    width: 200,
                    height: 150
                })
            };

            global.document.getElementById.mockReturnValue(mockElement);

            const result = calculateClusterZoomTransform('cluster_1', 1000, 800);

            expect(result).toBeDefined();
            expect(result.k).toBe(2.2); // scale
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        test('should center cluster in viewport', () => {
            const mockElement = {
                getBBox: () => ({
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100
                })
            };

            global.document.getElementById.mockReturnValue(mockElement);

            const width = 1000;
            const height = 800;
            const result = calculateClusterZoomTransform('cluster_1', width, height);

            // Center of cluster: (0 + 100/2, 0 + 100/2) = (50, 50)
            // Scale: 2.2
            // Translate: [width/2 - 2.2 * 50, height/2 - 2.2 * 50]
            //          = [500 - 110, 400 - 110] = [390, 290]

            expect(result.k).toBe(2.2);
            expect(result.x).toBeCloseTo(390, 1);
            expect(result.y).toBeCloseTo(290, 1);
        });

        test('should use fixed scale of 2.2', () => {
            const mockElement = {
                getBBox: () => ({
                    x: 100,
                    y: 100,
                    width: 50,
                    height: 50
                })
            };

            global.document.getElementById.mockReturnValue(mockElement);

            const result = calculateClusterZoomTransform('cluster_1', 2000, 1500);

            expect(result.k).toBe(2.2); // Always 2.2
        });

        test('should handle different viewport sizes', () => {
            const mockElement = {
                getBBox: () => ({
                    x: 200,
                    y: 150,
                    width: 100,
                    height: 80
                })
            };

            global.document.getElementById.mockReturnValue(mockElement);

            const result1 = calculateClusterZoomTransform('cluster_1', 1920, 1080);
            const result2 = calculateClusterZoomTransform('cluster_1', 1024, 768);

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
            expect(result1.k).toBe(2.2);
            expect(result2.k).toBe(2.2);

            // Different viewport sizes should result in different translations
            expect(result1.x).not.toBe(result2.x);
            expect(result1.y).not.toBe(result2.y);
        });
    });
});

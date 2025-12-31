import TooltipManager from './TooltipManager';

describe('TooltipManager', () => {
    let tooltipManager;
    let mockBody;

    beforeEach(() => {
        // Set up a clean DOM for each test
        document.body.innerHTML = '';
        mockBody = document.body;

        // Create tooltip manager
        tooltipManager = new TooltipManager();
    });

    afterEach(() => {
        // Clean up
        if (tooltipManager) {
            tooltipManager.cleanup();
        }
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        test('should create tooltip element and append to body', () => {
            const tooltip = document.getElementById('hex-tooltip');

            expect(tooltip).toBeTruthy();
            expect(tooltip.parentNode).toBe(document.body);
        });

        test('should initialize with correct default properties', () => {
            expect(tooltipManager.currentZoomLevel).toBe(1);
            expect(tooltipManager.zoomThreshold).toBe(2.2);
            expect(tooltipManager.connectionTooltips).toEqual([]);
            expect(tooltipManager.tooltipPositions).toEqual({});
        });

        test('should set tooltip styles correctly', () => {
            const tooltip = document.getElementById('hex-tooltip');

            expect(tooltip.style.position).toBe('fixed');
            expect(tooltip.style.opacity).toBe('0');
            expect(tooltip.style.zIndex).toBe('9999');
            expect(tooltip.style.pointerEvents).toBe('none');
        });

        test('should initialize positioning constants', () => {
            expect(tooltipManager.VERTICAL_SPACING).toBe(28);
            expect(tooltipManager.MIN_GAP).toBe(20);
            expect(tooltipManager.BASE_OFFSET_Y).toBe(-5);
            expect(tooltipManager.TRANSFORM_OFFSET).toBe('translate(-50%, -100%)');
        });
    });

    describe('updateZoomLevel', () => {
        test('should update current zoom level', () => {
            tooltipManager.updateZoomLevel(2.5);

            expect(tooltipManager.currentZoomLevel).toBe(2.5);
        });

        test('should hide tooltips when zoom is below threshold', () => {
            // Show tooltip first
            tooltipManager.currentZoomLevel = 2.5;
            tooltipManager.show('Test', { clientX: 100, clientY: 100 });

            // Update zoom below threshold
            tooltipManager.updateZoomLevel(1.0);

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.style.opacity).toBe('0');
        });

        test('should not affect tooltips when zoom is above threshold', () => {
            tooltipManager.currentZoomLevel = 2.5;
            tooltipManager.show('Test', { clientX: 100, clientY: 100 });

            const tooltip = document.getElementById('hex-tooltip');
            const initialOpacity = tooltip.style.opacity;

            tooltipManager.updateZoomLevel(3.0);

            // Opacity should remain the same
            expect(tooltip.style.opacity).toBe(initialOpacity);
        });

        test('should hide connection tooltips when zoom is below threshold', () => {
            // Create mock connection tooltips
            const mockTooltip = document.createElement('div');
            mockTooltip.id = 'connection-tooltip-test';
            document.body.appendChild(mockTooltip);
            tooltipManager.connectionTooltips.push(mockTooltip);

            tooltipManager.updateZoomLevel(1.0);

            expect(document.getElementById('connection-tooltip-test')).toBeFalsy();
        });
    });

    describe('show', () => {
        test('should show tooltip when zoom level is above threshold', () => {
            tooltipManager.updateZoomLevel(2.5);

            const event = { clientX: 100, clientY: 200 };
            tooltipManager.show('Test App', event);

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.textContent).toBe('Test App');
            expect(tooltip.style.left).toBe('100px');
            expect(tooltip.style.top).toBe('200px');
            expect(tooltip.style.opacity).toBe('1');
        });

        test('should not show tooltip when zoom level is below threshold', () => {
            tooltipManager.updateZoomLevel(1.0);

            const event = { clientX: 100, clientY: 200 };
            tooltipManager.show('Test App', event);

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.style.opacity).toBe('0');
        });

        test('should update tooltip position on subsequent calls', () => {
            tooltipManager.updateZoomLevel(2.5);

            tooltipManager.show('App 1', { clientX: 100, clientY: 100 });
            tooltipManager.show('App 2', { clientX: 200, clientY: 300 });

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.textContent).toBe('App 2');
            expect(tooltip.style.left).toBe('200px');
            expect(tooltip.style.top).toBe('300px');
        });

        test('should handle empty text', () => {
            tooltipManager.updateZoomLevel(2.5);

            tooltipManager.show('', { clientX: 100, clientY: 100 });

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.textContent).toBe('');
            expect(tooltip.style.opacity).toBe('1');
        });
    });

    describe('hide', () => {
        test('should hide visible tooltip', () => {
            tooltipManager.updateZoomLevel(2.5);
            tooltipManager.show('Test', { clientX: 100, clientY: 100 });

            tooltipManager.hide();

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.style.opacity).toBe('0');
        });

        test('should be idempotent (safe to call multiple times)', () => {
            tooltipManager.hide();
            tooltipManager.hide();

            const tooltip = document.getElementById('hex-tooltip');
            expect(tooltip.style.opacity).toBe('0');
        });
    });

    describe('calculateOptimalPositions', () => {
        beforeEach(() => {
            // Mock getBoundingClientRect
            Element.prototype.getBoundingClientRect = jest.fn();
        });

        test('should return empty object for empty connections', () => {
            const result = tooltipManager.calculateOptimalPositions([]);

            expect(result).toEqual({});
        });

        test('should calculate position for single connection', () => {
            const mockElement = {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 200,
                    width: 50,
                    height: 50
                })
            };

            document.getElementById = jest.fn(() => mockElement);

            const connections = [
                { target: { id: 'app1' } }
            ];

            const result = tooltipManager.calculateOptimalPositions(connections);

            expect(result['app1']).toBeDefined();
            expect(result['app1'].x).toBe(125); // left + width/2 = 100 + 25
            expect(result['app1'].y).toBe(205); // top - BASE_OFFSET_Y = 200 - (-5)
            expect(result['app1'].available).toBe(true);
        });

        test('should detect collisions for horizontally close hexagons', () => {
            const mockElement1 = {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 50,
                    height: 50
                })
            };

            const mockElement2 = {
                getBoundingClientRect: () => ({
                    left: 120, // Only 20px apart (< 70px threshold)
                    top: 100,
                    width: 50,
                    height: 50
                })
            };

            document.getElementById = jest.fn((id) => {
                if (id === 'hex-app1') return mockElement1;
                if (id === 'hex-app2') return mockElement2;
                return null;
            });

            const connections = [
                { target: { id: 'app1' } },
                { target: { id: 'app2' } }
            ];

            const result = tooltipManager.calculateOptimalPositions(connections);

            // Both should be marked as having collisions
            expect(result['app1'].available).toBe(false);
            expect(result['app2'].available).toBe(false);
        });

        test('should not detect collisions for far apart hexagons', () => {
            const mockElement1 = {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 50,
                    height: 50
                })
            };

            const mockElement2 = {
                getBoundingClientRect: () => ({
                    left: 300, // 200px apart (> 70px threshold)
                    top: 100,
                    width: 50,
                    height: 50
                })
            };

            document.getElementById = jest.fn((id) => {
                if (id === 'hex-app1') return mockElement1;
                if (id === 'hex-app2') return mockElement2;
                return null;
            });

            const connections = [
                { target: { id: 'app1' } },
                { target: { id: 'app2' } }
            ];

            const result = tooltipManager.calculateOptimalPositions(connections);

            expect(result['app1'].available).toBe(true);
            expect(result['app2'].available).toBe(true);
        });

        test('should stack tooltips vertically for grouped hexagons', () => {
            const mockElements = {
                'hex-app1': {
                    getBoundingClientRect: () => ({
                        left: 100,
                        top: 100,
                        width: 50,
                        height: 50
                    })
                },
                'hex-app2': {
                    getBoundingClientRect: () => ({
                        left: 110, // Close horizontally
                        top: 150, // Different vertical position
                        width: 50,
                        height: 50
                    })
                }
            };

            document.getElementById = jest.fn((id) => mockElements[id] || null);

            const connections = [
                { target: { id: 'app1' } },
                { target: { id: 'app2' } }
            ];

            const result = tooltipManager.calculateOptimalPositions(connections);

            // Second tooltip should be stacked below the first
            expect(result['app2'].y).toBeGreaterThan(result['app1'].y);
            expect(result['app2'].y - result['app1'].y).toBe(tooltipManager.VERTICAL_SPACING);
        });
    });

    describe('showConnectionTooltips', () => {
        beforeEach(() => {
            // Reset document.getElementById
            document.getElementById = jest.fn();
        });

        test('should not show tooltips when zoom is below threshold', () => {
            tooltipManager.updateZoomLevel(1.0);

            const connections = [
                { target: { id: 'app1' } }
            ];

            tooltipManager.showConnectionTooltips(connections, { current: {} });

            expect(tooltipManager.connectionTooltips.length).toBe(0);
        });

        test('should create connection tooltips when zoom is above threshold', () => {
            tooltipManager.updateZoomLevel(2.5);

            const mockElement = {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 50,
                    height: 50
                })
            };

            // Mock to return element for hex-app1
            const originalGetElementById = document.getElementById.bind(document);
            document.getElementById = jest.fn((id) => {
                if (id === 'hex-app1') return mockElement;
                return originalGetElementById(id);
            });

            const connections = [
                {
                    target: { id: 'app1', color: '#ff0000' }
                }
            ];

            const appCoordinatesRef = {
                current: {
                    'app1': { app: { name: 'Test App' } }
                }
            };

            tooltipManager.showConnectionTooltips(connections, appCoordinatesRef);

            expect(tooltipManager.connectionTooltips.length).toBe(1);

            // Find the created tooltip in the array (not by ID since it's dynamically created)
            const tooltip = tooltipManager.connectionTooltips[0];
            expect(tooltip).toBeTruthy();
            expect(tooltip.textContent).toBe('Test App');
        });

        test('should clear existing connection tooltips before creating new ones', () => {
            tooltipManager.updateZoomLevel(2.5);

            const mockElement = {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    width: 50,
                    height: 50
                })
            };

            // Mock to return elements for both hex IDs
            const originalGetElementById = document.getElementById.bind(document);
            document.getElementById = jest.fn((id) => {
                if (id === 'hex-app1' || id === 'hex-app2') return mockElement;
                return originalGetElementById(id);
            });

            const connections1 = [
                { target: { id: 'app1', color: '#ff0000' } }
            ];

            const connections2 = [
                { target: { id: 'app2', color: '#00ff00' } }
            ];

            const appCoordinatesRef = {
                current: {
                    'app1': { app: { name: 'App 1' } },
                    'app2': { app: { name: 'App 2' } }
                }
            };

            tooltipManager.showConnectionTooltips(connections1, appCoordinatesRef);
            const firstTooltipCount = tooltipManager.connectionTooltips.length;

            tooltipManager.showConnectionTooltips(connections2, appCoordinatesRef);
            const secondTooltipCount = tooltipManager.connectionTooltips.length;

            // Should have cleared and recreated
            expect(firstTooltipCount).toBe(1);
            expect(secondTooltipCount).toBe(1);
            expect(tooltipManager.connectionTooltips[0].textContent).toBe('App 2');
        });

        test('should skip connections with missing app data', () => {
            tooltipManager.updateZoomLevel(2.5);

            const connections = [
                { target: { id: 'nonexistent', color: '#ff0000' } }
            ];

            const appCoordinatesRef = {
                current: {}
            };

            tooltipManager.showConnectionTooltips(connections, appCoordinatesRef);

            expect(tooltipManager.connectionTooltips.length).toBe(0);
        });
    });

    describe('hideAllConnectionTooltips', () => {
        test('should remove all connection tooltips from DOM', () => {
            // Create mock tooltips
            const tooltip1 = document.createElement('div');
            tooltip1.id = 'connection-tooltip-1';
            document.body.appendChild(tooltip1);

            const tooltip2 = document.createElement('div');
            tooltip2.id = 'connection-tooltip-2';
            document.body.appendChild(tooltip2);

            tooltipManager.connectionTooltips = [tooltip1, tooltip2];

            tooltipManager.hideAllConnectionTooltips();

            expect(document.getElementById('connection-tooltip-1')).toBeFalsy();
            expect(document.getElementById('connection-tooltip-2')).toBeFalsy();
            expect(tooltipManager.connectionTooltips.length).toBe(0);
        });

        test('should clear tooltip positions tracking', () => {
            tooltipManager.tooltipPositions = { app1: {}, app2: {} };

            tooltipManager.hideAllConnectionTooltips();

            expect(tooltipManager.tooltipPositions).toEqual({});
        });

        test('should be safe to call when no tooltips exist', () => {
            tooltipManager.connectionTooltips = [];

            expect(() => {
                tooltipManager.hideAllConnectionTooltips();
            }).not.toThrow();
        });

        test('should handle tooltips already removed from DOM', () => {
            const tooltip = document.createElement('div');
            tooltipManager.connectionTooltips = [tooltip];

            expect(() => {
                tooltipManager.hideAllConnectionTooltips();
            }).not.toThrow();
        });
    });

    describe('cleanup', () => {
        test('should remove main tooltip from DOM', () => {
            tooltipManager.cleanup();

            expect(document.getElementById('hex-tooltip')).toBeFalsy();
        });

        test('should remove all connection tooltips', () => {
            const connTooltip = document.createElement('div');
            connTooltip.id = 'connection-tooltip-test';
            document.body.appendChild(connTooltip);
            tooltipManager.connectionTooltips = [connTooltip];

            tooltipManager.cleanup();

            expect(document.getElementById('connection-tooltip-test')).toBeFalsy();
        });

        test('should be safe to call multiple times', () => {
            tooltipManager.cleanup();

            expect(() => {
                tooltipManager.cleanup();
            }).not.toThrow();
        });

        test('should handle already cleaned up tooltips', () => {
            tooltipManager.cleanup();
            // Manually remove any remaining elements
            const tooltip = document.getElementById('hex-tooltip');
            if (tooltip) tooltip.remove();

            expect(() => {
                tooltipManager.cleanup();
            }).not.toThrow();
        });
    });

    describe('integration scenarios', () => {
        test('should handle complete lifecycle: show -> hide -> cleanup', () => {
            tooltipManager.updateZoomLevel(2.5);

            // Show tooltip
            tooltipManager.show('Test', { clientX: 100, clientY: 100 });
            let tooltip = tooltipManager.tooltip; // Use direct reference
            expect(tooltip.style.opacity).toBe('1');

            // Hide tooltip
            tooltipManager.hide();
            expect(tooltip.style.opacity).toBe('0');

            // Cleanup
            tooltipManager.cleanup();
            // After cleanup, tooltip should be removed from DOM
            expect(document.body.contains(tooltip)).toBe(false);
        });

        test('should handle zoom changes affecting tooltip visibility', () => {
            // Start above threshold
            tooltipManager.updateZoomLevel(2.5);
            tooltipManager.show('Test', { clientX: 100, clientY: 100 });

            let tooltip = tooltipManager.tooltip; // Use direct reference
            expect(tooltip.style.opacity).toBe('1');

            // Zoom below threshold
            tooltipManager.updateZoomLevel(1.0);
            expect(tooltip.style.opacity).toBe('0');

            // Try to show again (should not work)
            tooltipManager.show('Test 2', { clientX: 200, clientY: 200 });
            expect(tooltip.style.opacity).toBe('0');

            // Zoom back above threshold
            tooltipManager.updateZoomLevel(3.0);
            tooltipManager.show('Test 3', { clientX: 300, clientY: 300 });
            expect(tooltip.style.opacity).toBe('1');
            expect(tooltip.textContent).toBe('Test 3');
        });
    });
});

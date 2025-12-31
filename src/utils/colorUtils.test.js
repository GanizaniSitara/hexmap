import { getStatusColor, getHexagonFillColor } from './colorUtils';

describe('colorUtils', () => {
    describe('getStatusColor', () => {
        test('should return red for low status (0-32)', () => {
            expect(getStatusColor(0)).toBe('#FF0000');
            expect(getStatusColor(15)).toBe('#FF0000');
            expect(getStatusColor(32)).toBe('#FF0000');
        });

        test('should return amber for medium status (33-65)', () => {
            expect(getStatusColor(33)).toBe('#FFA500');
            expect(getStatusColor(50)).toBe('#FFA500');
            expect(getStatusColor(65)).toBe('#FFA500');
        });

        test('should return green for high status (66-100)', () => {
            expect(getStatusColor(66)).toBe('#008000');
            expect(getStatusColor(80)).toBe('#008000');
            expect(getStatusColor(100)).toBe('#008000');
        });

        test('should return grey for undefined status', () => {
            expect(getStatusColor(undefined)).toBe('#808080');
        });

        test('should return grey for null status', () => {
            expect(getStatusColor(null)).toBe('#808080');
        });

        test('should handle boundary values correctly', () => {
            expect(getStatusColor(32)).toBe('#FF0000');  // Last red value
            expect(getStatusColor(33)).toBe('#FFA500'); // First amber value
            expect(getStatusColor(65)).toBe('#FFA500'); // Last amber value
            expect(getStatusColor(66)).toBe('#008000'); // First green value
        });

        test('should handle edge cases', () => {
            expect(getStatusColor(0)).toBe('#FF0000');
            expect(getStatusColor(100)).toBe('#008000');
        });
    });

    describe('getHexagonFillColor', () => {
        const mockCluster = {
            id: 'cluster1',
            name: 'Test Cluster',
            color: '#1f78b4'
        };

        const mockApp = {
            id: 'app1',
            name: 'Test App',
            status: 75
        };

        test('should return cluster color in Cluster mode', () => {
            const data = {
                cluster: mockCluster,
                app: mockApp
            };

            const result = getHexagonFillColor(data, 'Cluster');
            expect(result).toBe('#1f78b4');
        });

        test('should return status color in Status mode when app exists', () => {
            const data = {
                cluster: mockCluster,
                app: mockApp
            };

            const result = getHexagonFillColor(data, 'Status');
            expect(result).toBe('#008000'); // status 75 should be green
        });

        test('should return cluster color in Status mode when app has no status', () => {
            const appWithoutStatus = {
                id: 'app2',
                name: 'App Without Status'
                // no status property
            };

            const data = {
                cluster: mockCluster,
                app: appWithoutStatus
            };

            const result = getHexagonFillColor(data, 'Status');
            expect(result).toBe('#808080'); // undefined status returns grey
        });

        test('should return default grey when data is missing', () => {
            const result = getHexagonFillColor(null, 'Cluster');
            expect(result).toBe('#cccccc');
        });

        test('should return default grey when no cluster', () => {
            const data = {
                app: mockApp
            };

            const result = getHexagonFillColor(data, 'Cluster');
            expect(result).toBe('#cccccc');
        });

        test('should handle Status mode with different status values', () => {
            const testCases = [
                { status: 10, expectedColor: '#FF0000' },  // Red
                { status: 50, expectedColor: '#FFA500' },  // Amber
                { status: 90, expectedColor: '#008000' },  // Green
            ];

            testCases.forEach(({ status, expectedColor }) => {
                const data = {
                    cluster: mockCluster,
                    app: { ...mockApp, status }
                };

                const result = getHexagonFillColor(data, 'Status');
                expect(result).toBe(expectedColor);
            });
        });

        test('should handle empty data object', () => {
            const result = getHexagonFillColor({}, 'Cluster');
            expect(result).toBe('#cccccc');
        });

        test('should handle undefined color mode', () => {
            const data = {
                cluster: mockCluster,
                app: mockApp
            };

            // Without explicit mode, should default to cluster color
            const result = getHexagonFillColor(data, undefined);
            expect(result).toBe('#1f78b4');
        });

        test('should prioritize Status mode over cluster color when specified', () => {
            const data = {
                cluster: mockCluster,
                app: { ...mockApp, status: 25 } // Low status
            };

            const clusterResult = getHexagonFillColor(data, 'Cluster');
            const statusResult = getHexagonFillColor(data, 'Status');

            expect(clusterResult).toBe('#1f78b4'); // Cluster color
            expect(statusResult).toBe('#FF0000');  // Status color (red)
            expect(clusterResult).not.toBe(statusResult);
        });
    });
});

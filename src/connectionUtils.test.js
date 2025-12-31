import {
    generateConnectionPath,
    getConnectionStyles,
    getTypeColor,
    getLighterColor
} from './connectionUtils';

describe('connectionUtils', () => {
    describe('generateConnectionPath', () => {
        const source = { x: 100, y: 100 };
        const target = { x: 200, y: 200 };

        test('should generate valid SVG path', () => {
            const path = generateConnectionPath(source, target, 'link');

            expect(path).toContain('M'); // Move command
            expect(path).toContain('Q'); // Quadratic curve command
            expect(path.startsWith('M 100 100')).toBe(true);
            expect(path.endsWith('200 200')).toBe(true);
        });

        test('should create different curves for different connection types', () => {
            const dataFlowPath = generateConnectionPath(source, target, 'data-flow');
            const apiPath = generateConnectionPath(source, target, 'api');
            const integrationPath = generateConnectionPath(source, target, 'integration');

            // All should be valid paths but with different control points
            expect(dataFlowPath).not.toBe(apiPath);
            expect(apiPath).not.toBe(integrationPath);
            expect(dataFlowPath).not.toBe(integrationPath);
        });

        test('should handle data-flow type with high curve', () => {
            const path = generateConnectionPath(source, target, 'data-flow');

            // Should be a curved path (contains Q for quadratic curve)
            expect(path).toContain('Q');
            expect(path.startsWith('M')).toBe(true);
        });

        test('should handle api type with low curve', () => {
            const path = generateConnectionPath(source, target, 'api');

            expect(path).toContain('Q');
            expect(path.startsWith('M')).toBe(true);
        });

        test('should handle integration type with medium curve', () => {
            const path = generateConnectionPath(source, target, 'integration');

            expect(path).toContain('Q');
            expect(path.startsWith('M')).toBe(true);
        });

        test('should use default curve for unknown type', () => {
            const path = generateConnectionPath(source, target, 'unknown-type');

            expect(path).toContain('Q');
            expect(path.startsWith('M')).toBe(true);
        });

        test('should handle vertical connections', () => {
            const verticalSource = { x: 100, y: 100 };
            const verticalTarget = { x: 100, y: 300 };

            const path = generateConnectionPath(verticalSource, verticalTarget, 'link');

            expect(path).toContain('M 100 100');
            expect(path).toContain('100 300');
        });

        test('should handle horizontal connections', () => {
            const horizontalSource = { x: 100, y: 100 };
            const horizontalTarget = { x: 400, y: 100 };

            const path = generateConnectionPath(horizontalSource, horizontalTarget, 'link');

            expect(path).toContain('M 100 100');
            expect(path).toContain('400 100');
        });

        test('should handle diagonal connections', () => {
            const diagonalSource = { x: 0, y: 0 };
            const diagonalTarget = { x: 100, y: 100 };

            const path = generateConnectionPath(diagonalSource, diagonalTarget, 'link');

            expect(path).toContain('M 0 0');
            expect(path).toContain('100 100');
        });

        test('should handle short distance connections', () => {
            const closeSource = { x: 100, y: 100 };
            const closeTarget = { x: 110, y: 110 };

            const path = generateConnectionPath(closeSource, closeTarget, 'link');

            expect(path).toBeDefined();
            expect(path).toContain('Q');
        });
    });

    describe('getConnectionStyles', () => {
        test('should return correct style for high strength', () => {
            const style = getConnectionStyles('high');

            expect(style.strokeWidth).toBe(3);
            expect(style.dashArray).toBe('none');
        });

        test('should return correct style for medium strength', () => {
            const style = getConnectionStyles('medium');

            expect(style.strokeWidth).toBe(2);
            expect(style.dashArray).toBe('none');
        });

        test('should return correct style for low strength', () => {
            const style = getConnectionStyles('low');

            expect(style.strokeWidth).toBe(1.5);
            expect(style.dashArray).toBe('5,3');
        });

        test('should return default style for unknown strength', () => {
            const style = getConnectionStyles('unknown');

            expect(style.strokeWidth).toBe(2);
            expect(style.dashArray).toBe('none');
        });

        test('should return default style for undefined strength', () => {
            const style = getConnectionStyles(undefined);

            expect(style.strokeWidth).toBe(2);
            expect(style.dashArray).toBe('none');
        });

        test('should have dashArray only for low strength', () => {
            const high = getConnectionStyles('high');
            const medium = getConnectionStyles('medium');
            const low = getConnectionStyles('low');

            expect(high.dashArray).toBe('none');
            expect(medium.dashArray).toBe('none');
            expect(low.dashArray).not.toBe('none');
        });
    });

    describe('getTypeColor', () => {
        test('should return blue for data-flow', () => {
            expect(getTypeColor('data-flow')).toBe('#2563eb');
        });

        test('should return green for api', () => {
            expect(getTypeColor('api')).toBe('#65a30d');
        });

        test('should return purple for integration', () => {
            expect(getTypeColor('integration')).toBe('#9333ea');
        });

        test('should return gray for unknown type', () => {
            expect(getTypeColor('unknown')).toBe('#6b7280');
        });

        test('should return gray for undefined type', () => {
            expect(getTypeColor(undefined)).toBe('#6b7280');
        });

        test('should return valid hex colors', () => {
            const types = ['data-flow', 'api', 'integration', 'unknown'];

            types.forEach(type => {
                const color = getTypeColor(type);
                expect(color).toMatch(/^#[0-9a-f]{6}$/i);
            });
        });
    });

    describe('getLighterColor', () => {
        test('should lighten a dark color', () => {
            const darkBlue = '#2563eb';
            const lighter = getLighterColor(darkBlue);

            expect(lighter).toMatch(/^#[0-9a-f]{6}$/);
            expect(lighter).not.toBe(darkBlue);

            // Check that RGB values increased
            const originalR = parseInt(darkBlue.slice(1, 3), 16);
            const lighterR = parseInt(lighter.slice(1, 3), 16);
            expect(lighterR).toBeGreaterThan(originalR);
        });

        test('should lighten red color', () => {
            const red = '#ff0000';
            const lighter = getLighterColor(red);

            expect(lighter).toBe('#ff2828'); // 255, 40, 40
        });

        test('should lighten green color', () => {
            const green = '#00ff00';
            const lighter = getLighterColor(green);

            expect(lighter).toBe('#28ff28'); // 40, 255, 40
        });

        test('should lighten blue color', () => {
            const blue = '#0000ff';
            const lighter = getLighterColor(blue);

            expect(lighter).toBe('#2828ff'); // 40, 40, 255
        });

        test('should cap values at 255', () => {
            const nearWhite = '#f0f0f0'; // 240, 240, 240
            const lighter = getLighterColor(nearWhite);

            // All channels should be capped at 255 (ff)
            expect(lighter).toBe('#ffffff');
        });

        test('should handle black color', () => {
            const black = '#000000';
            const lighter = getLighterColor(black);

            expect(lighter).toBe('#282828'); // 40, 40, 40
        });

        test('should handle gray colors', () => {
            const gray = '#808080'; // 128, 128, 128
            const lighter = getLighterColor(gray);

            expect(lighter).toBe('#a8a8a8'); // 168, 168, 168
        });

        test('should return valid hex color format', () => {
            const testColors = ['#123456', '#abcdef', '#ff00ff', '#000000'];

            testColors.forEach(color => {
                const lighter = getLighterColor(color);
                expect(lighter).toMatch(/^#[0-9a-f]{6}$/);
                expect(lighter.length).toBe(7);
            });
        });

        test('should consistently lighten by 40 units per channel', () => {
            const color = '#102030'; // 16, 32, 48
            const lighter = getLighterColor(color);

            const r = parseInt(lighter.slice(1, 3), 16);
            const g = parseInt(lighter.slice(3, 5), 16);
            const b = parseInt(lighter.slice(5, 7), 16);

            expect(r).toBe(56);  // 16 + 40
            expect(g).toBe(72);  // 32 + 40
            expect(b).toBe(88);  // 48 + 40
        });

        test('should preserve hex format with leading zeros', () => {
            const color = '#010203';
            const lighter = getLighterColor(color);

            // Should have 6 hex digits even if values are small
            expect(lighter.length).toBe(7);
            expect(lighter).toMatch(/^#[0-9a-f]{6}$/);
        });
    });
});

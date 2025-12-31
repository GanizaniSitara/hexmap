import * as d3 from 'd3';

class HexGrid {
    constructor(hexSize, width, height) {
        this.hexSize = hexSize;
        this.width = width;
        this.height = height;
    }

    // Conversion from hex grid coordinates (odd-r horizontal) to pixel coordinates
    gridToPixel(q, r) {
        // Center the grid by offsetting based on half the width and height
        const centerOffsetX = this.width / 2;
        const centerOffsetY = this.height / 2;

        const x = centerOffsetX + this.hexSize * Math.sqrt(3) * (q + 0.5 * (r & 1));
        const y = centerOffsetY + this.hexSize * 3/2 * r;
        return { x, y };
    }

    // Conversion from pixel coordinates back to hex grid coordinates
    pixelToGrid(x, y) {
        // Remove the center offsets
        const centerOffsetX = this.width / 2;
        const centerOffsetY = this.height / 2;

        const adjustedX = x - centerOffsetX;
        const adjustedY = y - centerOffsetY;

        // First, calculate r from y (this is straightforward)
        const r = Math.round(adjustedY * 2/3 / this.hexSize);

        // Now calculate q, accounting for the odd-row offset
        // For odd rows, we need to subtract the 0.5 offset before rounding
        const qFloat = adjustedX / (this.hexSize * Math.sqrt(3)) - 0.5 * (r & 1);
        const q = Math.round(qFloat);

        return { q, r };
    }

    // Generate hexagon path
    hexagonPath(size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 2 + i * (Math.PI / 3);
            points.push([size * Math.cos(angle), size * Math.sin(angle)]);
        }
        return d3.line()(points) + "Z";
    }

    // Generate hex coordinates based on absolute grid positions
    // All apps must have gridPosition defined
    generateHexCoords(count, gridQ, gridR, clusterApps = [], occupiedPositions = {}) {
        const coords = [];

        // Verify all apps have grid positions
        if (!clusterApps || clusterApps.length === 0) {
            console.warn("No applications provided for cluster");
            return coords;
        }

        // Check for any missing grid positions
        const missingPositions = clusterApps.filter(app =>
            !app.gridPosition || typeof app.gridPosition.q !== 'number' || typeof app.gridPosition.r !== 'number'
        );

        if (missingPositions.length > 0) {
            console.error(`${missingPositions.length} apps missing grid positions:`,
                missingPositions.map(app => app.name || app.id).join(', '));
        }

        // Process each app and place it at its absolute position
        clusterApps.forEach(app => {
            // Skip apps without valid grid positions
            if (!app.gridPosition || typeof app.gridPosition.q !== 'number' || typeof app.gridPosition.r !== 'number') {
                return;
            }

            const gridPos = `${app.gridPosition.q},${app.gridPosition.r}`;

            // Check for collision
            if (occupiedPositions[gridPos]) {
                console.warn(`Collision detected: App "${app.name}" at position ${gridPos} collides with "${occupiedPositions[gridPos].name}" from cluster "${occupiedPositions[gridPos].clusterName}"`);
                // Still add it to the visualization but mark it as conflicted
                app.hasCollision = true;
                app.collidesWith = {
                    name: occupiedPositions[gridPos].name,
                    clusterId: occupiedPositions[gridPos].clusterId,
                    clusterName: occupiedPositions[gridPos].clusterName
                };
            } else {
                // Mark this position as occupied
                occupiedPositions[gridPos] = {
                    name: app.name,
                    clusterId: app.clusterId || 'unknown',
                    clusterName: app.clusterName || 'Unknown Cluster'
                };
            }

            // Convert from grid coordinates to pixel coordinates
            const pixelPos = this.gridToPixel(app.gridPosition.q, app.gridPosition.r);
            coords.push({
                x: pixelPos.x,
                y: pixelPos.y,
                appName: app.name,
                app: app,
                gridPosition: app.gridPosition,
                hasCollision: app.hasCollision,
                collidesWith: app.collidesWith
            });
        });

        // Log how many apps were successfully positioned
        console.log(`Positioned ${coords.length} out of ${clusterApps.length} applications`);

        return coords;
    }
}

export default HexGrid;
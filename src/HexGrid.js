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

        const q = (adjustedX * Math.sqrt(3)/3 - adjustedY / 3) / this.hexSize;
        const r = adjustedY * 2/3 / this.hexSize;
        return {
            q: Math.round(q),
            r: Math.round(r)
        };
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

    // Generate hex coordinates for a cluster based on grid position
    // Modified to handle absolute positioning of individual apps
    generateHexCoords(count, gridQ, gridR, clusterApps = [], occupiedPositions = {}) {
        const coords = [];
        const horizontalSpacing = this.hexSize * Math.sqrt(3);
        const verticalSpacing = 1.5 * this.hexSize;

        // Fixed width for clusters (as requested)
        const CLUSTER_WIDTH = 5;

        // Split apps into positioned and unpositioned
        const positionedApps = [];
        const unpositionedApps = [];

        // Check if clusterApps is defined and has elements
        if (clusterApps && clusterApps.length > 0) {
            clusterApps.forEach(app => {
                if (app.gridPosition && typeof app.gridPosition.q === 'number' && typeof app.gridPosition.r === 'number') {
                    // This app has a valid absolute position
                    positionedApps.push(app);
                } else {
                    // This app will be part of the cluster layout
                    unpositionedApps.push(app);
                }
            });

            // Position apps with absolute coordinates
            positionedApps.forEach(app => {
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
        }

        // Calculate how many remaining hexagons need to be positioned in the cluster layout
        const remainingCount = count - positionedApps.length;

        if (remainingCount > 0) {
            // Handle the remaining apps without absolute positions using the cluster layout
            const baseCoords = this.gridToPixel(gridQ, gridR);

            // Force width to be exactly CLUSTER_WIDTH (5) as requested
            const cols = CLUSTER_WIDTH;
            const rows = Math.ceil(remainingCount / cols);
            let hexIndex = 0;

            // Try to place unpositioned hexagons, avoiding collisions
            for (let row = 0; row < rows * 2; row++) { // Expand search area if needed
                for (let col = 0; col < cols; col++) { // Strictly limit to CLUSTER_WIDTH columns
                    if (hexIndex >= remainingCount) break;

                    // Calculate staggered grid position
                    const offsetX = (row % 2 === 1) ? horizontalSpacing / 2 : 0;
                    const x = baseCoords.x + (col * horizontalSpacing) + offsetX;
                    const y = baseCoords.y + (row * verticalSpacing);

                    // Convert back to grid coordinates to check for collisions
                    const gridPos = this.pixelToGrid(x, y);
                    const gridPosKey = `${gridPos.q},${gridPos.r}`;

                    // If position is already occupied, skip it
                    if (occupiedPositions[gridPosKey]) {
                        continue;
                    }

                    // Position is free, use it
                    const appName = hexIndex < unpositionedApps.length ? unpositionedApps[hexIndex].name : '';
                    const app = hexIndex < unpositionedApps.length ? unpositionedApps[hexIndex] : null;

                    if (app) {
                        // Mark this position as occupied
                        occupiedPositions[gridPosKey] = {
                            name: appName,
                            clusterId: app.clusterId || 'unknown',
                            clusterName: app.clusterName || 'Unknown Cluster'
                        };
                    }

                    coords.push({
                        x,
                        y,
                        appName,
                        app,
                        gridPosition: gridPos,
                        hasCollision: false
                    });

                    hexIndex++;
                }
            }
        }

        return coords;
    }
}

export default HexGrid;
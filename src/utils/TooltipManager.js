export default class TooltipManager {
    constructor() {
        // Create main tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'hex-tooltip';
        this.tooltip.style.cssText = `
      position: fixed;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-family: sans-serif;
      font-weight: 500;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.3);
      opacity: 0;
      transition: opacity 0.15s ease;
      transform: translate(-50%, -120%);
    `;
        document.body.appendChild(this.tooltip);

        // Initialize
        this.currentZoomLevel = 1;
        this.zoomThreshold = 2.2;
        this.connectionTooltips = [];

        // Track tooltip positions to avoid collisions
        this.tooltipPositions = {};
    }

    updateZoomLevel(zoomLevel) {
        this.currentZoomLevel = zoomLevel;
        if (zoomLevel < this.zoomThreshold) {
            this.hide();
            this.hideAllConnectionTooltips();
        }
    }

    show(text, event) {
        if (this.currentZoomLevel >= this.zoomThreshold) {
            this.tooltip.textContent = text;
            this.tooltip.style.left = `${event.clientX}px`;
            this.tooltip.style.top = `${event.clientY}px`;
            this.tooltip.style.opacity = '1';
        }
    }

    hide() {
        this.tooltip.style.opacity = '0';
    }

    // Improved function to find non-colliding vertical position
    findNonCollidingPosition(targetId, baseY, width) {
        // Start with a default offset
        let offsetY = 0;

        // Check if any existing tooltip is in a similar horizontal position
        const targetX = parseInt(this.tooltipPositions[targetId]?.x || 0);

        // Look at all existing tooltip positions
        const occupiedPositions = Object.values(this.tooltipPositions);

        // Sort existing tooltips by Y position (to find nearest gap)
        const sortedPositions = occupiedPositions.filter(pos => {
            // Only consider tooltips that could horizontally overlap
            // Consider tooltips within a horizontal range that might overlap
            const horizontalDistance = Math.abs(targetX - parseInt(pos.x));
            return horizontalDistance < width / 1.5; // If tooltips are closer than half their width
        }).sort((a, b) => parseInt(a.y) - parseInt(b.y));

        // Find a vertical position with enough space
        const minSpacing = 30; // Minimum pixel spacing between tooltips

        if (sortedPositions.length > 0) {
            // Start with an offset above the target
            offsetY = -25;

            // Try positions with increasing vertical offset until we find a non-colliding spot
            for (let attempt = 0; attempt < 10; attempt++) { // Limit attempts to prevent infinite loop
                const proposedY = baseY + offsetY;

                // Check if this position collides with any existing tooltip
                const hasCollision = sortedPositions.some(pos => {
                    const existingY = parseInt(pos.y);
                    return Math.abs(existingY - proposedY) < minSpacing;
                });

                if (!hasCollision) {
                    break; // Found a good position
                }

                // Try the next position (alternate above and below with increasing distance)
                offsetY = (attempt % 2 === 0) ?
                    Math.abs(offsetY) + minSpacing :
                    -(Math.abs(offsetY) + minSpacing);
            }
        }

        return offsetY;
    }

    // Show tooltips on connected hexagons
    showConnectionTooltips(connections, appCoordinatesRef) {
        if (this.currentZoomLevel < this.zoomThreshold) return;

        // Clear any existing connection tooltips
        this.hideAllConnectionTooltips();

        // Reset position tracking
        this.tooltipPositions = {};

        // Create new tooltips for each connection
        connections.forEach((connection, index) => {
            const targetId = connection.target.id;
            const targetApp = appCoordinatesRef.current[targetId]?.app;

            if (!targetApp) return;

            const tooltip = document.createElement('div');
            tooltip.id = `connection-tooltip-${targetId}`;
            tooltip.style.cssText = `
        position: fixed;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-family: sans-serif;
        font-weight: 500;
        pointer-events: none;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        white-space: nowrap;
        border: 1px solid rgba(255, 255, 255, 0.3);
        opacity: 0;
        transition: opacity 0.15s ease;
        transform: translate(-50%, -150%);
      `;

            // Position the tooltip above the target hexagon
            const hexElement = document.getElementById(`hex-${targetId}`);
            if (hexElement) {
                const rect = hexElement.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top;
                const tooltipWidth = targetApp.name.length * 7 + 20; // Estimate width based on text length

                // Find a position that doesn't collide with other tooltips
                const offsetY = this.findNonCollidingPosition(targetId, centerY, tooltipWidth);

                // Store this tooltip's position for future collision detection
                this.tooltipPositions[targetId] = {
                    x: centerX,
                    y: centerY + offsetY
                };

                tooltip.textContent = targetApp.name;
                tooltip.style.left = `${centerX}px`;
                tooltip.style.top = `${centerY + offsetY}px`;
                tooltip.style.opacity = '1';

                // IMPORTANT: Use the TARGET color for the border, not the source
                const borderColor = connection.target.color;
                tooltip.style.borderLeft = `3px solid ${borderColor}`;

                document.body.appendChild(tooltip);
                this.connectionTooltips.push(tooltip);
            }
        });
    }

    hideAllConnectionTooltips() {
        // Remove all connection tooltips from the DOM
        this.connectionTooltips.forEach(tooltip => {
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });

        // Clear the array and position tracking
        this.connectionTooltips = [];
        this.tooltipPositions = {};
    }

    cleanup() {
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }

        this.hideAllConnectionTooltips();
    }
}
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

        // Constants for positioning
        this.VERTICAL_SPACING = 28; // Pixels between tooltip centers
        this.MIN_GAP = 20; // Minimum gap required to place a tooltip
        this.BASE_OFFSET_Y = -5; // Base offset from the hexagon - much closer now
        this.TRANSFORM_OFFSET = "translate(-50%, -100%)"; // Transform to position tooltip properly
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

    // Analyze the space around each hexagon and calculate optimal tooltip positions
    calculateOptimalPositions(connections) {
        // Map to store the optimal position for each target ID
        const positions = {};

        // Extract all target hexagons
        const targetElements = connections.map(conn => {
            const el = document.getElementById(`hex-${conn.target.id}`);
            return { id: conn.target.id, element: el, conn };
        }).filter(item => item.element);

        // First, analyze available space for each hex
        targetElements.forEach(target => {
            const rect = target.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;

            // Use the top of the hexagon but move down to place tooltip closer
            const centerY = rect.top - this.BASE_OFFSET_Y;

            // Check for neighboring hexagons in proximity
            const neighbors = targetElements.filter(other => other.id !== target.id);

            let foundCollision = false;

            neighbors.forEach(neighbor => {
                const neighborRect = neighbor.element.getBoundingClientRect();
                const neighborCenterX = neighborRect.left + neighborRect.width / 2;

                // Horizontal distance between hexagons
                const horizontalDistance = Math.abs(centerX - neighborCenterX);

                // Only consider neighbors that are horizontally close enough to cause conflicts
                if (horizontalDistance < 70) {
                    foundCollision = true;
                }
            });

            // Store the calculated position
            positions[target.id] = {
                x: centerX,
                y: centerY,
                available: !foundCollision
            };
        });

        // Second pass: if multiple hexagons are in proximity, stack their tooltips
        // Find groups of hexagons that are close horizontally
        const horizontalGroups = [];

        // Simple grouping algorithm - can be improved for more complex scenarios
        targetElements.forEach(target => {
            const rect = target.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;

            // Find if this target fits in an existing group
            let foundGroup = false;
            for (let group of horizontalGroups) {
                // Check if target is horizontally close to any hex in the group
                const isClose = group.some(groupMember => {
                    const memberElement = document.getElementById(`hex-${groupMember.id}`);
                    if (!memberElement) return false;

                    const memberRect = memberElement.getBoundingClientRect();
                    const memberX = memberRect.left + memberRect.width / 2;
                    return Math.abs(centerX - memberX) < 70;
                });

                if (isClose) {
                    group.push(target);
                    foundGroup = true;
                    break;
                }
            }

            // If no group found, create a new one
            if (!foundGroup) {
                horizontalGroups.push([target]);
            }
        });

        // For each group, stack tooltips vertically if needed
        horizontalGroups.forEach(group => {
            if (group.length <= 1) return; // No need to stack single tooltips

            // Sort by vertical position (top to bottom)
            group.sort((a, b) => {
                const aRect = a.element.getBoundingClientRect();
                const bRect = b.element.getBoundingClientRect();
                return aRect.top - bRect.top;
            });

            // Stack tooltips with proper spacing
            group.forEach((target, index) => {
                if (index === 0) return; // Keep the first one as is

                const prevTarget = group[index - 1];
                const prevPosition = positions[prevTarget.id];

                // Calculate new position based on previous tooltip
                positions[target.id] = {
                    x: positions[target.id].x,
                    y: prevPosition.y + this.VERTICAL_SPACING,
                    available: false // Mark as moved due to stacking
                };
            });
        });

        return positions;
    }

    // Show tooltips on connected hexagons
    showConnectionTooltips(connections, appCoordinatesRef) {
        if (this.currentZoomLevel < this.zoomThreshold) return;

        // Clear any existing connection tooltips
        this.hideAllConnectionTooltips();

        // Calculate optimal positions for all tooltips
        const optimalPositions = this.calculateOptimalPositions(connections);

        // Create new tooltips for each connection
        connections.forEach((connection) => {
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
        transform: ${this.TRANSFORM_OFFSET};
      `;

            // Position the tooltip using calculated optimal position
            const hexElement = document.getElementById(`hex-${targetId}`);
            if (hexElement && optimalPositions[targetId]) {
                const position = optimalPositions[targetId];

                tooltip.textContent = targetApp.name;
                tooltip.style.left = `${position.x}px`;
                tooltip.style.top = `${position.y}px`;
                tooltip.style.opacity = '1';

                // IMPORTANT: Use the TARGET color for the border
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
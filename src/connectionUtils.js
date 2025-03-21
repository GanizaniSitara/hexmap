import * as d3 from 'd3';

// Define the custom connection path
export const generateConnectionPath = (source, target, type) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate control points for a curved path
    // Adjust curve height based on connection type
    let curveHeight;
    switch (type) {
        case "data-flow":
            curveHeight = distance * 0.3; // High curve
            break;
        case "api":
            curveHeight = distance * 0.15; // Low curve
            break;
        case "integration":
        default:
            curveHeight = distance * 0.2; // Medium curve
            break;
    }

    // Midpoint of the straight line between source and target
    const mpx = (source.x + target.x) / 2;
    const mpy = (source.y + target.y) / 2;

    // Direction vector, normalized
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Perpendicular direction vector (rotate 90 degrees)
    const perpX = -dirY;
    const perpY = dirX;

    // Control point is midpoint shifted perpendicularly
    const cpx = mpx + perpX * curveHeight;
    const cpy = mpy + perpY * curveHeight;

    // Create the SVG path string using quadratic curve
    return `M ${source.x} ${source.y} Q ${cpx} ${cpy}, ${target.x} ${target.y}`;
};

// Define connection line styles based on strength
export const getConnectionStyles = (strength) => {
    switch (strength) {
        case "high":
            return {
                strokeWidth: 3,
                dashArray: "none"
            };
        case "medium":
            return {
                strokeWidth: 2,
                dashArray: "none"
            };
        case "low":
            return {
                strokeWidth: 1.5,
                dashArray: "5,3"
            };
        default:
            return {
                strokeWidth: 2,
                dashArray: "none"
            };
    }
};

// Helper function to get color for connection type
export const getTypeColor = (type) => {
    switch(type) {
        case 'data-flow':
            return '#2563eb'; // Blue
        case 'api':
            return '#65a30d'; // Green
        case 'integration':
            return '#9333ea'; // Purple
        default:
            return '#6b7280'; // Gray
    }
};

// Helper function to create a lighter color for hover effect
export const getLighterColor = (hexColor) => {
    // Parse the hex color
    let r = parseInt(hexColor.slice(1, 3), 16);
    let g = parseInt(hexColor.slice(3, 5), 16);
    let b = parseInt(hexColor.slice(5, 7), 16);

    // Lighten the color (increase RGB values)
    r = Math.min(255, r + 40);
    g = Math.min(255, g + 40);
    b = Math.min(255, b + 40);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
import * as d3 from 'd3';

// Function to determine if a hexagon should be visible at current zoom level
export const shouldHexagonBeVisible = (hexagon, zoomLevel) => {
    // All hexagons are visible at all zoom levels in the new approach
    return true;
};

// Function to get all visible hexagons in a cluster
export const getVisibleHexagonsInCluster = (clusterId, zoomLevel) => {
    const clusterGroup = d3.select(`#cluster-${clusterId}`);
    if (!clusterGroup.node()) return [];

    // With absolute positioning, all hexagons are visible
    return clusterGroup.selectAll(".hexagon-group").nodes();
};

// Calculate center of mass for a set of hexagons
export const calculateHexagonsCenter = (hexagons) => {
    if (!hexagons || hexagons.length === 0) return { x: 0, y: 0 };

    let sumX = 0, sumY = 0, count = 0;

    hexagons.forEach(hexNode => {
        const hexGroup = d3.select(hexNode);

        try {
            const transform = hexGroup.attr("transform");
            if (!transform) return; // Skip if transform is missing

            // Extract translate values from the transform attribute
            const translateMatch = /translate\(([^,]+),([^)]+)\)/.exec(transform);
            if (translateMatch && translateMatch.length >= 3) {
                const x = parseFloat(translateMatch[1]);
                const y = parseFloat(translateMatch[2]);

                // Only count if we got valid numbers
                if (!isNaN(x) && !isNaN(y)) {
                    sumX += x;
                    sumY += y;
                    count++;
                }
            }
        } catch (e) {
            console.error("Error processing hexagon:", e);
        }
    });

    // Guard against division by zero
    if (count > 0) {
        return {
            x: sumX / count,
            y: sumY / count
        };
    }

    return { x: 0, y: 0 };
};

// Function to determine the threshold for a zoom level
export const getZoomThreshold = (zoomLevel) => {
    if (zoomLevel <= 0.7) return "overview";
    if (zoomLevel < 2.2) return "intermediate";
    return "detail";
};

// Function to calculate optimal zoom transform for a cluster
export const calculateClusterZoomTransform = (clusterId, width, height) => {
    const clusterElement = document.getElementById(`cluster-${clusterId}`);
    if (!clusterElement) return null;

    const bounds = clusterElement.getBBox();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    const scale = 2.2;
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    return d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);
};

export default {
    shouldHexagonBeVisible,
    getVisibleHexagonsInCluster,
    calculateHexagonsCenter,
    getZoomThreshold,
    calculateClusterZoomTransform
};
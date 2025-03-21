import * as d3 from 'd3';

class ZoomHandler {
    constructor({
                    svg,
                    mainGroup,
                    setCurrentZoomLevel,
                    resetHexagonsAndConnections,
                    topLevelOutlineGroup
                }) {
        this.svg = svg;
        this.mainGroup = mainGroup;
        this.setCurrentZoomLevel = setCurrentZoomLevel;
        this.resetHexagonsAndConnections = resetHexagonsAndConnections;
        this.topLevelOutlineGroup = topLevelOutlineGroup;

        // Constants
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.discreteZoomLevels = [0.7, 1, 2.2, 4];

        // Initialize zoom behavior
        this.initializeZoom();
    }

    initializeZoom() {
        // Setup zoom behavior (ignoring wheel events so we can handle them discretely)
        this.zoom = d3.zoom()
            .filter((event) => event.type !== 'wheel')
            .scaleExtent([this.discreteZoomLevels[0], this.discreteZoomLevels[this.discreteZoomLevels.length - 1]])
            .on("zoom", (event) => this.handleZoom(event));

        // Initialize zoom
        this.svg.call(this.zoom);
        this.svg.call(this.zoom.transform, d3.zoomIdentity.scale(this.discreteZoomLevels[1]));

        // Handle discrete zooming with mouse wheel
        this.svg.on("wheel", (event) => this.handleWheel(event));
    }

    handleZoom(event) {
        this.mainGroup.attr("transform", event.transform);

        // Get previous zoom level for comparison
        const previousZoomLevel = this.currentZoomLevel || this.discreteZoomLevels[1];
        this.currentZoomLevel = event.transform.k;

        // Update the state
        this.setCurrentZoomLevel(event.transform.k);

        // Update hexagon visibility
        this.updateAbsoluteHexagonsVisibility(event.transform.k);

        // Manage outlines based on zoom level
        if (event.transform.k >= 2.2) {
            // Hide outlines when zoomed in past threshold
            this.topLevelOutlineGroup.attr("opacity", 0);
        } else if (previousZoomLevel !== event.transform.k) {
            // Clear any outlines when changing zoom levels (not just crossing 2.2)
            this.topLevelOutlineGroup.selectAll("*").remove();
            this.topLevelOutlineGroup.attr("opacity", 0);
        }

        // Reset all hexagon colors when zooming out from detail to overview
        if (previousZoomLevel >= 2.2 && event.transform.k < 2.2) {
            this.resetHexagonsAndConnections();
        }
    }

    handleWheel(event) {
        event.preventDefault();
        const currentTransform = d3.zoomTransform(this.svg.node());
        const currentScale = currentTransform.k;
        const direction = event.deltaY < 0 ? 1 : -1;

        // Find the nearest discrete zoom level
        let currentIndex = this.discreteZoomLevels.indexOf(currentScale);
        if (currentIndex === -1) {
            let nearest = this.discreteZoomLevels.reduce((prev, curr, index) =>
                    Math.abs(curr - currentScale) < Math.abs(prev.value - currentScale)
                        ? { value: curr, index }
                        : prev,
                { value: this.discreteZoomLevels[0], index: 0 }
            );
            currentIndex = nearest.index;
        }

        // Calculate new zoom level index
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= this.discreteZoomLevels.length) newIndex = this.discreteZoomLevels.length - 1;
        const newScale = this.discreteZoomLevels[newIndex];

        // Calculate new transform
        const center = [this.width / 2, this.height / 2];
        const newX = center[0] - newScale * ((center[0] - currentTransform.x) / currentScale);
        const newY = center[1] - newScale * ((center[1] - currentTransform.y) / currentScale);

        // Check if we're crossing the zoom threshold
        const crossingThresholdDown = currentScale >= 2.2 && newScale < 2.2;
        // Add check for transitions between any zoom levels
        const changingZoomLevel = currentScale !== newScale;

        // Transition to new zoom level
        this.svg.transition()
            .duration(300)
            .ease(d3.easeCubicInOut)
            .call(this.zoom.transform, d3.zoomIdentity.translate(newX, newY).scale(newScale))
            .on("start", () => {
                // Clear outlines when changing between any zoom levels
                if (changingZoomLevel) {
                    this.topLevelOutlineGroup.selectAll("*").remove();
                    this.topLevelOutlineGroup.attr("opacity", 0);
                }
            });

        // Update the zoom level state when changed via wheel
        this.setCurrentZoomLevel(newScale);
        this.currentZoomLevel = newScale;

        // Apply absolute hexagon visibility update
        this.updateAbsoluteHexagonsVisibility(newScale);

        // Hide outlines when zoomed in past threshold
        if (newScale >= 2.2) {
            this.topLevelOutlineGroup.attr("opacity", 0);
        }

        // Reset all hexagon colors when zooming out from detail to overview
        if (crossingThresholdDown) {
            this.resetHexagonsAndConnections();
        }
    }

    // Function to update visibility of absolutely positioned hexagons based on zoom level
    updateAbsoluteHexagonsVisibility(zoomLevel) {
        console.log(`Updating hexagon visibility for zoom level: ${zoomLevel}`);

        // Simple direct selection of all hexagons with circles (indicator dots)
        const circleHexagons = d3.selectAll(".hexagon-group").filter(function() {
            return d3.select(this).select("circle").size() > 0;
        });

        console.log(`Found ${circleHexagons.size()} absolutely positioned hexagons with circles`);

        // Set visibility based on zoom level
        circleHexagons.each(function() {
            const hexGroup = d3.select(this);

            // Simply hide at 0.7x zoom, show at other levels
            if (zoomLevel <= 0.7) {
                hexGroup.style("opacity", 0);
                console.log(`Hiding hexagon ${hexGroup.attr("id")}`);
            } else {
                hexGroup.style("opacity", 1);
            }
        });

        // After updating hexagon visibility, update cluster label positions
        this.updateClusterLabelPositions(zoomLevel);
    }

    // Function to update cluster label positions based on zoom level
    updateClusterLabelPositions(zoomLevel) {
        const entityData = window.entityData || {}; // Access data from window to avoid parameter passing
        if (!entityData.clusters) return;

        console.log(`Updating cluster label positions for zoom level: ${zoomLevel}`);

        entityData.clusters.forEach(cluster => {
            const clusterGroup = d3.select(`#cluster-${cluster.id}`);
            if (!clusterGroup.node()) return; // Skip if cluster doesn't exist in DOM

            // Get the cluster label element
            const clusterLabel = clusterGroup.select("text.cluster-label");
            if (!clusterLabel.node()) {
                console.warn(`No label found for cluster ${cluster.id}`);
                return; // Skip if label doesn't exist
            }

            if (zoomLevel <= 0.7) {
                // At 0.7x zoom, center the label within the cluster mass
                // First, compute the centroid of all hexagons in this cluster
                const allHexGroups = clusterGroup.selectAll(".hexagon-group").nodes();
                if (allHexGroups.length === 0) return;

                // Calculate the center of mass for visible hexagons
                let sumX = 0, sumY = 0, count = 0;
                allHexGroups.forEach(hexNode => {
                    const hexGroup = d3.select(hexNode);

                    // Only include visible hexagons
                    if (hexGroup.style("opacity") !== "0") {
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
                    }
                });

                // Guard against division by zero
                if (count > 0) {
                    const centerX = sumX / count;
                    const centerY = sumY / count;

                    console.log(`Cluster ${cluster.id}: calculated center at (${centerX}, ${centerY}) from ${count} hexagons`);

                    // Store original position if not already stored
                    if (!clusterLabel.attr("data-original-x")) {
                        clusterLabel.attr("data-original-x", clusterLabel.attr("x"));
                        clusterLabel.attr("data-original-y", clusterLabel.attr("y"));
                        console.log(`Stored original position: (${clusterLabel.attr("x")}, ${clusterLabel.attr("y")})`);
                    }

                    // Move label to cluster center with transition
                    clusterLabel.transition()
                        .duration(300)
                        .attr("x", centerX)
                        .attr("y", centerY + 6) // Move 6px lower than center
                        .attr("font-size", "18px") // Make labels bigger
                        .attr("font-weight", "bold");

                    // Ensure labels are always on top by moving them to the end of their parent
                    const labelParent = clusterLabel.node().parentNode;
                    labelParent.appendChild(clusterLabel.node());

                    console.log(`Moving label to (${centerX}, ${centerY})`);
                } else {
                    console.warn(`No visible hexagons found for cluster ${cluster.id}`);
                }
            } else {
                // At 1.0x zoom or higher, return to original position if stored
                const originalX = clusterLabel.attr("data-original-x");
                const originalY = clusterLabel.attr("data-original-y");

                if (originalX && originalY) {
                    console.log(`Returning label to original position: (${originalX}, ${originalY})`);
                    clusterLabel.transition()
                        .duration(300)
                        .attr("x", originalX)
                        .attr("y", originalY)
                        .attr("font-size", "14px") // Original size
                        .attr("font-weight", "bold");
                } else {
                    console.warn(`No original position found for cluster ${cluster.id}`);
                }
            }
        });
    }

    // Accessor for the zoom behavior
    getZoom() {
        return this.zoom;
    }
}

export default ZoomHandler;
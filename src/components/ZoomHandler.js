import * as d3 from 'd3';

class ZoomHandler {
    constructor({
                    svg,
                    mainGroup,
                    setCurrentZoomLevel,
                    resetHexagonsAndConnections,
                    topLevelOutlineGroup,
                    setHoveredCluster,
                    setContextMenu // Add setContextMenu here
                }) {
        this.svg = svg;
        this.mainGroup = mainGroup;
        this.setCurrentZoomLevel = setCurrentZoomLevel;
        this.resetHexagonsAndConnections = resetHexagonsAndConnections;
        this.topLevelOutlineGroup = topLevelOutlineGroup;
        this.setHoveredCluster = setHoveredCluster;
        this.setContextMenu = setContextMenu; // Store setContextMenu

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
        // Close context menu on pan/zoom
        if (this.setContextMenu) {
            this.setContextMenu(prev => ({ ...prev, show: false }));
        }

        this.mainGroup.attr("transform", event.transform);

        // Get previous zoom level for comparison
        const previousZoomLevel = this.currentZoomLevel || this.discreteZoomLevels[1];
        this.currentZoomLevel = event.transform.k;

        // Update the state
        this.setCurrentZoomLevel(event.transform.k);

        // Manage outlines based on zoom level
        if (event.transform.k >= 2.2) {
            // Hide outlines when zoomed in past threshold
            this.topLevelOutlineGroup.attr("opacity", 0);
        } else if (previousZoomLevel !== event.transform.k) {
            // Clear any outlines when changing zoom levels (not just crossing 2.2)
            this.topLevelOutlineGroup.selectAll("*").remove();
            this.topLevelOutlineGroup.attr("opacity", 0);
        }


        // Clear hovered cluster when changing zoom levels
        if (previousZoomLevel !== event.transform.k && this.setHoveredCluster) {
            this.setHoveredCluster(null);
        }
    }

    handleWheel(event) {
        // Close context menu on wheel zoom
        if (this.setContextMenu) {
            this.setContextMenu(prev => ({ ...prev, show: false }));
        }

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

        // Clear hovered cluster when changing zoom levels
        if (changingZoomLevel && this.setHoveredCluster) {
            this.setHoveredCluster(null);
        }

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

        // Hide outlines when zoomed in past threshold
        if (newScale >= 2.2) {
            this.topLevelOutlineGroup.attr("opacity", 0);
        }

    }

    // Accessor for the zoom behavior
    getZoom() {
        return this.zoom;
    }
}

export default ZoomHandler;

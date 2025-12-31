import * as d3 from 'd3';
import HexGrid from '../HexGrid';
import { getLighterColor } from '../connectionUtils';
import { getHexagonFillColor } from '../utils/colorUtils';

class HexGridRenderer {
    constructor({
                    svg,
                    mainGroup,
                    entityData,
                    setCollisionsDetected,
                    setHoveredApp,
                    setAppConnections,
                    zoomRef,
                    connectionsGroupRef,
                    appCoordinatesRef,
                    topLevelOutlineGroup,
                    timeoutIds,
                    currentZoomLevel,
                    setSelectedCluster,
                    tooltipManager,
                    setHoveredCluster,
                    setContextMenu,
                    colorMode
                }) {
        this.svg = svg;
        this.mainGroup = mainGroup;
        this.entityData = entityData;
        this.setCollisionsDetected = setCollisionsDetected;
        this.setHoveredApp = setHoveredApp;
        this.setAppConnections = setAppConnections;
        this.zoomRef = zoomRef;
        this.connectionsGroupRef = connectionsGroupRef;
        this.appCoordinatesRef = appCoordinatesRef;
        this.topLevelOutlineGroup = topLevelOutlineGroup;
        this.timeoutIds = timeoutIds;
        this.currentZoomLevel = currentZoomLevel;
        this.setSelectedCluster = setSelectedCluster;
        this.tooltipManager = tooltipManager;
        this.setHoveredCluster = setHoveredCluster;
        this.setContextMenu = setContextMenu;
        this.colorMode = colorMode;

        // Constants
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Store label positions for collision detection
        this.labelPositions = [];

        // Make entityData available globally for debugging
        window.entityData = entityData;

        // Initialize
        this.render();
    }

    /**
     * Check if two bounding boxes overlap
     */
    boxesOverlap(box1, box2) {
        return !(box1.right < box2.left ||
                 box1.left > box2.right ||
                 box1.bottom < box2.top ||
                 box1.top > box2.bottom);
    }

    /**
     * Calculate label bounding box given position and estimated dimensions
     */
    getLabelBoundingBox(x, y, text, fontSize = 14) {
        // Estimate label width based on text length (approx 8px per character for bold 14px font)
        const charWidth = fontSize * 0.6;
        const width = text.length * charWidth;
        const height = fontSize * 1.2;

        return {
            left: x - width / 2,
            right: x + width / 2,
            top: y - height,
            bottom: y,
            x: x,
            y: y,
            width: width,
            height: height
        };
    }

    /**
     * Find the best white space position for a label around a cluster
     */
    findWhiteSpacePosition(clusterHexPositions, clusterCenter, text, existingLabels, hexSize) {
        // Calculate bounding box of the cluster's hexagons
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        clusterHexPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        // Add padding for hex size
        const padding = hexSize * 1.5;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        const clusterWidth = maxX - minX;
        const clusterHeight = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Label offset from cluster edge (tight to cluster)
        const labelOffset = 8;

        // Candidate positions in priority order (prefer top and sides over bottom)
        const candidates = [
            // Top center (preferred)
            { x: centerX, y: minY - labelOffset, priority: 1 },
            // Top left
            { x: minX, y: minY - labelOffset, priority: 2 },
            // Top right
            { x: maxX, y: minY - labelOffset, priority: 2 },
            // Left side (middle)
            { x: minX - labelOffset - 30, y: centerY, priority: 3 },
            // Right side (middle)
            { x: maxX + labelOffset + 30, y: centerY, priority: 3 },
            // Bottom center
            { x: centerX, y: maxY + labelOffset + 12, priority: 4 },
            // Bottom left
            { x: minX, y: maxY + labelOffset + 12, priority: 5 },
            // Bottom right
            { x: maxX, y: maxY + labelOffset + 12, priority: 5 },
        ];

        // Function to check if position overlaps with any hexagon
        const overlapsHexagons = (labelBox) => {
            for (const hexPos of clusterHexPositions) {
                const hexBox = {
                    left: hexPos.x - hexSize,
                    right: hexPos.x + hexSize,
                    top: hexPos.y - hexSize,
                    bottom: hexPos.y + hexSize
                };
                if (this.boxesOverlap(labelBox, hexBox)) {
                    return true;
                }
            }
            return false;
        };

        // Function to check if position overlaps with other clusters' hexagons
        const overlapsOtherClusters = (labelBox) => {
            if (!this.allHexPositions) return false;
            for (const hexPos of this.allHexPositions) {
                const hexBox = {
                    left: hexPos.x - hexSize,
                    right: hexPos.x + hexSize,
                    top: hexPos.y - hexSize,
                    bottom: hexPos.y + hexSize
                };
                if (this.boxesOverlap(labelBox, hexBox)) {
                    return true;
                }
            }
            return false;
        };

        // Find the best position
        for (const candidate of candidates) {
            const labelBox = this.getLabelBoundingBox(candidate.x, candidate.y, text);

            // Check if overlaps with this cluster's hexagons
            if (overlapsHexagons(labelBox)) {
                continue;
            }

            // Check if overlaps with other clusters' hexagons
            if (overlapsOtherClusters(labelBox)) {
                continue;
            }

            // Check if overlaps with existing labels
            const overlapsLabels = existingLabels.some(existing =>
                this.boxesOverlap(labelBox, existing.box)
            );
            if (overlapsLabels) {
                continue;
            }

            // Found a good position
            return { x: candidate.x, y: candidate.y, box: labelBox };
        }

        // Fallback: use top center even if it overlaps (will be rendered on top anyway)
        const fallbackX = centerX;
        const fallbackY = minY - labelOffset;
        const fallbackBox = this.getLabelBoundingBox(fallbackX, fallbackY, text);

        return { x: fallbackX, y: fallbackY, box: fallbackBox };
    }

    /**
     * Find a non-overlapping position for a label (legacy method, kept for compatibility)
     */
    findNonOverlappingPosition(x, y, text, existingPositions) {
        const box = this.getLabelBoundingBox(x, y, text);

        // Check if current position overlaps with any existing label
        let hasOverlap = existingPositions.some(existing => this.boxesOverlap(box, existing.box));

        if (!hasOverlap) {
            return { x, y, box };
        }

        // Try different offset strategies to find non-overlapping position
        // Prioritize horizontal offsets since vertical stacking is common
        const offsets = [
            { dx: -80, dy: 0 },    // Move left
            { dx: 80, dy: 0 },     // Move right
            { dx: -100, dy: -8 },  // Move left-up
            { dx: 100, dy: -8 },   // Move right-up
            { dx: -100, dy: 8 },   // Move left-down
            { dx: 100, dy: 8 },    // Move right-down
            { dx: -130, dy: 0 },   // Move further left
            { dx: 130, dy: 0 },    // Move further right
            { dx: 0, dy: -30 },    // Move up (last resort)
            { dx: 0, dy: 30 },     // Move down (last resort)
        ];

        for (const offset of offsets) {
            const newX = x + offset.dx;
            const newY = y + offset.dy;
            const newBox = this.getLabelBoundingBox(newX, newY, text);

            const stillOverlaps = existingPositions.some(existing =>
                this.boxesOverlap(newBox, existing.box)
            );

            if (!stillOverlaps) {
                return { x: newX, y: newY, box: newBox };
            }
        }

        // If all offsets fail, return original position (shouldn't happen often)
        console.warn(`Could not find non-overlapping position for label: ${text}`);
        return { x, y, box };
    }

    render() {
        // Debug log to check if data is loaded correctly
        console.log("Loading data:", this.entityData.clusters.length, "clusters");

        // Calculate hexSize so that hexagon width is exactly 22px (width = size * sqrt(3))
        const hexSize = 22 / Math.sqrt(3);
        const hexGrid = new HexGrid(hexSize, this.width, this.height);

        // Initialize an object to track occupied positions
        const occupiedPositions = {};
        const collisions = [];

        // Store label data to render them all at the end (on top of hexagons)
        const labelsToRender = [];

        // Store hexagons with red borders to re-render on top
        const redBorderHexagons = [];

        // Create a map to store app ID to coordinates mapping
        const appCoordinates = {};

        // First pass: add cluster IDs and names to all applications for tracking
        this.entityData.clusters.forEach(cluster => {
            cluster.applications.forEach(app => {
                app.clusterId = cluster.id;
                app.clusterName = cluster.name;
                // Add cluster color to app for connection rendering
                app.color = cluster.color;
            });
        });

        // Store references to each cluster's hexagons for hover effects
        const clusterHexagons = {};

        // First pass: calculate all hex coordinates to know all positions for label placement
        const clusterHexCoords = {};
        this.allHexPositions = []; // Store all hex positions for label collision detection

        this.entityData.clusters.forEach(cluster => {
            const hexCoords = hexGrid.generateHexCoords(
                cluster.applications.length,
                cluster.gridPosition.q,
                cluster.gridPosition.r,
                cluster.applications,
                occupiedPositions
            );
            clusterHexCoords[cluster.id] = hexCoords;

            // Add to global list for label collision detection
            hexCoords.forEach(coord => {
                this.allHexPositions.push({ x: coord.x, y: coord.y, clusterId: cluster.id });
            });
        });

        // Draw clusters and hexagons
        this.entityData.clusters.forEach(cluster => {
            console.log(`Processing cluster ${cluster.id} with ${cluster.applications.length} apps`);

            // Check if apps have grid positions
            const appsWithPosition = cluster.applications.filter(app => app.gridPosition);
            const appsWithoutPosition = cluster.applications.filter(app => !app.gridPosition);

            if (appsWithoutPosition.length > 0) {
                console.warn(`Cluster ${cluster.id} has ${appsWithoutPosition.length} apps without positions:`,
                    appsWithoutPosition.map(app => app.name || app.id).join(', '));
            }

            console.log(`Cluster ${cluster.id} has ${appsWithPosition.length} apps with absolute positions`);

            const clusterGroup = this.mainGroup.append("g")
                .attr("class", "cluster")
                .attr("id", `cluster-${cluster.id}`)
                .style("cursor", "pointer");

            // Create an array to store this cluster's hexagon elements
            clusterHexagons[cluster.id] = [];

            // Get pre-calculated hex coordinates for this cluster
            const hexCoords = clusterHexCoords[cluster.id];

            // Calculate cluster center from hex positions
            const clusterCenter = {
                x: hexCoords.reduce((sum, c) => sum + c.x, 0) / hexCoords.length,
                y: hexCoords.reduce((sum, c) => sum + c.y, 0) / hexCoords.length
            };

            // Find best white space position for label
            const labelPos = this.findWhiteSpacePosition(
                hexCoords,
                clusterCenter,
                cluster.name,
                this.labelPositions,
                hexSize
            );

            // Store the label position for future collision checks
            this.labelPositions.push({
                clusterId: cluster.id,
                box: labelPos.box,
                text: cluster.name
            });

            // Store label data to render later (on top of all hexagons)
            labelsToRender.push({
                x: labelPos.x,
                y: labelPos.y,
                text: cluster.name
            });

            console.log(`Generated ${hexCoords.length} hex coordinates for cluster ${cluster.id}`);

            // Store reference to cluster and hexagons for hover effects
            const clusterData = { hexCoords, cluster, hexSize, hexGroups: [] };
            clusterGroup.datum(clusterData);

            hexCoords.forEach((coord, index) => {
                this.createHexagon({
                    clusterGroup,
                    coord,
                    index,
                    cluster,
                    hexGrid,
                    hexSize,
                    clusterData,
                    clusterHexagons,
                    appCoordinates,
                    collisions,
                    redBorderHexagons
                });
            });

            this.setupClusterInteractions({
                clusterGroup,
                cluster
            });
        });

        // Save app coordinates for later use
        this.appCoordinatesRef.current = appCoordinates;

        // Render red borders on top of all hexagons (so they're not covered by adjacent hexes)
        if (redBorderHexagons.length > 0) {
            const redBordersGroup = this.mainGroup.append("g")
                .attr("class", "red-borders-group");

            redBorderHexagons.forEach(hex => {
                redBordersGroup.append("path")
                    .attr("transform", `translate(${hex.x},${hex.y})`)
                    .attr("d", hex.hexPath)
                    .attr("fill", "none")
                    .attr("stroke", "#ff0000")
                    .attr("stroke-width", 2)
                    .attr("pointer-events", "none");
            });
        }

        // Render all labels in a separate group ON TOP of hexagons
        const labelsGroup = this.mainGroup.append("g")
            .attr("class", "cluster-labels-group");

        labelsToRender.forEach(label => {
            labelsGroup.append("text")
                .attr("x", label.x)
                .attr("y", label.y)
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("pointer-events", "none")
                .attr("class", "cluster-label")
                .text(label.text);
        });

        // Update the collisions list after all clusters are processed
        if (collisions.length > 0) {
            this.setCollisionsDetected(collisions);
            console.warn(`Found ${collisions.length} collisions in hexagon grid positions`);
        }
    }

    createHexagon({
                      clusterGroup,
                      coord,
                      index,
                      cluster,
                      hexGrid,
                      hexSize,
                      clusterData,
                      clusterHexagons,
                      appCoordinates,
                      collisions,
                      redBorderHexagons
                  }) {
        const hexGroup = clusterGroup.append("g")
            .attr("transform", `translate(${coord.x},${coord.y})`)
            .attr("class", "hexagon-group")
            .attr("id", coord.app ? `hex-${coord.app.id}` : `hex-${cluster.id}-${index}`)
            .style("cursor", "pointer");

        // Store reference to hex group in cluster data
        clusterData.hexGroups.push(hexGroup);

        // Draw the hexagon - use white stroke for all, red borders will be added on top later
        const hexPath = hexGroup.append("path")
            .attr("d", hexGrid.hexagonPath(hexSize))
            .attr("fill", getHexagonFillColor({...coord, cluster}, this.colorMode))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("class", "hexagon");

        // Track hexagons with collisions to render red borders on top later
        if (coord.hasCollision) {
            redBorderHexagons.push({
                x: coord.x,
                y: coord.y,
                hexPath: hexGrid.hexagonPath(hexSize)
            });
        }

        // Store reference to this hexagon
        clusterHexagons[cluster.id].push(hexPath);

        // Store app coordinates for connection drawing if this hex represents an app
        if (coord.app) {
            appCoordinates[coord.app.id] = {
                x: coord.x,
                y: coord.y,
                app: {
                    ...coord.app,
                    // Store cluster information with the app
                    clusterId: cluster.id,
                    clusterName: cluster.name,
                    color: cluster.color
                }
            };
        }

        // Add a small indicator dot only if showPositionIndicator is true for this app
        // Or if there's a collision (always show indicator for collisions)
        if ((coord.app && coord.app.showPositionIndicator === true) || coord.hasCollision) {
            hexGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 3)
                .attr("fill", coord.hasCollision ? "#ff0000" : "#fff");
        }

        // Add the absolute-positioned class to all hexagons
        hexGroup.classed("absolute-positioned", true);

        // If there's a collision, add it to our list with complete info
        if (coord.hasCollision && coord.app.collidesWith) {
            collisions.push({
                app: coord.app.name,
                cluster: cluster.name,
                position: `(${coord.app.gridPosition.q}, ${coord.app.gridPosition.r})`,
                collidesWithApp: coord.app.collidesWith.name,
                collidesWithCluster: coord.app.collidesWith.clusterName
            });
        }

        this.setupHexagonInteractions({
            hexGroup,
            cluster,
            coord,
            appCoordinates
        });
    }

    setupHexagonInteractions({
                                 hexGroup,
                                 cluster,
                                 coord,
                                 appCoordinates
                             }) {
        // Store the original color for highlighting
        const originalColor = cluster.color;
        // Calculate a lighter version of the color for hover effect
        const lighterColor = getLighterColor(originalColor);

        // Add hover effects for individual hexagons (only active when zoomed in)
        hexGroup
            .on("mouseover", (event) => {
                const currentZoom = d3.zoomTransform(this.svg.node()).k;
                // Only apply individual hexagon highlights at higher zoom levels
                if (currentZoom >= 2.2) {
                    d3.select(event.currentTarget).select("path")
                        .attr("fill", lighterColor); // Use lighter color instead of opacity

                    // Show tooltip for the hexagon
                    if (coord.app) {
                        this.tooltipManager.show(coord.app.name, event);

                        // Set the hovered app for info display
                        this.setHoveredApp({
                            ...coord.app,
                            clusterName: cluster.name,
                            clusterColor: cluster.color
                        });

                        // Show connections if the app has any
                        if (coord.app.connections && coord.app.connections.length > 0) {
                            // Find all connections for this app
                            const connections = [];
                            coord.app.connections.forEach(connection => {
                                if (appCoordinates[connection.to]) {
                                    const targetData = appCoordinates[connection.to];
                                    connections.push({
                                        source: {
                                            x: coord.x,
                                            y: coord.y,
                                            id: coord.app.id,
                                            color: cluster.color,
                                            name: coord.app.name
                                        },
                                        target: {
                                            x: targetData.x,
                                            y: targetData.y,
                                            id: connection.to,
                                            color: targetData.app.color,
                                            name: targetData.app.name
                                        },
                                        type: connection.type,
                                        strength: connection.strength
                                    });
                                }
                            });

                            // Show connections on the map
                            this.setAppConnections(connections);

                            // Show tooltips on the connected hexagons
                            if (this.tooltipManager) {
                                this.tooltipManager.showConnectionTooltips(connections, this.appCoordinatesRef);
                            }
                        } else {
                            // Clear connections if this app has none
                            this.setAppConnections([]);
                        }
                    } else {
                        // Show tooltip for non-app hexagons
                        this.tooltipManager.show(`${cluster.name} Cluster`, event);

                        // No app associated with this hexagon, clear any connections
                        this.setAppConnections([]);
                    }
                }
            })
            .on("mousemove", (event) => {
                const currentZoom = d3.zoomTransform(this.svg.node()).k;
                // Update tooltip position on mouse move
                if (currentZoom >= 2.2) {
                    if (coord.app) {
                        this.tooltipManager.show(coord.app.name, event);
                    } else {
                        this.tooltipManager.show(`${cluster.name} Cluster`, event);
                    }
                }
            })
            .on("mouseout", (event) => {
                const currentZoom = d3.zoomTransform(this.svg.node()).k;
                if (currentZoom >= 2.2) {
                    d3.select(event.currentTarget).select("path")
                        .attr("fill", getHexagonFillColor({...coord, cluster}, this.colorMode));

                    // Hide tooltip
                    this.tooltipManager.hide();

                    // Hide connection tooltips
                    if (this.tooltipManager) {
                        this.tooltipManager.hideAllConnectionTooltips();
                    }

                    // Forcefully and immediately clear all connections and related state
                    this.setHoveredApp(null);
                    this.setAppConnections([]);

                    // Directly clear the connections group
                    if (this.connectionsGroupRef.current) {
                        this.connectionsGroupRef.current.selectAll("*").remove();
                    }

                    // Clear any pending timeouts
                    this.timeoutIds.current.forEach(id => clearTimeout(id));
                    this.timeoutIds.current.length = 0;
                }
            })
            .on("contextmenu", (event) => {
                event.preventDefault();
                const currentZoom = d3.zoomTransform(this.svg.node()).k;
                
                // Only show context menu at zoom levels 2.2 and 4
                if (currentZoom === 2.2 || currentZoom === 4) {
                    // Use clientX/clientY for viewport-relative coordinates
                    this.setContextMenu({
                        show: true,
                        x: event.clientX, 
                        y: event.clientY,
                        items: [
                            {
                                label: "Action 1",
                                action: () => console.log("Action 1 clicked", coord.app || cluster)
                            },
                            {
                                label: "Action 2", 
                                action: () => console.log("Action 2 clicked", coord.app || cluster)
                            },
                            {
                                label: "Follow Link",
                                action: () => window.open(coord.app?.link || '#', '_blank')
                            }
                        ]
                    });
                }
            });
    }

    setupClusterInteractions({
                                 clusterGroup,
                                 cluster
                             }) {
        // Create local reference to hexagonPath function
        const hexagonPath = (size) => {
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 2 + i * (Math.PI / 3);
                points.push([size * Math.cos(angle), size * Math.sin(angle)]);
            }
            return d3.line()(points) + "Z";
        };

        clusterGroup
            .on("mouseover", (event) => {
                const currentZoom = d3.zoomTransform(this.svg.node()).k;
                // Only show cluster outlines at lower zoom levels
                if (currentZoom < 2.2) {
                    // Get the stored hexagon coordinates
                    const data = d3.select(event.currentTarget).datum();

                    // Clear any existing outlines with the same cluster ID
                    const clusterId = cluster.id;
                    this.topLevelOutlineGroup.selectAll(`*:not([data-cluster-id="${clusterId}"])`).remove();

                    // Only create outlines if they don't already exist for this cluster
                    if (this.topLevelOutlineGroup.selectAll(`[data-cluster-id="${clusterId}"]`).empty()) {
                        // Create outlines in the top-level group - for all hexagons since all are visible now
                        data.hexCoords.forEach(coord => {
                            this.topLevelOutlineGroup.append("path")
                                .attr("transform", `translate(${coord.x},${coord.y})`)
                                .attr("d", hexagonPath(data.hexSize + 2))
                                .attr("fill", "none")
                                .attr("stroke", "#000000")
                                .attr("stroke-width", 2)
                                .attr("data-cluster-id", clusterId);
                        });
                    }

                    // Show the top-level outlines immediately without transition
                    this.topLevelOutlineGroup.attr("opacity", 1);

                    // Update the hoveredCluster state
                    this.setHoveredCluster(cluster);
                }
            })
            .on("mouseout", (event) => {
                const currentZoom = d3.zoomTransform(this.svg.node()).k;
                if (currentZoom < 2.2) {
                    // Check if we're moving to another element within the same cluster
                    const relatedTarget = event.relatedTarget;
                    const currentClusterId = cluster.id;

                    // Only remove outlines if moving outside this cluster
                    if (!relatedTarget || !relatedTarget.closest(`#cluster-${currentClusterId}`)) {
                        // With a small delay to prevent flickering during mouseover events between clusters
                        const clusterId = cluster.id;

                        this.timeoutIds.current.push(
                            setTimeout(() => {
                                // Check if mouse is still outside this cluster
                                if (!document.querySelector(`#cluster-${clusterId}:hover`)) {
                                    this.topLevelOutlineGroup.selectAll(`[data-cluster-id="${clusterId}"]`)
                                        .transition()
                                        .duration(100)
                                        .attr("opacity", 0)
                                        .on("end", function() {
                                            // Remove only this cluster's outlines
                                            d3.select(this).remove();
                                        });

                                    // Clear the hovered cluster state
                                    this.setHoveredCluster(null);
                                }
                            }, 50)
                        );
                    }
                }
            })
            .on("click", (event) => {
                // Important: Stop propagation to prevent the background click handler from firing
                event.stopPropagation();

                console.log("Cluster click detected:", cluster.id);

                // Call the handler function with the cluster data
                this.handleClusterClick(cluster);
            });
    }

    handleClusterClick(cluster) {
        console.log("handleClusterClick called for cluster:", cluster.id);
        this.setSelectedCluster(cluster);

        const clusterElement = document.getElementById(`cluster-${cluster.id}`);
        if (clusterElement) {
            const bounds = clusterElement.getBBox();
            const x = bounds.x + bounds.width / 2;
            const y = bounds.y + bounds.height / 2;
            const scale = 2.2;
            const translate = [this.width / 2 - scale * x, this.height / 2 - scale * y];

            console.log("Zooming to:", {x, y, scale, translate});

            this.svg.transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
                .call(this.zoomRef.current.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        } else {
            console.error(`Could not find element for cluster ${cluster.id}`);
        }
    }
}

export default HexGridRenderer;

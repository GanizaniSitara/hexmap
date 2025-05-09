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

        // Make entityData available globally for debugging
        window.entityData = entityData;

        // Initialize
        this.render();
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

            // Calculate cluster label position based on grid coordinates
            const clusterLabelPos = hexGrid.gridToPixel(
                cluster.gridPosition.q,
                cluster.gridPosition.r
            );

            // Add cluster label
            clusterGroup.append("text")
                .attr("x", clusterLabelPos.x - hexSize / 2)
                .attr("y", clusterLabelPos.y - hexSize * 1.2)
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("pointer-events", "none")
                .attr("class", "cluster-label")
                .text(cluster.name);

            const hexCoords = hexGrid.generateHexCoords(
                cluster.applications.length, // Use actual app count instead of hexCount
                cluster.gridPosition.q,
                cluster.gridPosition.r,
                cluster.applications,
                occupiedPositions
            );

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
                    collisions
                });
            });

            this.setupClusterInteractions({
                clusterGroup,
                cluster
            });
        });

        // Save app coordinates for later use
        this.appCoordinatesRef.current = appCoordinates;

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
                      collisions
                  }) {
        const hexGroup = clusterGroup.append("g")
            .attr("transform", `translate(${coord.x},${coord.y})`)
            .attr("class", "hexagon-group")
            .attr("id", coord.app ? `hex-${coord.app.id}` : `hex-${cluster.id}-${index}`)
            .style("cursor", "pointer");

        // Store reference to hex group in cluster data
        clusterData.hexGroups.push(hexGroup);

        // Draw the hexagon with a stroke if there's a collision
        const hexPath = hexGroup.append("path")
            .attr("d", hexGrid.hexagonPath(hexSize))
            .attr("fill", getHexagonFillColor({...coord, cluster}, this.colorMode))
            .attr("stroke", coord.hasCollision ? "#ff0000" : "#fff")
            .attr("stroke-width", coord.hasCollision ? 2 : 1)
            .attr("class", "hexagon");

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

        // Add a small indicator dot only if showMarker is true for this app
        // Or if there's a collision (always show indicator for collisions)
        if ((coord.app && coord.app.showMarker === true) || coord.hasCollision) {
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
                console.log(`Mouseover hex: ${coord.app?.name || 'Cluster hex'}, Zoom: ${currentZoom}`); // Log zoom level
                // Only apply individual hexagon highlights at higher zoom levels
                if (currentZoom >= 2.2) {
                    console.log("Zoom level sufficient, attempting to show tooltip."); // Log attempt
                    d3.select(event.currentTarget).select("path")
                        .attr("fill", lighterColor); // Use lighter color instead of opacity

                    // Show tooltip for the hexagon
                    if (coord.app) {
                        console.log(`Showing tooltip for app: ${coord.app.name}`); // Log app tooltip show
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
                        console.log(`Showing tooltip for cluster: ${cluster.name}`); // Log cluster tooltip show
                        this.tooltipManager.show(`${cluster.name} Cluster`, event);

                        // No app associated with this hexagon, clear any connections
                        this.setAppConnections([]);
                    }
                } else {
                    console.log("Zoom level insufficient for tooltip."); // Log insufficient zoom
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

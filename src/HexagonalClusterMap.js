import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
// Directly import our updated JSON with positioned apps
import enterpriseData from './enterpriseData.json';

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

const HexMap = () => {
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [collisionsDetected, setCollisionsDetected] = useState([]);
    const [currentZoomLevel, setCurrentZoomLevel] = useState(1);
    const [hoveredApp, setHoveredApp] = useState(null);
    const [appConnections, setAppConnections] = useState([]);
    // Array to store timeout IDs
    const timeoutIds = [];
    const svgRef = useRef(null);
    const zoomRef = useRef(null);
    const connectionsGroupRef = useRef(null);

    // Create a ref to store app coordinates for drawing connections
    const appCoordinatesRef = useRef({});

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Use the full browser window dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;
        const discreteLevels = [1, 2.2, 4];

        // Initialize with first zoom level
        setCurrentZoomLevel(discreteLevels[0]);

        // Calculate hexSize so that hexagon width is exactly 22px (width = size * sqrt(3))
        const hexSize = 22 / Math.sqrt(3);
        const hexGrid = new HexGrid(hexSize, width, height);

        const g = svg.append("g");

        // Function to reset all hexagons to their original colors and clear connections
        const resetHexagonsAndConnections = () => {
            enterpriseData.clusters.forEach(cluster => {
                d3.select(`#cluster-${cluster.id}`)
                    .selectAll("path.hexagon")
                    .attr("fill", cluster.color);
            });

            // Clear hovered app
            setHoveredApp(null);

            // Clear connections
            setAppConnections([]);

            // Immediately clear the connections group
            if (connectionsGroupRef.current) {
                connectionsGroupRef.current.selectAll("*").remove();
            }

            // Clear any pending timeouts
            timeoutIds.forEach(id => clearTimeout(id));
            timeoutIds.length = 0;
        };

        // Background rectangle covering a bit more than the full view to allow panning
        g.append("rect")
            .attr("width", width * 2)
            .attr("height", height * 2)
            .attr("x", -width / 2)
            .attr("y", -height / 2)
            .attr("fill", "transparent")
            .style("cursor", "default")
            .on("click", (event) => {
                if (event.target.tagName === "rect") {
                    setSelectedCluster(null);
                    svg.transition()
                        .duration(1000)
                        .ease(d3.easeCubicOut)
                        .call(zoomRef.current.transform, d3.zoomIdentity.scale(discreteLevels[0]));
                }
            });

        // Setup zoom behavior (ignoring wheel events so we can handle them discretely)
        const zoom = d3.zoom()
            .filter((event) => event.type !== 'wheel')
            .scaleExtent([discreteLevels[0], discreteLevels[discreteLevels.length - 1]])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                // Update the current zoom level state
                const previousZoomLevel = currentZoomLevel;
                setCurrentZoomLevel(event.transform.k);

                // Hide outlines when zoomed in past threshold
                if (event.transform.k >= 2.2) {
                    topLevelOutlineGroup.attr("opacity", 0);
                }

                // Reset all hexagon colors when zooming out from detail to overview
                if (previousZoomLevel >= 2.2 && event.transform.k < 2.2) {
                    resetHexagonsAndConnections();
                }
            });
        zoomRef.current = zoom;
        svg.call(zoom);
        svg.call(zoom.transform, d3.zoomIdentity.scale(discreteLevels[0]));

        // Custom discrete zoom on wheel events
        svg.on("wheel", (event) => {
            event.preventDefault();
            const currentTransform = d3.zoomTransform(svg.node());
            const currentScale = currentTransform.k;
            const direction = event.deltaY < 0 ? 1 : -1;
            let currentIndex = discreteLevels.indexOf(currentScale);
            if (currentIndex === -1) {
                let nearest = discreteLevels.reduce((prev, curr, index) =>
                        Math.abs(curr - currentScale) < Math.abs(prev.value - currentScale)
                            ? { value: curr, index }
                            : prev,
                    { value: discreteLevels[0], index: 0 }
                );
                currentIndex = nearest.index;
            }
            let newIndex = currentIndex + direction;
            if (newIndex < 0) newIndex = 0;
            if (newIndex >= discreteLevels.length) newIndex = discreteLevels.length - 1;
            const newScale = discreteLevels[newIndex];
            const center = [width / 2, height / 2];
            const newX = center[0] - newScale * ((center[0] - currentTransform.x) / currentScale);
            const newY = center[1] - newScale * ((center[1] - currentTransform.y) / currentScale);

            // Check if we're crossing the zoom threshold
            const crossingThresholdDown = currentScale >= 2.2 && newScale < 2.2;

            // Transition to new zoom level
            svg.transition()
                .duration(300)
                .ease(d3.easeCubicInOut)
                .call(zoom.transform, d3.zoomIdentity.translate(newX, newY).scale(newScale));

            // Update the zoom level state when changed via wheel
            setCurrentZoomLevel(newScale);

            // Hide outlines when zoomed in past threshold
            if (newScale >= 2.2) {
                topLevelOutlineGroup.attr("opacity", 0);
            }

            // Reset all hexagon colors when zooming out from detail to overview
            if (crossingThresholdDown) {
                resetHexagonsAndConnections();
            }
        });

        // Debug log to check if data is loaded correctly
        console.log("Loading data:", enterpriseData.clusters.length, "clusters");

        // Create a dedicated top-level group for outlines that will always be on top
        const topLevelOutlineGroup = g.append("g")
            .attr("class", "top-level-outlines")
            .attr("opacity", 0);

        // Initialize an object to track occupied positions
        const occupiedPositions = {};
        const collisions = [];

        // Create a map to store app ID to coordinates mapping
        const appCoordinates = {};

        // First pass: add cluster IDs and names to all applications for tracking
        enterpriseData.clusters.forEach(cluster => {
            cluster.applications.forEach(app => {
                app.clusterId = cluster.id;
                app.clusterName = cluster.name;
            });
        });

        // Store references to each cluster's hexagons for hover effects
        const clusterHexagons = {};

        // Draw clusters and hexagons
        enterpriseData.clusters.forEach(cluster => {
            console.log(`Processing cluster ${cluster.id} with ${cluster.applications.length} apps`);

            // Check if any apps have absolute positions
            const appsWithPosition = cluster.applications.filter(app => app.gridPosition);
            console.log(`Cluster ${cluster.id} has ${appsWithPosition.length} apps with absolute positions`);

            const clusterGroup = g.append("g")
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
                .attr("x", clusterLabelPos.x)
                .attr("y", clusterLabelPos.y - hexSize * 2)
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("pointer-events", "none")
                .text(cluster.name);

            const hexCoords = hexGrid.generateHexCoords(
                cluster.hexCount,
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
                    .attr("fill", cluster.color)
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
                        app: coord.app
                    };
                }

                // Add a small indicator dot for absolutely positioned hexagons
                if (coord.app && coord.app.gridPosition) {
                    hexGroup.append("circle")
                        .attr("cx", 0)
                        .attr("cy", 0)
                        .attr("r", 3)
                        .attr("fill", coord.hasCollision ? "#ff0000" : "#fff");

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
                }

                // Store the original color for highlighting
                const originalColor = cluster.color;
                // Calculate a lighter version of the color for hover effect
                const getLighterColor = (hexColor) => {
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
                const lighterColor = getLighterColor(originalColor);

                // Add hover effects for individual hexagons (only active when zoomed in)
                hexGroup
                    .on("mouseover", function(event) {
                        const currentZoom = d3.zoomTransform(svg.node()).k;
                        // Only apply individual hexagon highlights at higher zoom levels
                        if (currentZoom >= 2.2) {
                            d3.select(this).select("path")
                                .attr("fill", lighterColor); // Use lighter color instead of opacity

                            // Set the hovered app for info display
                            if (coord.app) {
                                setHoveredApp({
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
                                            connections.push({
                                                source: {
                                                    x: coord.x,
                                                    y: coord.y,
                                                    id: coord.app.id,
                                                    color: cluster.color
                                                },
                                                target: {
                                                    x: appCoordinates[connection.to].x,
                                                    y: appCoordinates[connection.to].y,
                                                    id: connection.to,
                                                    color: appCoordinates[connection.to].app.color
                                                },
                                                type: connection.type,
                                                strength: connection.strength
                                            });
                                        }
                                    });

                                    setAppConnections(connections);
                                } else {
                                    // Clear connections if this app has none
                                    setAppConnections([]);
                                }
                            } else {
                                // No app associated with this hexagon, clear any connections
                                setAppConnections([]);
                            }
                        }
                    })
                    .on("mouseout", function() {
                        const currentZoom = d3.zoomTransform(svg.node()).k;
                        if (currentZoom >= 2.2) {
                            d3.select(this).select("path")
                                .attr("fill", originalColor); // Return to original color

                            // Forcefully and immediately clear all connections and related state
                            setHoveredApp(null);
                            setAppConnections([]);

                            // Directly clear the connections group
                            if (connectionsGroupRef.current) {
                                connectionsGroupRef.current.selectAll("*").remove();
                            }

                            // Clear any pending timeouts
                            timeoutIds.forEach(id => clearTimeout(id));
                            timeoutIds.length = 0;
                        }
                    });
            });

            // Add mouse events for hover effect with different behavior based on zoom level
            clusterGroup
                .on("mouseover", function() {
                    const currentZoom = d3.zoomTransform(svg.node()).k;
                    // Only show cluster outlines at lower zoom levels
                    if (currentZoom < 2.2) {
                        // Get the stored hexagon coordinates
                        const data = d3.select(this).datum();

                        // Clear any existing outlines
                        topLevelOutlineGroup.selectAll("*").remove();

                        // Create outlines in the top-level group that always appears above everything else
                        data.hexCoords.forEach(coord => {
                            topLevelOutlineGroup.append("path")
                                .attr("transform", `translate(${coord.x},${coord.y})`)
                                .attr("d", hexGrid.hexagonPath(data.hexSize + 2))
                                .attr("fill", "none")
                                .attr("stroke", "#000000")
                                .attr("stroke-width", 2);
                        });

                        // Show the top-level outlines immediately without transition
                        topLevelOutlineGroup.attr("opacity", 1);
                    }
                })
                .on("mouseout", function() {
                    const currentZoom = d3.zoomTransform(svg.node()).k;
                    if (currentZoom < 2.2) {
                        // Hide the top-level outlines immediately without transition
                        topLevelOutlineGroup.attr("opacity", 0);
                    }
                })
                .on("click", (event) => {
                    event.stopPropagation();
                    handleClusterClick(cluster);
                });
        });

        // IMPORTANT: Create the connections group AFTER all other elements
        // This ensures connections will be drawn on top of the hexagons
        const connectionsGroup = g.append("g")
            .attr("class", "connections-group");
        connectionsGroupRef.current = connectionsGroup;

        // Save app coordinates for later use
        appCoordinatesRef.current = appCoordinates;

        // Update the collisions list after all clusters are processed
        if (collisions.length > 0) {
            setCollisionsDetected(collisions);
            console.warn(`Found ${collisions.length} collisions in hexagon grid positions`);
        }

        const handleClusterClick = (cluster) => {
            setSelectedCluster(cluster);
            const clusterElement = document.getElementById(`cluster-${cluster.id}`);
            if (clusterElement) {
                const bounds = clusterElement.getBBox();
                const x = bounds.x + bounds.width / 2;
                const y = bounds.y + bounds.height / 2;
                const scale = 2.2;
                const translate = [width / 2 - scale * x, height / 2 - scale * y];
                svg.transition()
                    .duration(1000)
                    .ease(d3.easeCubicInOut)
                    .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
            }
        };
    }, []);

    // Effect to draw connections when appConnections state changes
    useEffect(() => {
        // First, clear all existing connections
        if (connectionsGroupRef.current) {
            connectionsGroupRef.current.selectAll("*").remove();
        }

        // If there are no connections to draw, just return
        if (!connectionsGroupRef.current || appConnections.length === 0) return;

        // Force connections group to be the last child so it appears on top
        const parent = connectionsGroupRef.current.node().parentNode;
        parent.appendChild(connectionsGroupRef.current.node());

        // Set pointer-events to none for the entire connections group to ensure no mouse interactions
        connectionsGroupRef.current.attr("pointer-events", "none");

        // Define the custom connection path
        const generateConnectionPath = (source, target, type) => {
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
        const getConnectionStyles = (strength) => {
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

        // Draw each connection
        appConnections.forEach((connection, index) => {
            const { source, target, type, strength } = connection;
            const path = generateConnectionPath(source, target, type);
            const styles = getConnectionStyles(strength);

            // Create the gradient for the path (or use solid color if same cluster)
            const sameColorConnection = source.color === target.color;
            let connectionColor;
            let connectionPath;

            if (sameColorConnection) {
                // Use dark grey for connections between nodes of the same color
                connectionColor = "#444444"; // Dark grey

                // Draw the main path with solid color
                connectionPath = connectionsGroupRef.current.append("path")
                    .attr("d", path)
                    .attr("fill", "none")
                    .attr("stroke", connectionColor)
                    .attr("stroke-width", styles.strokeWidth)
                    .attr("stroke-dasharray", styles.dashArray)
                    .attr("opacity", 0)
                    .attr("pointer-events", "none"); // Prevent mouse events on connections

                // Animate the path
                connectionPath.transition()
                    .duration(600)
                    .attr("opacity", 0.7)
                    .attr("stroke-dashoffset", 0)
                    .ease(d3.easeQuadOut);
            } else {
                // Use gradient for connections between different colored nodes
                const gradientId = `connection-gradient-${index}`;
                connectionsGroupRef.current.append("defs")
                    .append("linearGradient")
                    .attr("id", gradientId)
                    .attr("gradientUnits", "userSpaceOnUse")
                    .attr("x1", source.x)
                    .attr("y1", source.y)
                    .attr("x2", target.x)
                    .attr("y2", target.y)
                    .selectAll("stop")
                    .data([
                        { offset: "10%", color: source.color },
                        { offset: "90%", color: target.color }
                    ])
                    .enter().append("stop")
                    .attr("offset", d => d.offset)
                    .attr("stop-color", d => d.color);

                // Draw the main path with gradient
                connectionPath = connectionsGroupRef.current.append("path")
                    .attr("d", path)
                    .attr("fill", "none")
                    .attr("stroke", `url(#${gradientId})`)
                    .attr("stroke-width", styles.strokeWidth)
                    .attr("stroke-dasharray", styles.dashArray)
                    .attr("opacity", 0)
                    .attr("pointer-events", "none"); // Prevent mouse events on connections

                // Animate the path
                connectionPath.transition()
                    .duration(600)
                    .attr("opacity", 0.7)
                    .attr("stroke-dashoffset", 0)
                    .ease(d3.easeQuadOut);
            }

            // Add animated projectile particle
            const projectile = connectionsGroupRef.current.append("circle")
                .attr("r", 4)
                .attr("fill", sameColorConnection ? "#666666" : source.color)
                .attr("opacity", 0)
                .attr("pointer-events", "none"); // Prevent mouse events on particles

            // Animate the projectile along the path
            const animateProjectile = () => {
                // Check if the connections group still exists and has content
                if (!connectionsGroupRef.current || !connectionPath.node()) {
                    return; // Exit if connections are gone
                }

                const totalLength = connectionPath.node().getTotalLength();

                projectile
                    .attr("opacity", 0)
                    .transition()
                    .duration(2000)
                    .ease(d3.easeQuadInOut)
                    .attrTween("transform", () => {
                        return (t) => {
                            // Additional safety check
                            if (!connectionPath.node()) return "translate(0,0)";
                            const p = connectionPath.node().getPointAtLength(t * totalLength);
                            return `translate(${p.x},${p.y})`;
                        };
                    })
                    .attr("opacity", 1)
                    .transition()
                    .duration(300)
                    .attr("opacity", 0)
                    .on("end", () => {
                        // Only continue if the DOM elements still exist
                        if (connectionsGroupRef.current &&
                            connectionPath.node() &&
                            document.body.contains(connectionPath.node())) {
                            animateProjectile();
                        }
                    });
            };

            // Start the animation after a short delay
            const timeoutId = setTimeout(animateProjectile, index * 300);

            // Store timeout ID for cleanup
            timeoutIds.push(timeoutId);
        });
    }, [appConnections]);

    const renderCollisionNotification = () => {
        if (collisionsDetected.length === 0) return null;

        return (
            <div style={{
                position: 'fixed',
                top: '16px',
                left: '16px',
                backgroundColor: '#FEF2F2',
                borderLeft: '4px solid #EF4444',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: '4px',
                padding: '12px',
                maxWidth: '400px',
                zIndex: 1000
            }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px', color: '#B91C1C' }}>
                    ⚠️ {collisionsDetected.length} position collision{collisionsDetected.length > 1 ? 's' : ''} detected
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {collisionsDetected.map((collision, idx) => (
                        <div key={idx} style={{
                            fontSize: '12px',
                            borderBottom: '1px solid #FECACA',
                            paddingBottom: '6px',
                            marginBottom: '6px'
                        }}>
                            <strong style={{ color: '#7F1D1D' }}>{collision.app}</strong>
                            <div style={{ fontSize: '11px' }}>
                                Cluster: {collision.cluster} | Position: {collision.position}
                            </div>
                            <div style={{ fontSize: '11px', color: '#DC2626' }}>
                                Collides with: {collision.collidesWithApp} ({collision.collidesWithCluster})
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderDetailPanel = () => {
        if (!selectedCluster) return null;
        return (
            <div className="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 w-64 max-h-96 overflow-y-auto z-10">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold">{selectedCluster.name}</h3>
                    <button
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => {
                            setSelectedCluster(null);
                            d3.select(svgRef.current)
                                .transition()
                                .duration(1000)
                                .ease(d3.easeCubicOut)
                                .call(zoomRef.current.transform, d3.zoomIdentity.scale(0.5));
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                    {selectedCluster.applications.length} applications
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {selectedCluster.applications.map(app => (
                        <li key={app.id} className="border-b pb-2 mb-2">
                            <div className="font-medium">{app.name}</div>
                            <div className="text-xs text-gray-500">{app.description}</div>
                            {app.gridPosition && (
                                <div className="text-xs text-blue-500">
                                    Custom position: q={app.gridPosition.q}, r={app.gridPosition.r}
                                </div>
                            )}
                            {app.connections && app.connections.length > 0 && (
                                <div className="text-xs text-purple-500 mt-1">
                                    Connections: {app.connections.length}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Render the app info panel when hovering over a hexagon at zoom level >= 2.2
    const renderAppInfoPanel = () => {
        if (!hoveredApp || currentZoomLevel < 2.2) return null;

        const connectionCount = hoveredApp.connections ? hoveredApp.connections.length : 0;

        return (
            <div style={{
                position: 'fixed',
                top: '16px',
                right: '16px',
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
                padding: '12px',
                maxWidth: '300px',
                zIndex: 1000,
                borderLeft: `4px solid ${hoveredApp.clusterColor || '#888'}`
            }}>
                <div style={{
                    fontWeight: 600,
                    marginBottom: '6px',
                    fontSize: '16px',
                    borderBottom: '1px solid #eee',
                    paddingBottom: '6px'
                }}>
                    {hoveredApp.name || 'Unnamed Application'}
                </div>

                {hoveredApp.description && (
                    <div style={{ fontSize: '13px', color: '#444', marginBottom: '8px' }}>
                        {hoveredApp.description}
                    </div>
                )}

                <div style={{ fontSize: '12px', color: '#666' }}>
                    <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500 }}>Cluster: </span>
                        {hoveredApp.clusterName}
                    </div>

                    {hoveredApp.gridPosition && (
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontWeight: 500 }}>Position: </span>
                            q={hoveredApp.gridPosition.q}, r={hoveredApp.gridPosition.r}
                        </div>
                    )}

                    {connectionCount > 0 && (
                        <div style={{
                            marginTop: '8px',
                            color: '#6d28d9',
                            fontSize: '12px',
                            backgroundColor: '#f5f3ff',
                            padding: '6px',
                            borderRadius: '4px'
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Connections: {connectionCount}</div>
                            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {hoveredApp.connections.map((conn, idx) => {
                                    const targetApp = appCoordinatesRef.current[conn.to]?.app;
                                    return targetApp ? (
                                        <div key={idx} style={{
                                            fontSize: '11px',
                                            padding: '3px 0',
                                            borderBottom: idx < hoveredApp.connections.length - 1 ? '1px solid #e5e7eb' : 'none'
                                        }}>
                                            <span style={{ fontWeight: 500 }}>{targetApp.name}</span>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '10px',
                                                color: '#6b7280'
                                            }}>
                                                <span style={{
                                                    padding: '1px 4px',
                                                    backgroundColor: getTypeColor(conn.type),
                                                    color: 'white',
                                                    borderRadius: '3px',
                                                    textTransform: 'capitalize'
                                                }}>{conn.type}</span>
                                                <span style={{
                                                    textTransform: 'capitalize'
                                                }}>{conn.strength} strength</span>
                                            </div>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}

                    {hoveredApp.hasCollision && (
                        <div style={{
                            marginTop: '8px',
                            color: '#B91C1C',
                            fontSize: '11px',
                            backgroundColor: '#FEF2F2',
                            padding: '4px 6px',
                            borderRadius: '4px'
                        }}>
                            <span style={{ fontWeight: 600 }}>⚠️ Position Conflict:</span>
                            <div>Collides with {hoveredApp.collidesWith?.name} ({hoveredApp.collidesWith?.clusterName})</div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Helper function to get color for connection type
    const getTypeColor = (type) => {
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

    // Render the zoom level status overlay
    const renderZoomStatus = () => {
        return (
            <div style={{
                position: 'fixed',
                right: '16px',
                bottom: '16px',
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
                padding: '12px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>
                    Zoom Level
                </div>
                <div style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                    {currentZoomLevel.toFixed(1)}x
                </div>
                <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>
                    {currentZoomLevel >= 2.2 ?
                        "Hover over hexagons to see connections" :
                        "Hover over clusters to see outlines"}
                </div>
            </div>
        );
    };

    const renderLegend = () => {
        if (selectedCluster) {
            return (
                <div style={{
                    position: 'fixed',
                    left: '16px',
                    bottom: '16px',
                    backgroundColor: 'white',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    borderRadius: '8px',
                    padding: '12px',
                    maxWidth: '300px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 1000
                }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                        {selectedCluster.name} Applications
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {selectedCluster.applications.map(app => (
                            <div key={app.id} style={{ fontSize: '12px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                                <div style={{ fontWeight: 500 }}>{app.name}</div>
                                <div style={{ fontSize: '10px', color: '#666' }}>{app.description}</div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: '3px'
                                }}>
                                    {app.gridPosition && (
                                        <div style={{ fontSize: '10px', color: '#3b82f6' }}>
                                            Custom position
                                        </div>
                                    )}
                                    {app.connections && app.connections.length > 0 && (
                                        <div style={{ fontSize: '10px', color: '#8b5cf6' }}>
                                            {app.connections.length} connection{app.connections.length !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div style={{
                position: 'fixed',
                left: '16px',
                bottom: '16px',
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
                padding: '12px',
                maxWidth: '200px',
                zIndex: 1000
            }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Legend</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {enterpriseData.clusters.map(cluster => (
                        <div
                            key={cluster.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '3px',
                                borderRadius: '4px',
                                backgroundColor: selectedCluster?.id === cluster.id ? '#f0f0f0' : 'transparent'
                            }}
                            onClick={(event) => {
                                event.stopPropagation();
                                const svg = d3.select(svgRef.current);
                                const targetCluster = document.getElementById(`cluster-${cluster.id}`);
                                if (targetCluster) {
                                    setSelectedCluster(cluster);
                                    const bounds = targetCluster.getBBox();
                                    const x = bounds.x + bounds.width / 2;
                                    const y = bounds.y + bounds.height / 2;
                                    const scale = 2.2;
                                    const translate = [window.innerWidth / 2 - scale * x, window.innerHeight / 2 - scale * y];
                                    svg.transition()
                                        .duration(1000)
                                        .ease(d3.easeCubicInOut)
                                        .call(zoomRef.current.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
                                }
                            }}
                        >
                            <div style={{
                                width: '12px',
                                height: '12px',
                                backgroundColor: cluster.color,
                                marginRight: '8px',
                                borderRadius: '3px',
                                border: '1px solid rgba(255,255,255,0.5)'
                            }} />
                            <span style={{ fontSize: '12px' }}>{cluster.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render connection legend when connections are visible
    const renderConnectionLegend = () => {
        if (appConnections.length === 0 || currentZoomLevel < 2.2) return null;

        return (
            <div style={{
                position: 'fixed',
                right: '16px',
                bottom: '170px', // Increased spacing above the zoom level
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                borderRadius: '8px',
                padding: '12px',
                zIndex: 1000,
                width: '160px' // Fixed width for consistency
            }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                    Connection Types
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '30px',
                            height: '3px',
                            backgroundColor: getTypeColor('data-flow')
                        }}></div>
                        <span style={{ fontSize: '12px' }}>Data Flow</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '30px',
                            height: '3px',
                            backgroundColor: getTypeColor('api')
                        }}></div>
                        <span style={{ fontSize: '12px' }}>API</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '30px',
                            height: '3px',
                            backgroundColor: getTypeColor('integration')
                        }}></div>
                        <span style={{ fontSize: '12px' }}>Integration</span>
                    </div>
                </div>
                <div style={{ borderTop: '1px solid #eee', marginTop: '8px', paddingTop: '8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>
                        Strength
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '30px',
                                height: '3px',
                                backgroundColor: '#888'
                            }}></div>
                            <span style={{ fontSize: '12px' }}>High</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '30px',
                                height: '2px',
                                backgroundColor: '#888'
                            }}></div>
                            <span style={{ fontSize: '12px' }}>Medium</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '30px',
                                height: '1.5px',
                                backgroundColor: '#888',
                                strokeDasharray: '5,3'
                            }}></div>
                            <span style={{ fontSize: '12px' }}>Low (dashed)</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            <svg
                ref={svgRef}
                style={{ width: '100vw', height: '100vh' }}
                viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
                className="bg-white"
            />
            {renderDetailPanel()}
            {renderLegend()}
            {renderCollisionNotification()}
            {renderZoomStatus()}
            {renderAppInfoPanel()}
            {renderConnectionLegend()}
        </div>
    );
};

export default HexMap;
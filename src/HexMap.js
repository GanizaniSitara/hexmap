import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import entityData from './data.json';
import HexGrid from './HexGrid';
import { getLighterColor } from './connectionUtils';
import ConnectionRenderer from './ConnectionRenderer';
import {
    CollisionNotification,
    DetailPanel,
    AppInfoPanel,
    ZoomStatus,
    ConnectionLegend,
    ClusterLegend
} from './ui/components';

const HexMap = () => {
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [collisionsDetected, setCollisionsDetected] = useState([]);
    const [currentZoomLevel, setCurrentZoomLevel] = useState(1);
    const [hoveredApp, setHoveredApp] = useState(null);
    const [appConnections, setAppConnections] = useState([]);

    // Refs
    const timeoutIds = useRef([]);
    const svgRef = useRef(null);
    const zoomRef = useRef(null);
    const connectionsGroupRef = useRef(null);
    const appCoordinatesRef = useRef({});

    // SIMPLIFIED APPROACH:
    // Function to update visibility of absolutely positioned hexagons based on zoom level
    const updateAbsoluteHexagonsVisibility = (zoomLevel) => {
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
        updateClusterLabelPositions(zoomLevel);
    };

    // Function to update cluster label positions based on zoom level
    const updateClusterLabelPositions = (zoomLevel) => {
        if (!entityData || !entityData.clusters) return;

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
    };

    // Function to reset all hexagons to their original colors
    const resetHexagonsAndConnections = () => {
        if (entityData && entityData.clusters) {
            entityData.clusters.forEach(cluster => {
                const clusterGroup = d3.select(`#cluster-${cluster.id}`);
                if (clusterGroup.node()) { // Check if the element exists
                    clusterGroup.selectAll("path.hexagon")
                        .attr("fill", cluster.color);
                }
            });
        }

        // Clear hovered app
        setHoveredApp(null);

        // Clear connections
        setAppConnections([]);

        // Immediately clear the connections group
        if (connectionsGroupRef.current) {
            connectionsGroupRef.current.selectAll("*").remove();
        }

        // Clear any pending timeouts
        timeoutIds.current.forEach(id => clearTimeout(id));
        timeoutIds.current.length = 0;
    };

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Use the full browser window dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;
        const discreteLevels = [0.7, 1, 2.2, 4];

        // Initialize with first zoom level
        setCurrentZoomLevel(discreteLevels[1]); // Start at 1.0

        // Calculate hexSize so that hexagon width is exactly 22px (width = size * sqrt(3))
        const hexSize = 22 / Math.sqrt(3);
        const hexGrid = new HexGrid(hexSize, width, height);

        const g = svg.append("g");

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
                        .call(zoomRef.current.transform, d3.zoomIdentity.scale(discreteLevels[1]));
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

                // Update absolutely positioned hexagons visibility
                updateAbsoluteHexagonsVisibility(event.transform.k);

                // Always manage outlines properly at all zoom levels
                if (event.transform.k >= 2.2) {
                    // Hide outlines when zoomed in past threshold
                    topLevelOutlineGroup.attr("opacity", 0);
                } else if (previousZoomLevel !== event.transform.k) {
                    // Clear any outlines when changing zoom levels (not just crossing 2.2)
                    topLevelOutlineGroup.selectAll("*").remove();
                    topLevelOutlineGroup.attr("opacity", 0);
                }

                // Reset all hexagon colors when zooming out from detail to overview
                if (previousZoomLevel >= 2.2 && event.transform.k < 2.2) {
                    resetHexagonsAndConnections();
                }
            });
        zoomRef.current = zoom;
        svg.call(zoom);
        svg.call(zoom.transform, d3.zoomIdentity.scale(discreteLevels[1]));

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
            // Add check for transitions between any zoom levels
            const changingZoomLevel = currentScale !== newScale;

            // Transition to new zoom level
            svg.transition()
                .duration(300)
                .ease(d3.easeCubicInOut)
                .call(zoom.transform, d3.zoomIdentity.translate(newX, newY).scale(newScale))
                .on("start", () => {
                    // Clear outlines when changing between any zoom levels
                    if (changingZoomLevel) {
                        topLevelOutlineGroup.selectAll("*").remove();
                        topLevelOutlineGroup.attr("opacity", 0);
                    }
                });

            // Update the zoom level state when changed via wheel
            setCurrentZoomLevel(newScale);

            // Apply absolute hexagon visibility update
            updateAbsoluteHexagonsVisibility(newScale);

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
        console.log("Loading data:", entityData.clusters.length, "clusters");

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
        entityData.clusters.forEach(cluster => {
            cluster.applications.forEach(app => {
                app.clusterId = cluster.id;
                app.clusterName = cluster.name;
            });
        });

        // Store references to each cluster's hexagons for hover effects
        const clusterHexagons = {};

        // Draw clusters and hexagons
        entityData.clusters.forEach(cluster => {
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
                .attr("class", "cluster-label")
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

                    // SIMPLIFIED: Mark as absolute positioned
                    hexGroup.classed("absolute-positioned", true);

                    // If starting at zoom level 0.7, hide these initially
                    if (currentZoomLevel <= 0.7) {
                        hexGroup.style("opacity", 0);
                    }

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
                            timeoutIds.current.forEach(id => clearTimeout(id));
                            timeoutIds.current.length = 0;
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

                        // Create outlines in the top-level group - but only for visible hexagons
                        // FIX 2: Skip outlining hidden hexagons (those with circles at 0.7x zoom)
                        data.hexCoords.forEach(coord => {
                            // Check if this hexagon would be visible
                            const isAbsolutePositioned = coord.app && coord.app.gridPosition;
                            const wouldBeHidden = isAbsolutePositioned && currentZoom <= 0.7;

                            // Only draw outlines for visible hexagons
                            if (!wouldBeHidden) {
                                topLevelOutlineGroup.append("path")
                                    .attr("transform", `translate(${coord.x},${coord.y})`)
                                    .attr("d", hexGrid.hexagonPath(data.hexSize + 2))
                                    .attr("fill", "none")
                                    .attr("stroke", "#000000")
                                    .attr("stroke-width", 2);
                            }
                        });

                        // Show the top-level outlines immediately without transition
                        topLevelOutlineGroup.attr("opacity", 1);
                    }
                })
                .on("mouseout", function() {
                    const currentZoom = d3.zoomTransform(svg.node()).k;
                    if (currentZoom < 2.2) {
                        // With a small delay to prevent flickering during mouseover events between clusters
                        topLevelOutlineGroup.transition()
                            .duration(100)
                            .attr("opacity", 0)
                            .on("end", function() {
                                // Clear all elements after fade-out to ensure clean state
                                topLevelOutlineGroup.selectAll("*").remove();
                            });
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

        // Initial call to set up hexagon visibility based on starting zoom level
        updateAbsoluteHexagonsVisibility(discreteLevels[1]);
    }, []);

    // Debug functions - keeping these for troubleshooting
    useEffect(() => {
        // Add debugging utilities
        window.analyzeClusterSizes = function() {
            console.log("=== ANALYZING CLUSTER SIZES ===");

            // Get all cluster groups
            const clusters = {};
            document.querySelectorAll('[id^="cluster-"]').forEach(clusterGroup => {
                const clusterId = clusterGroup.id;
                const hexagons = clusterGroup.querySelectorAll('.hexagon-group');
                const visibleHexagons = Array.from(hexagons).filter(hex =>
                    window.getComputedStyle(hex).opacity !== "0" &&
                    window.getComputedStyle(hex).display !== "none"
                );

                // Get hexagons with circles (absolute positioned)
                const hexagonsWithCircles = Array.from(hexagons).filter(hex =>
                    hex.querySelector('circle')
                );

                clusters[clusterId] = {
                    name: clusterGroup.querySelector('text.cluster-label')?.textContent || clusterId,
                    totalHexagons: hexagons.length,
                    visibleHexagons: visibleHexagons.length,
                    absoluteHexagons: hexagonsWithCircles.length,
                    element: clusterGroup,
                    opacity: window.getComputedStyle(clusterGroup).opacity,
                    display: window.getComputedStyle(clusterGroup).display,
                    transform: clusterGroup.getAttribute('transform')
                };
            });

            console.table(clusters);

            // Check the specific behavior of small clusters
            console.log("=== SMALL CLUSTER BEHAVIOR ===");
            Object.keys(clusters).forEach(clusterId => {
                const cluster = clusters[clusterId];

                if (cluster.totalHexagons < 4) {
                    console.log(`Small cluster detected: ${cluster.name} with ${cluster.totalHexagons} hexagons`);

                    // Check if the whole cluster is getting hidden
                    if (cluster.opacity === "0" || cluster.display === "none") {
                        console.warn(`The entire cluster ${cluster.name} is hidden!`);
                    }

                    // Get detailed information about each hexagon in this small cluster
                    const hexagons = cluster.element.querySelectorAll('.hexagon-group');
                    const hexagonDetails = Array.from(hexagons).map(hex => ({
                        id: hex.id,
                        hasCircle: !!hex.querySelector('circle'),
                        opacity: window.getComputedStyle(hex).opacity,
                        display: window.getComputedStyle(hex).display,
                        transform: hex.getAttribute('transform'),
                        // Try to extract position
                        position: hex.getAttribute('transform')?.match(/translate\(([^,]+),([^)]+)\)/)?.slice(1).map(parseFloat) || []
                    }));

                    console.log(`Detailed hexagon info for ${cluster.name}:`, hexagonDetails);
                }
            });

            // Check for specific issues with cross-functional cluster
            const crossFunctionalCluster = Object.values(clusters).find(c =>
                c.name.includes("Cross") || c.name.includes("cross")
            );

            if (crossFunctionalCluster) {
                console.log("=== CROSS-FUNCTIONAL CLUSTER ANALYSIS ===");
                console.log(crossFunctionalCluster);

                // Detailed hexagon inspection
                const cfHexagons = crossFunctionalCluster.element.querySelectorAll('.hexagon-group');

                console.log(`Cross-Functional has ${cfHexagons.length} hexagons`);

                // Get D3 data for these hexagons
                const cfHexagonData = Array.from(cfHexagons).map(hex => {
                    const d3hex = d3.select(hex);
                    return {
                        id: hex.id,
                        hasCircle: !!hex.querySelector('circle'),
                        data: d3hex.datum(),
                        opacity: window.getComputedStyle(hex).opacity,
                        classed: {
                            absolutePositioned: d3hex.classed('absolute-positioned'),
                            hexagonGroup: d3hex.classed('hexagon-group')
                        }
                    };
                });

                console.log("Cross-Functional hexagon data:", cfHexagonData);
            }

            return "Cluster analysis complete - check console for details";
        };

        // Function to hide all hexagons with circles directly
        window.forceHideCircleHexagons = function() {
            console.log("Force hiding all hexagons with circles");

            // Direct DOM approach
            document.querySelectorAll('.hexagon-group circle').forEach(circle => {
                const hexGroup = circle.closest('.hexagon-group');
                if (hexGroup) {
                    hexGroup.style.cssText += "; opacity: 0 !important; visibility: hidden !important;";
                    console.log(`Forced hide hexagon: ${hexGroup.id}`);
                }
            });

            // Also try d3 approach
            d3.selectAll('.hexagon-group').filter(function() {
                return d3.select(this).select('circle').size() > 0;
            }).style('opacity', 0);

            return "Force hiding complete";
        };

        // Add debugging buttons
        setTimeout(() => {
            const analyzeButton = document.createElement("button");
            analyzeButton.innerHTML = "Debug to Console";
            analyzeButton.style.cssText = `
                position: fixed; 
                top: 10px; 
                left: 50%; 
                transform: translateX(-50%);
                z-index: 9999;
                padding: 8px 16px;
                background: #2196F3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            `;

            analyzeButton.onclick = function() {
                window.analyzeClusterSizes();
            };

            document.body.appendChild(analyzeButton);

            // Add force hide button
            // const forceHideButton = document.createElement("button");
            // forceHideButton.innerHTML = "Force Hide All Circles";
            // forceHideButton.style.cssText = `
            //     position: fixed;
            //     top: 10px;
            //     left: calc(50% + 130px);
            //     transform: translateX(-50%);
            //     z-index: 9999;
            //     padding: 8px 16px;
            //     background: #F44336;
            //     color: white;
            //     border: none;
            //     border-radius: 4px;
            //     cursor: pointer;
            // `;

            // forceHideButton.onclick = function() {
            //     window.forceHideCircleHexagons();
            // };
            //
            // document.body.appendChild(forceHideButton);
        }, 1000);
    }, []);

    return (
        <div className="relative">
            <svg
                ref={svgRef}
                style={{ width: '100vw', height: '100vh' }}
                viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
                className="bg-white"
            />

            <ConnectionRenderer
                appConnections={appConnections}
                connectionsGroupRef={connectionsGroupRef}
                timeoutIds={timeoutIds}
            />

            <DetailPanel
                selectedCluster={selectedCluster}
                svgRef={svgRef}
                zoomRef={zoomRef}
            />

            <ClusterLegend
                entityData={entityData}
                selectedCluster={selectedCluster}
                setSelectedCluster={setSelectedCluster}
                svgRef={svgRef}
                zoomRef={zoomRef}
            />

            <CollisionNotification
                collisionsDetected={collisionsDetected}
            />

            <ZoomStatus
                currentZoomLevel={currentZoomLevel}
            />

            <AppInfoPanel
                hoveredApp={hoveredApp}
                currentZoomLevel={currentZoomLevel}
                appCoordinatesRef={appCoordinatesRef}
            />

            <ConnectionLegend
                appConnections={appConnections}
                currentZoomLevel={currentZoomLevel}
            />
        </div>
    );
};

export default HexMap;
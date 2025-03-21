import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import entityData from './data.json';

// Component imports
import HexGridRenderer from './components/HexGridRenderer';
import ZoomHandler from './components/ZoomHandler';
import ClusterManager from './components/ClusterManager';
import ConnectionRenderer from './ConnectionRenderer';
import TooltipManager from './utils/TooltipManager';

// UI Components
import {
    CollisionNotification,
    DetailPanel,
    AppInfoPanel,
    ZoomStatus,
    ConnectionLegend,
    ClusterLegend
} from './ui/components';

const HexMap = () => {
    // State management
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
    const topLevelOutlineGroupRef = useRef(null);
    const tooltipManagerRef = useRef(null);

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

        // Hide tooltip
        if (tooltipManagerRef.current) {
            tooltipManagerRef.current.hide();
        }

        // Immediately clear the connections group
        if (connectionsGroupRef.current) {
            connectionsGroupRef.current.selectAll("*").remove();
        }

        // Clear any pending timeouts
        timeoutIds.current.forEach(id => clearTimeout(id));
        timeoutIds.current.length = 0;
    };

    // Create tooltip manager
    useEffect(() => {
        tooltipManagerRef.current = new TooltipManager();

        return () => {
            if (tooltipManagerRef.current) {
                tooltipManagerRef.current.cleanup();
            }
        };
    }, []);

    // Update tooltip manager when zoom level changes
    useEffect(() => {
        if (tooltipManagerRef.current) {
            tooltipManagerRef.current.updateZoomLevel(currentZoomLevel);
        }
    }, [currentZoomLevel]);

    useEffect(() => {
        if (!svgRef.current || !tooltipManagerRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Use the full browser window dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Main map group
        const g = svg.append("g");

        // Create background
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
                        .call(zoomRef.current.transform, d3.zoomIdentity.scale(1));
                }
            });

        // Create a dedicated top-level group for outlines
        const topLevelOutlineGroup = g.append("g")
            .attr("class", "top-level-outlines")
            .attr("opacity", 0);
        topLevelOutlineGroupRef.current = topLevelOutlineGroup;

        // Initialize ZoomHandler
        const zoomHandler = new ZoomHandler({
            svg,
            mainGroup: g,
            setCurrentZoomLevel,
            resetHexagonsAndConnections,
            topLevelOutlineGroup
        });
        zoomRef.current = zoomHandler.getZoom();

        // Initialize HexGridRenderer with tooltip manager
        const gridRenderer = new HexGridRenderer({
            svg,
            mainGroup: g,
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
            tooltipManager: tooltipManagerRef.current
        });

        // Initialize ClusterManager
        const clusterManager = new ClusterManager({
            entityData,
            svg,
            zoomRef,
            setSelectedCluster
        });

        // Initialize connections group
        const connectionsGroup = g.append("g")
            .attr("class", "connections-group");
        connectionsGroupRef.current = connectionsGroup;

        // Initial call to set up hexagon visibility based on starting zoom level
        zoomHandler.updateAbsoluteHexagonsVisibility(currentZoomLevel);

        return () => {
            // Cleanup
            timeoutIds.current.forEach(id => clearTimeout(id));
            timeoutIds.current.length = 0;
        };
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
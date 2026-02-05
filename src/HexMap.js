import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import entityData from './data.json'; // Ensure entityData includes pillboxTooltip
import { getHexagonFillColor } from './utils/colorUtils';

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
    ClusterLegend,
    ClusterInfoPanel,
    ContextMenu,
    ToggleButton // Import the ToggleButton
} from './ui/components';
import NodeDetailPanel from './ui/components/NodeDetailPanel';

const HexMap = () => {
    // State management
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [collisionsDetected, setCollisionsDetected] = useState([]);
    const [currentZoomLevel, setCurrentZoomLevel] = useState(1);
    const [hoveredApp, setHoveredApp] = useState(null);
    const [appConnections, setAppConnections] = useState([]);
    const [hoveredCluster, setHoveredCluster] = useState(null);
    const [contextMenu, setContextMenu] = useState({
        show: false,
        x: 0,
        y: 0,
        items: []
    });
    const [selectedApp, setSelectedApp] = useState(null);

    // Status toggle state
    const [colorMode, setColorMode] = useState('Cluster');

    // Refs
    const timeoutIds = useRef([]);
    const svgRef = useRef(null);
    const zoomRef = useRef(null);
    const connectionsGroupRef = useRef(null);
    const appCoordinatesRef = useRef({});
    const topLevelOutlineGroupRef = useRef(null);
    const tooltipManagerRef = useRef(null);
    const infoIconRef = useRef(null); // Ref for the info icon

    // Function to reset all hexagons to their appropriate colors based on mode
    const resetHexagonsAndConnections = () => {
        if (entityData && entityData.clusters) {
            entityData.clusters.forEach(cluster => {
                const clusterGroup = d3.select(`#cluster-${cluster.id}`);
                if (clusterGroup.node()) { // Check if the element exists
                    clusterGroup.selectAll("path.hexagon")
                        .each(function(d) {
                            // d3.select(this) refers to the current hexagon path
                            const hexData = d3.select(this.parentNode).datum();
                            d3.select(this).attr("fill", getHexagonFillColor({
                                ...hexData,
                                cluster,
                                app: hexData?.app
                            }, colorMode));
                        });
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
            tooltipManagerRef.current.hideAllConnectionTooltips(); // Fixed function name
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
    }, []); // Tooltip manager only needs to be created once

    // Update tooltip manager when zoom level changes
    useEffect(() => {
        if (tooltipManagerRef.current) {
            tooltipManagerRef.current.updateZoomLevel(currentZoomLevel);
        }
    }, [currentZoomLevel]);

    useEffect(() => {
        if (!svgRef.current || !tooltipManagerRef.current) return;

        // Store current zoom transform if any
        const svg = d3.select(svgRef.current);
        const currentTransform = d3.zoomTransform(svg.node());
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
                    setHoveredCluster(null);
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
            topLevelOutlineGroup,
            setHoveredCluster,
            setContextMenu // Pass setContextMenu here
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
            tooltipManager: tooltipManagerRef.current,
            setHoveredCluster,
            setContextMenu,
            colorMode,
            setSelectedApp
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

        // Restore previous zoom transform if it exists
        if (currentTransform.k !== 1 || currentTransform.x !== 0 || currentTransform.y !== 0) {
            svg.transition()
                .duration(0) // Immediate transition
                .call(zoomRef.current.transform, currentTransform);
        }

        return () => {
            // Cleanup
            timeoutIds.current.forEach(id => clearTimeout(id));
            timeoutIds.current.length = 0;
        };
    }, [colorMode]); // Re-render grid when colorMode changes

    // No custom handlers needed for the info icon anymore, rely on title attribute

    return (
        <div className="relative" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            {/* UI Overlays */}
            {/* Color Mode Toggle with Info Icon - Top Middle */}
            <div
                // Outer container for fixed positioning and centering
                style={{
                    position: 'fixed', 
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    padding: '4px',
                    textAlign: 'center' // Center the inline blocks
                }}
            >
                {/* Aligning ToggleButton and Icon using inline-block and vertical-align */}
                <ToggleButton
                    option1="Cluster"
                    option2="Status"
                    currentOption={colorMode}
                    onToggle={setColorMode}
                    style={{ display: 'inline-block', verticalAlign: 'middle' }} // Treat as inline block, align middle
                />
                {/* Info Icon also as inline-block aligned middle */}
                <span
                    ref={infoIconRef}
                    className="material-icons-outlined text-gray-500 cursor-help" // Changed text-gray-300 to text-gray-500
                    style={{ 
                        fontSize: '18px', 
                        display: 'inline-block', 
                        verticalAlign: 'middle', 
                        marginLeft: '4px'
                    }}
                        // Removed onMouseEnter and onMouseLeave
                        title={entityData.pillboxTooltip} // Keep native title for accessibility
                    >
                        info_outline
                    </span>
                {/* No inner wrapper div */}
            </div> {/* Close the outer fixed positioning div */}

            {/* Removed dedicated tooltip div */}

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
                colorMode={colorMode}
            />

            <CollisionNotification
                collisionsDetected={collisionsDetected}
            />

            {/* <ZoomStatus currentZoomLevel={currentZoomLevel} /> */} {/* Moved to top-right */}

            <AppInfoPanel
                hoveredApp={hoveredApp}
                currentZoomLevel={currentZoomLevel}
                appCoordinatesRef={appCoordinatesRef}
            />

            <ConnectionLegend
                appConnections={appConnections}
                currentZoomLevel={currentZoomLevel}
            />

            {/* Position ZoomStatus in the top-right corner */}
            <div className="absolute top-4 right-4 flex flex-col space-y-2">
                <ZoomStatus currentZoomLevel={currentZoomLevel} />
                {colorMode === 'Status' && (
                    <div className="bg-white p-3 rounded-lg shadow-lg">
                        <div className="font-semibold mb-2 text-sm">Status Legend</div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-sm" style={{backgroundColor: '#008000'}}></div>
                                <span className="text-xs">High (66-100)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-sm" style={{backgroundColor: '#FFA500'}}></div>
                                <span className="text-xs">Medium (33-65)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-sm" style={{backgroundColor: '#FF0000'}}></div>
                                <span className="text-xs">Low (0-32)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ClusterInfoPanel
                hoveredCluster={hoveredCluster}
                currentZoomLevel={currentZoomLevel}
            />

            {contextMenu.show && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu({...contextMenu, show: false})}
                />
            )}

            {selectedApp && (
                <NodeDetailPanel
                    app={selectedApp}
                    cluster={entityData.clusters.find(c => c.id === selectedApp.clusterId)}
                    onClose={() => setSelectedApp(null)}
                    appCoordinatesRef={appCoordinatesRef}
                />
            )}
        </div>
    );
};

export default HexMap;

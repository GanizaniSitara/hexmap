import { useEffect } from 'react';
import * as d3 from 'd3';
import { generateConnectionPath, getConnectionStyles } from './connectionUtils';

const ConnectionRenderer = ({
                                appConnections,
                                connectionsGroupRef,
                                timeoutIds
                            }) => {
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

            // Animate the projectile along the path with normalized speed
            const animateProjectile = () => {
                // Check if the connections group still exists and has content
                if (!connectionsGroupRef.current || !connectionPath.node()) {
                    return; // Exit if connections are gone
                }

                const totalLength = connectionPath.node().getTotalLength();

                // Calculate duration based on path length to normalize speed
                // Use a base speed (pixels per millisecond) and adjust duration accordingly
                const baseSpeed = 0.25; // pixels per millisecond
                const duration = Math.max(1000, totalLength / baseSpeed); // at least 1 second, scaled by length

                projectile
                    .attr("opacity", 0)
                    .transition()
                    .duration(duration) // Now scaled to path length
                    .ease(d3.easeLinear) // Use linear easing for consistent speed
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

            // Start all animations with a consistent delay pattern
            // Use a fixed delay between animations rather than scaling by index
            const timeoutId = setTimeout(animateProjectile, index * 200);

            // Store timeout ID for cleanup
            timeoutIds.current.push(timeoutId);
        });

        // Cleanup function
        return () => {
            // Clear any pending timeouts
            timeoutIds.current.forEach(id => clearTimeout(id));
            timeoutIds.current.length = 0;

            // Clear all connections
            if (connectionsGroupRef.current) {
                connectionsGroupRef.current.selectAll("*").remove();
            }
        };
    }, [appConnections, connectionsGroupRef, timeoutIds]);

    // This is a utility component that handles side effects only, no rendering
    return null;
};

export default ConnectionRenderer;
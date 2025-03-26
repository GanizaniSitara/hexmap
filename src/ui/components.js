import React from 'react';
import * as d3 from 'd3';
import { getTypeColor } from '../connectionUtils';
import ClusterInfoPanel from './components/ClusterInfoPanel';

// Render the collisions notification panel
export const CollisionNotification = ({ collisionsDetected }) => {
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

// Render cluster detail panel
export const DetailPanel = ({ selectedCluster, svgRef, zoomRef }) => {
    if (!selectedCluster) return null;

    return (
        <div className="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 w-64 max-h-96 overflow-y-auto z-10">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold">{selectedCluster.name}</h3>
                <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => {
                        d3.select(svgRef.current)
                            .transition()
                            .duration(1000)
                            .ease(d3.easeCubicOut)
                            .call(zoomRef.current.transform, d3.zoomIdentity.scale(1));
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
                                Position: q={app.gridPosition.q}, r={app.gridPosition.r}
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

// Render the app info panel when hovering
export const AppInfoPanel = ({ hoveredApp, currentZoomLevel, appCoordinatesRef }) => {
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

// Render zoom level status
export const ZoomStatus = ({ currentZoomLevel }) => {
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

// Render connection legend
export const ConnectionLegend = ({ appConnections, currentZoomLevel }) => {
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

// Render the cluster legend
export const ClusterLegend = ({ entityData, selectedCluster, setSelectedCluster, svgRef, zoomRef }) => {
    if (!entityData || !entityData.clusters) return null;

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
                                <div style={{ fontSize: '10px', color: '#3b82f6' }}>
                                    Position: q={app.gridPosition.q}, r={app.gridPosition.r}
                                </div>
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
                {entityData.clusters.map(cluster => (
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
                            const targetCluster = document.getElementById(`cluster-${cluster.id}`);
                            if (targetCluster) {
                                setSelectedCluster(cluster);
                                const bounds = targetCluster.getBBox();
                                const x = bounds.x + bounds.width / 2;
                                const y = bounds.y + bounds.height / 2;
                                const scale = 2.2;
                                const translate = [window.innerWidth / 2 - scale * x, window.innerHeight / 2 - scale * y];
                                d3.select(svgRef.current)
                                    .transition()
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

export { ClusterInfoPanel };
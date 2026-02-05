import React from 'react';
import { getTypeColor } from '../../connectionUtils';

const NodeDetailPanel = ({ app, cluster, onClose, appCoordinatesRef }) => {
    if (!app) return null;

    const statusColor = app.status >= 66 ? '#16a34a' : app.status >= 33 ? '#d97706' : '#dc2626';
    const statusLabel = app.status >= 66 ? 'Healthy' : app.status >= 33 ? 'Warning' : 'Critical';
    const uptimeColor = (app.uptime || 0) >= 99 ? '#16a34a' : (app.uptime || 0) >= 97 ? '#d97706' : '#dc2626';
    const connectionCount = app.connections ? app.connections.length : 0;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    width: '420px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    zIndex: 2001,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with color bar */}
                <div style={{
                    background: `linear-gradient(135deg, ${cluster?.color || app.color || '#666'}, ${cluster?.color || app.color || '#666'}dd)`,
                    padding: '16px 20px',
                    borderRadius: '12px 12px 0 0',
                    color: 'white',
                    position: 'relative',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                        }}
                    >
                        x
                    </button>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
                        {app.name}
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>
                        {cluster?.name || app.clusterName} &middot; v{app.version || '?'}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px' }}>
                    {/* Description */}
                    <div style={{ fontSize: '14px', color: '#374151', marginBottom: '16px', lineHeight: 1.5 }}>
                        {app.description}
                    </div>

                    {/* Status + Uptime row */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            flex: 1,
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            border: '1px solid #e5e7eb',
                        }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                Status
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: statusColor,
                                }}></div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: statusColor }}>
                                    {app.status}/100
                                </span>
                                <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                    ({statusLabel})
                                </span>
                            </div>
                        </div>
                        {app.uptime != null && (
                            <div style={{
                                flex: 1,
                                backgroundColor: '#f9fafb',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                border: '1px solid #e5e7eb',
                            }}>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                    Uptime
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: uptimeColor }}>
                                    {app.uptime}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Details grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        marginBottom: '16px',
                    }}>
                        {app.owner && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Owner</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>{app.owner}</div>
                            </div>
                        )}
                        {app.lastDeployment && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Last Deploy</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>{app.lastDeployment}</div>
                            </div>
                        )}
                        {app.gridPosition && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Grid Position</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>q={app.gridPosition.q}, r={app.gridPosition.r}</div>
                            </div>
                        )}
                        {app.version && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>Version</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>{app.version}</div>
                            </div>
                        )}
                    </div>

                    {/* Tech Stack */}
                    {app.techStack && app.techStack.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                                Tech Stack
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {app.techStack.map((tech, idx) => (
                                    <span key={idx} style={{
                                        fontSize: '12px',
                                        padding: '3px 8px',
                                        backgroundColor: '#f3f4f6',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '4px',
                                        color: '#374151',
                                    }}>
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Connections */}
                    {connectionCount > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                                Connections ({connectionCount})
                            </div>
                            <div style={{
                                backgroundColor: '#f5f3ff',
                                borderRadius: '8px',
                                padding: '8px',
                                maxHeight: '150px',
                                overflowY: 'auto',
                            }}>
                                {app.connections.map((conn, idx) => {
                                    const targetApp = appCoordinatesRef?.current?.[conn.to]?.app;
                                    return (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '6px 4px',
                                            borderBottom: idx < connectionCount - 1 ? '1px solid #e5e7eb' : 'none',
                                        }}>
                                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>
                                                {targetApp?.name || conn.to}
                                            </span>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '2px 6px',
                                                    backgroundColor: getTypeColor(conn.type),
                                                    color: 'white',
                                                    borderRadius: '3px',
                                                    textTransform: 'capitalize',
                                                }}>
                                                    {conn.type}
                                                </span>
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '2px 6px',
                                                    backgroundColor: conn.strength === 'high' ? '#dcfce7' : conn.strength === 'medium' ? '#fef3c7' : '#fee2e2',
                                                    color: conn.strength === 'high' ? '#166534' : conn.strength === 'medium' ? '#92400e' : '#991b1b',
                                                    borderRadius: '3px',
                                                    textTransform: 'capitalize',
                                                }}>
                                                    {conn.strength}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        borderTop: '1px solid #e5e7eb',
                        paddingTop: '16px',
                    }}>
                        {app.detailUrl && (
                            <button
                                onClick={() => window.open(app.detailUrl, '_blank')}
                                style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    backgroundColor: cluster?.color || app.color || '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Open Detail Page
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                flex: app.detailUrl ? 0 : 1,
                                padding: '10px 16px',
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minWidth: '80px',
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NodeDetailPanel;

import React from 'react';

const ClusterInfoPanel = ({ hoveredCluster, currentZoomLevel }) => {
    // Only show at zoom levels 0.7 and 1.0, hide at higher zoom levels
    if (!hoveredCluster || currentZoomLevel > 1.0) return null;

    // Status indicator color based on budget status
    const getBudgetStatusColor = (status) => {
        switch(status) {
            case 'On track': return '#10B981'; // Green
            case 'Under review': return '#F59E0B'; // Amber
            case 'Over budget': return '#EF4444'; // Red
            case 'Exceeding targets': return '#3B82F6'; // Blue
            case 'Special allocation': return '#8B5CF6'; // Purple
            case 'Shared allocation': return '#6366F1'; // Indigo
            default: return '#6B7280'; // Gray
        }
    };

    // Status indicator color based on priority
    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'Critical': return '#DC2626'; // Red
            case 'High': return '#F97316'; // Orange
            case 'Medium': return '#FBBF24'; // Yellow
            case 'Low': return '#34D399'; // Green
            case 'Experimental': return '#8B5CF6'; // Purple
            default: return '#6B7280'; // Gray
        }
    };

    const budgetStatusColor = getBudgetStatusColor(hoveredCluster.budgetStatus);
    const priorityColor = getPriorityColor(hoveredCluster.priority);

    return (
        <div style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            backgroundColor: 'white',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            borderRadius: '8px',
            padding: '16px',
            maxWidth: '320px',
            zIndex: 1000,
            borderLeft: `4px solid ${hoveredCluster.color || '#888'}`,
            transition: 'all 0.2s ease'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
            }}>
                <div style={{
                    fontWeight: 600,
                    fontSize: '18px',
                    color: '#1F2937'
                }}>
                    {hoveredCluster.name}
                </div>
                <div style={{
                    backgroundColor: hoveredCluster.color,
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px'
                }}></div>
            </div>

            <div style={{
                color: '#4B5563',
                fontSize: '14px',
                marginBottom: '16px',
                lineHeight: '1.5'
            }}>
                {hoveredCluster.description}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px'
            }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                        Department
                    </div>
                    <div style={{ fontSize: '14px' }}>
                        {hoveredCluster.department}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                        Applications
                    </div>
                    <div style={{ fontSize: '14px' }}>
                        {hoveredCluster.applications.length}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                        Last Updated
                    </div>
                    <div style={{ fontSize: '14px' }}>
                        {hoveredCluster.lastUpdated}
                    </div>
                </div>

                <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                        Lead
                    </div>
                    <div style={{ fontSize: '14px' }}>
                        {hoveredCluster.leadName}
                    </div>
                </div>
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: budgetStatusColor
                    }}></div>
                    <div style={{ fontSize: '13px' }}>
                        {hoveredCluster.budgetStatus}
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{
                        fontSize: '13px'
                    }}>
                        Priority:
                    </div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: priorityColor
                    }}>
                        {hoveredCluster.priority}
                    </div>
                </div>
            </div>

            <div style={{
                marginTop: '16px',
                fontSize: '12px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                {hoveredCluster.leadEmail}
            </div>
        </div>
    );
};

export default ClusterInfoPanel;
import React from 'react';

const Tooltip = ({ text, position, visible }) => {
    if (!visible || !text) return null;

    const tooltipStyle = {
        position: 'fixed',
        left: position.x + 'px',
        top: position.y + 'px',
        transform: 'translate(-50%, -120%)',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        pointerEvents: 'none',
        zIndex: 1500,
        transition: 'opacity 0.15s ease',
        opacity: visible ? 1 : 0,
        whiteSpace: 'nowrap',
        maxWidth: '250px',
        textOverflow: 'ellipsis',
        overflow: 'hidden'
    };

    return (
        <div style={tooltipStyle}>
            {text}
        </div>
    );
};

export default Tooltip;
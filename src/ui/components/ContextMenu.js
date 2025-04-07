import React from 'react';
import * as d3 from 'd3';

const ContextMenu = ({ x, y, items, onClose }) => {
    const handleItemClick = (action) => {
        action();
        onClose();
    };

    return (
        <div 
            className="context-menu"
            style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                zIndex: 1000,
                minWidth: '120px', // Reduced minWidth slightly
                padding: '2px 0' // Reduced vertical padding
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {items.map((item, index) => (
                <div
                    key={index}
                    className="context-menu-item"
                    style={{ color: item.color || '#333' }} // Keep dynamic color style
                    onClick={() => handleItemClick(item.action)}
                    // Add mouse event handlers if needed later, but CSS hover is preferred
                >
                    {item.label}
                </div>
            ))}
        </div>
    );
};

export { ContextMenu };
export default ContextMenu;

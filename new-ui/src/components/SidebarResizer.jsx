import React, { useEffect, useState } from 'react';

const SidebarResizer = ({ onResize }) => {
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            onResize(e.clientX);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, onResize]);

    return (
        <div
            className={`sidebar-resizer ${isResizing ? 'dragging' : ''}`}
            id="sidebarResizer"
            onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
            }}
        />
    );
};

export default SidebarResizer;

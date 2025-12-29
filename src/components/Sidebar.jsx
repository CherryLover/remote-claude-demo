import React, { useState } from 'react';
import SidebarResizer from './SidebarResizer';
import ServerManager from './ServerManager';

const Sidebar = ({ servers, selectedServerId, onServerSelect, refreshServers, onOpenSettings }) => {
    const [width, setWidth] = useState(260);

    const handleResize = (newWidth) => {
        const minWidth = 220;
        const maxWidth = 500;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        setWidth(newWidth);
    };

    return (
        <div className="sidebar" id="sidebar" style={{ width: width + 'px' }}>
            <SidebarResizer onResize={handleResize} />
            <div className="sidebar-header">
                <h2>R-CLAUDE</h2>
            </div>

            <ServerManager
                servers={servers}
                selectedServerId={selectedServerId}
                onSelect={onServerSelect}
                refreshServers={refreshServers}
            />

            <div className="sidebar-footer">
                <button className="btn-settings" onClick={onOpenSettings}>
                    <span>⚙</span> Settings
                </button>
            </div>
        </div>
    );
};

export default Sidebar;

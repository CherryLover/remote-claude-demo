import React, { useState } from 'react';
import SidebarResizer from './SidebarResizer';
import ServerManager from './ServerManager';
import ManualExec from './ManualExec';
import ConfigPanel from './ConfigPanel';

const Sidebar = ({ servers, selectedServerId, onServerSelect, refreshServers }) => {
    const [width, setWidth] = useState(340);

    const handleResize = (newWidth) => {
        const minWidth = 280;
        const maxWidth = window.innerWidth / 2;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        setWidth(newWidth);
    };

    return (
        <div className="sidebar" id="sidebar" style={{ width: width + 'px' }}>
            <SidebarResizer onResize={handleResize} />
            <ServerManager
                servers={servers}
                selectedServerId={selectedServerId}
                onSelect={onServerSelect}
                refreshServers={refreshServers}
            />
            <ManualExec selectedServerId={selectedServerId} />
            <ConfigPanel />
        </div>
    );
};

export default Sidebar;

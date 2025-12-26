import React, { useState } from 'react';
import { api } from '../utils/api';
import AddServerModal from './Settings/AddServerModal';

const ServerManager = ({ servers, selectedServerId, onSelect, refreshServers }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const handleConnect = async (e, serverId) => {
        e.stopPropagation();
        try {
            const res = await api.connectSavedServer(serverId);
            if (res.ok) {
                await refreshServers();
                onSelect(serverId);
            } else {
                alert('Connection failed: ' + res.detail);
            }
        } catch (err) {
            alert('Connection failed: ' + err.message);
        }
    };

    const handleDisconnect = async (e, serverId) => {
        e.stopPropagation();
        try {
            await api.disconnectServer(serverId);
            await refreshServers();
        } catch (err) {
            alert('Disconnect failed: ' + err.message);
        }
    };

    const handleDelete = async (e, serverId) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${serverId}"?`)) return;
        try {
            await api.deleteServer(serverId);
            await refreshServers();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    return (
        <div className="server-manager">
            <div className="section-header">
                <h3>SERVERS</h3>
                <button className="btn-icon-add" onClick={() => setIsAddModalOpen(true)} title="Add Server">
                    +
                </button>
            </div>

            <div className="servers-list">
                {servers.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '12px', padding: '10px 16px' }}>No servers configured</div>
                ) : (
                    servers.map(server => (
                        <div
                            key={server.id}
                            className={`server-item ${server.connected ? 'connected' : ''} ${server.id === selectedServerId ? 'selected' : ''}`}
                            onClick={() => server.connected && onSelect(server.id)}
                        >
                            <div className="server-header">
                                <span className="server-status-dot" title={server.connected ? 'Connected' : 'Disconnected'}></span>
                                <span className="server-id">{server.id}</span>
                                {server.connected && <span className="status-badge">CONN</span>}
                            </div>

                            <div className="server-actions">
                                {server.connected ? (
                                    <button className="btn-icon warning" onClick={(e) => handleDisconnect(e, server.id)} title="Disconnect">
                                        ⏻
                                    </button>
                                ) : (
                                    <button className="btn-icon success" onClick={(e) => handleConnect(e, server.id)} title="Connect">
                                        ▶
                                    </button>
                                )}
                                <button className="btn-icon danger" onClick={(e) => handleDelete(e, server.id)} title="Delete">
                                    ×
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <AddServerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdded={refreshServers}
            />
        </div>
    );
};

export default ServerManager;

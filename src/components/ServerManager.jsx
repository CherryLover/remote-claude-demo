import React, { useState } from 'react';
import { api, isElectron } from '../utils/api';
import AddServerModal from './Settings/AddServerModal';

const ServerManager = ({ servers, selectedServerId, onSelect, refreshServers }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [reconnectServer, setReconnectServer] = useState(null);
    const [reconnectPassword, setReconnectPassword] = useState('');

    const handleConnect = async (e, serverId) => {
        e.stopPropagation();
        try {
            const res = await api.connectSavedServer(serverId);
            if (res.ok) {
                await refreshServers();
                onSelect(serverId);
            } else if (res.needPassword) {
                // Electron 模式：需要重新输入密码
                const server = servers.find(s => s.id === serverId);
                setReconnectServer(server);
                setReconnectPassword('');
            } else {
                alert('Connection failed: ' + (res.detail || res.error));
            }
        } catch (err) {
            alert('Connection failed: ' + err.message);
        }
    };

    const handleReconnect = async () => {
        if (!reconnectServer || !reconnectPassword) return;
        try {
            const res = await api.addServer({
                host: reconnectServer.host,
                port: reconnectServer.port,
                username: reconnectServer.username,
                password: reconnectPassword
            });
            if (res.ok) {
                await refreshServers();
                onSelect(reconnectServer.id);
                setReconnectServer(null);
                setReconnectPassword('');
            } else {
                alert('Connection failed: ' + (res.error || res.detail));
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

            {/* 重新连接密码输入弹窗 */}
            {reconnectServer && (
                <div className="modal-overlay" onClick={() => setReconnectServer(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>重新连接</h2>
                            <button className="modal-close" onClick={() => setReconnectServer(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px', color: '#888' }}>
                                连接到 {reconnectServer.id}
                            </p>
                            <div className="form-group">
                                <label>密码</label>
                                <input
                                    type="password"
                                    value={reconnectPassword}
                                    onChange={(e) => setReconnectPassword(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleReconnect()}
                                    placeholder="输入 SSH 密码"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setReconnectServer(null)}>取消</button>
                            <button className="btn btn-primary" onClick={handleReconnect}>连接</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServerManager;

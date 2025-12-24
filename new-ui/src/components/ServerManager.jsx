import React, { useState } from 'react';
import { api } from '../utils/api';

const ServerManager = ({ servers, selectedServerId, onSelect, refreshServers }) => {
    const [collapsed, setCollapsed] = useState(false); // Add Server form collapsed state

    // Form state
    const [hostId, setHostId] = useState('');
    const [host, setHost] = useState('');
    const [port, setPort] = useState('22');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [connecting, setConnecting] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        setConnecting(true);
        try {
            const res = await api.addServer({
                host_id: hostId,
                host,
                port: parseInt(port, 10),
                username,
                password
            });

            if (res.ok) {
                alert(res.message);
                // Reset form
                setHostId('');
                setHost('');
                setPort('22');
                setUsername('');
                setPassword('');

                await refreshServers();
                onSelect(hostId); // Select the newly added server (logic from original code)
            } else {
                alert('连接失败: ' + res.detail);
            }
        } catch (err) {
            alert('连接失败: ' + err.message);
        } finally {
            setConnecting(false);
        }
    };

    const handleConnect = async (e, serverId) => {
        e.stopPropagation();
        try {
            const res = await api.connectSavedServer(serverId);
            if (res.ok) {
                await refreshServers();
                onSelect(serverId);
            } else {
                alert('连接失败: ' + res.detail);
            }
        } catch (err) {
            alert('连接失败: ' + err.message);
        }
    };

    const handleDisconnect = async (e, serverId) => {
        e.stopPropagation();
        try {
            await api.disconnectServer(serverId);
            await refreshServers();
        } catch (err) {
            alert('断开失败: ' + err.message);
        }
    };

    const handleDelete = async (e, serverId) => {
        e.stopPropagation();
        if (!confirm(`确定删除服务器 "${serverId}" 吗？这将同时删除保存的配置。`)) return;
        try {
            await api.deleteServer(serverId);
            await refreshServers();
        } catch (err) {
            alert('删除失败: ' + err.message);
        }
    };

    return (
        <>
            <h2>SSH 连接管理</h2>

            {/* 添加连接表单 */}
            <div>
                <h3
                    className={`collapsible ${collapsed ? 'collapsed' : ''}`}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    添加新服务器
                </h3>
                <div className={`collapse-content ${collapsed ? 'collapsed' : ''}`} id="addServerForm">
                    <form id="connectForm" style={{ marginTop: '10px' }} onSubmit={handleAdd}>
                        <div className="form-group">
                            <label>连接别名</label>
                            <input
                                type="text"
                                placeholder="如: my-server"
                                required
                                value={hostId}
                                onChange={e => setHostId(e.target.value)}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>主机地址</label>
                                <input
                                    type="text"
                                    placeholder="IP 或域名"
                                    required
                                    value={host}
                                    onChange={e => setHost(e.target.value)}
                                />
                            </div>
                            <div className="form-group" style={{ flex: '0 0 80px' }}>
                                <label>端口</label>
                                <input
                                    type="number"
                                    value={port}
                                    required
                                    onChange={e => setPort(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>用户名</label>
                            <input
                                type="text"
                                placeholder="root"
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>密码</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-full-width" disabled={connecting}>
                            {connecting ? '连接中...' : '添加并连接'}
                        </button>
                    </form>
                </div>
            </div>

            {/* 服务器列表 */}
            <div className="servers-section">
                <h3>已保存的服务器</h3>
                <div className="servers-list" id="serversList">
                    {servers.length === 0 ? (
                        <div style={{ color: '#888', fontSize: '13px' }}>暂无保存的服务器</div>
                    ) : (
                        servers.map(server => (
                            <div
                                key={server.id}
                                className={`server-item ${server.connected ? 'connected' : ''} ${server.id === selectedServerId ? 'selected' : ''}`}
                                onClick={() => server.connected && onSelect(server.id)}
                            >
                                <div className="server-header">
                                    <span className="server-id">{server.id}</span>
                                    <div>
                                        <span className="server-status">{server.connected ? '已连接' : '未连接'}</span>
                                        <div className="server-selected-tag">当前选中</div>
                                    </div>
                                </div>
                                <div className="server-addr">{server.username}@{server.host}:{server.port}</div>
                                <div className="server-actions">
                                    {server.connected ? (
                                        <button
                                            className="btn btn-warning btn-sm"
                                            onClick={(e) => handleDisconnect(e, server.id)}
                                        >
                                            断开
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={(e) => handleConnect(e, server.id)}
                                        >
                                            连接
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={(e) => handleDelete(e, server.id)}
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default ServerManager;

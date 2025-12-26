import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const SettingsModal = ({ isOpen, onClose }) => {
    const [config, setConfig] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        if (isOpen) loadConfig();
    }, [isOpen]);

    const loadConfig = async () => {
        try {
            const data = await api.getConfig();
            setConfig(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async () => {
        if (apiKey && apiKey.includes('...')) return;
        try {
            const res = await api.saveConfig({
                api_key: apiKey || null,
                base_url: baseUrl || null
            });
            if (res.ok) {
                setApiKey('');
                loadConfig();
                alert('Saved successfully');
            }
        } catch (err) {
            alert(err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="setting-group">
                        <label>Anthropic API Key</label>
                        <input
                            type="password"
                            placeholder="sk-ant-..."
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                        />
                        <div className="status-indicator">
                            Status: <span className={config?.web?.has_api_key ? 'ok' : 'missing'}>
                                {config?.web?.has_api_key ? 'Configured' : 'Not Configured'}
                            </span>
                        </div>
                    </div>

                    <div className="setting-group">
                        <label>Base URL (Optional)</label>
                        <input
                            type="text"
                            placeholder="https://api.anthropic.com"
                            value={baseUrl}
                            onChange={e => setBaseUrl(e.target.value)}
                        />
                    </div>

                    <div className="config-info">
                        <h3>Configuration Sources</h3>
                        {config && [
                            { k: 'web', l: 'Web Settings' },
                            { k: 'dotenv', l: '.env File' },
                            { k: 'system', l: 'System Env' }
                        ].map(s => {
                            const active = config.active_source === s.k;
                            return (
                                <div key={s.k} className={`source-item ${active ? 'active' : ''}`}>
                                    <span className="dot"></span>
                                    <span className="label">{s.l}</span>
                                    {active && <span className="badge">Active</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

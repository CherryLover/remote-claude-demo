import React, { useState, useEffect } from 'react';
import { api, isElectron } from '../utils/api';

const ConfigPanel = () => {
    const [collapsed, setCollapsed] = useState(true);
    const [config, setConfig] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');

    const loadConfig = async () => {
        try {
            const data = await api.getConfig();
            setConfig(data);
        } catch (err) {
            console.error('Failed to load config', err);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSave = async () => {
        const key = apiKey.trim();
        const url = baseUrl.trim();

        if (key && key.includes('...')) {
            alert('请输入完整的 API Key');
            return;
        }

        try {
            const saveData = isElectron()
                ? { apiKey: key || undefined, baseUrl: url || undefined }
                : { api_key: key || null, base_url: url || null };

            const res = await api.saveConfig(saveData);

            if (res.ok || res.success) {
                alert(res.message || '配置已保存');
                setApiKey('');
                setBaseUrl('');
                loadConfig();
            } else {
                alert('保存失败: ' + (res.detail || res.error || '未知错误'));
            }
        } catch (err) {
            alert('保存失败: ' + err.message);
        }
    };

    const handleClear = async () => {
        if (!confirm('确定清除配置吗？')) return;
        try {
            const res = await api.clearConfig();
            if (res.ok || res.success) {
                alert(res.message || '配置已清除');
                loadConfig();
            } else {
                alert('清除失败: ' + (res.detail || res.error || '未知错误'));
            }
        } catch (err) {
            alert('清除失败: ' + err.message);
        }
    };

    // Electron 模式的简化配置显示
    if (isElectron()) {
        return (
            <div className="config-section">
                <h3
                    className={`collapsible ${collapsed ? 'collapsed' : ''}`}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    Claude 配置
                </h3>
                <div className={`config-panel ${collapsed ? 'collapsed' : ''}`}>
                    <div className="config-form" style={{ marginTop: '10px' }}>
                        <div className="form-group">
                            <label>API Key</label>
                            <input
                                type="password"
                                placeholder="sk-ant-..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Base URL (可选)</label>
                            <input
                                type="text"
                                placeholder="https://api.anthropic.com"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="config-actions">
                        <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={handleClear}
                            disabled={!config?.hasApiKey}
                        >
                            清除
                        </button>
                    </div>
                    {config && (
                        <div className="config-sources">
                            <div className="config-sources-title">当前配置</div>
                            <div className="config-source active">
                                <span className="config-source-icon">●</span>
                                <span className="config-source-label">模型</span>
                                <span className="config-source-value">{config.model || '未配置'}</span>
                            </div>
                            <div className={`config-source ${config.hasApiKey ? 'active' : ''}`}>
                                <span className="config-source-icon">{config.hasApiKey ? '●' : '○'}</span>
                                <span className="config-source-label">API Key</span>
                                <span className="config-source-value">
                                    {config.apiKeyPreview || '未配置'}
                                </span>
                            </div>
                            {config.baseUrl && (
                                <div className="config-source active">
                                    <span className="config-source-icon">●</span>
                                    <span className="config-source-label">Base URL</span>
                                    <span className="config-source-value">{config.baseUrl}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Web 模式的多级配置显示
    const sources = [
        { key: 'web', label: 'Web 配置', data: config?.web },
        { key: 'dotenv', label: '项目 .env', data: config?.dotenv },
        { key: 'system', label: '系统环境变量', data: config?.system }
    ];

    return (
        <div className="config-section">
            <h3
                className={`collapsible ${collapsed ? 'collapsed' : ''}`}
                id="configHeader"
                onClick={() => setCollapsed(!collapsed)}
            >
                Claude 配置
            </h3>
            <div
                className={`config-panel ${collapsed ? 'collapsed' : ''}`}
                id="configPanel"
            >
                <div className="config-form" style={{ marginTop: '10px' }}>
                    <div className="form-group">
                        <label>API Key</label>
                        <input
                            type="password"
                            id="configApiKey"
                            placeholder="sk-ant-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Base URL (可选)</label>
                        <input
                            type="text"
                            id="configBaseUrl"
                            placeholder="https://api.anthropic.com"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                        />
                    </div>
                </div>
                <div className="config-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
                    <button
                        className="btn btn-danger btn-sm"
                        id="configClearBtn"
                        onClick={handleClear}
                        disabled={!config?.web?.has_api_key}
                    >
                        清除
                    </button>
                </div>
                <div className="config-sources">
                    <div className="config-sources-title">配置来源（优先级从高到低）</div>
                    <div id="configSources">
                        {config && sources.map(source => {
                            if (!source.data) return null;
                            const isActive = config.active_source === source.key;
                            const hasKey = source.data.has_api_key;
                            const statusClass = isActive ? 'active' : (hasKey ? 'available' : '');

                            return (
                                <div key={source.key} className={`config-source ${statusClass}`}>
                                    <span className="config-source-icon">
                                        {isActive ? '●' : (hasKey ? '○' : '○')}
                                    </span>
                                    <span className="config-source-label">{source.label}</span>
                                    <span className="config-source-value">
                                        {source.data.api_key || '未配置'}
                                    </span>
                                    {isActive && <span className="config-source-status">当前生效</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigPanel;

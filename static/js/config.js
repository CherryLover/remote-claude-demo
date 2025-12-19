/**
 * Claude 配置管理模块
 */

// 配置状态
let currentConfig = null;

/**
 * 加载配置
 */
async function loadConfig() {
    try {
        const res = await fetch('/api/claude/config');
        currentConfig = await res.json();
        renderConfigPanel();
    } catch (err) {
        console.error('加载配置失败:', err);
    }
}

/**
 * 保存配置
 */
async function saveConfig() {
    const apiKeyInput = document.getElementById('configApiKey');
    const baseUrlInput = document.getElementById('configBaseUrl');

    const apiKey = apiKeyInput.value.trim();
    const baseUrl = baseUrlInput.value.trim();

    // 如果输入框显示的是脱敏值，不提交
    if (apiKey && apiKey.includes('...')) {
        alert('请输入完整的 API Key');
        return;
    }

    try {
        const res = await fetch('/api/claude/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey || null,
                base_url: baseUrl || null
            })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            // 清空输入框
            apiKeyInput.value = '';
            baseUrlInput.value = '';
            // 重新加载配置
            await loadConfig();
        } else {
            alert('保存失败: ' + (data.detail || '未知错误'));
        }
    } catch (err) {
        alert('保存失败: ' + err.message);
    }
}

/**
 * 清除 Web 配置
 */
async function clearConfig() {
    if (!confirm('确定清除 Web 配置吗？将会使用下一优先级的配置源。')) {
        return;
    }

    try {
        const res = await fetch('/api/claude/config', { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            await loadConfig();
        } else {
            alert('清除失败: ' + (data.detail || '未知错误'));
        }
    } catch (err) {
        alert('清除失败: ' + err.message);
    }
}

/**
 * 渲染配置面板
 */
function renderConfigPanel() {
    if (!currentConfig) return;

    const container = document.getElementById('configSources');
    if (!container) return;

    const sources = [
        { key: 'web', label: 'Web 配置', data: currentConfig.web },
        { key: 'dotenv', label: '项目 .env', data: currentConfig.dotenv },
        { key: 'system', label: '系统环境变量', data: currentConfig.system }
    ];

    let html = '';
    sources.forEach(source => {
        const isActive = currentConfig.active_source === source.key;
        const hasKey = source.data.has_api_key;
        const statusClass = isActive ? 'active' : (hasKey ? 'available' : 'empty');
        const statusIcon = isActive ? '●' : (hasKey ? '○' : '○');
        const statusText = isActive ? '当前生效' : '';

        html += `
            <div class="config-source ${statusClass}">
                <span class="config-source-icon">${statusIcon}</span>
                <span class="config-source-label">${source.label}</span>
                <span class="config-source-value">${source.data.api_key || '未配置'}</span>
                ${statusText ? `<span class="config-source-status">${statusText}</span>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;

    // 更新清除按钮状态
    const clearBtn = document.getElementById('configClearBtn');
    if (clearBtn) {
        clearBtn.disabled = !currentConfig.web.has_api_key;
    }
}

/**
 * 切换配置面板显示/隐藏
 */
function toggleConfigPanel() {
    const panel = document.getElementById('configPanel');
    const header = document.getElementById('configHeader');
    if (panel && header) {
        panel.classList.toggle('collapsed');
        header.classList.toggle('collapsed');
    }
}

/**
 * 初始化配置模块
 */
function initConfigEvents() {
    // 页面加载时获取配置
    loadConfig();
}

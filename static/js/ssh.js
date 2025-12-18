/**
 * SSH 服务器管理模块
 */

// 当前选中的服务器
let selectedServerId = null;

// 命令历史
let commandHistory = [];
let historyIndex = -1;
let currentInput = '';

/**
 * 获取当前选中的服务器 ID
 */
function getSelectedServerId() {
    return selectedServerId;
}

/**
 * 选择服务器
 */
function selectServer(hostId) {
    selectedServerId = hostId;
    document.querySelectorAll('.server-item').forEach(item => {
        item.classList.remove('selected');
    });
    const selectedItem = document.querySelector(`.server-item[data-id="${hostId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
}

/**
 * 刷新服务器列表
 */
async function refreshServers() {
    const res = await fetch('/api/ssh/list');
    const data = await res.json();
    const list = document.getElementById('serversList');

    if (!data.servers || data.servers.length === 0) {
        list.innerHTML = '<div style="color: #888; font-size: 13px;">暂无保存的服务器</div>';
        selectedServerId = null;
        return;
    }

    const connectedServers = data.servers.filter(s => s.connected);
    if (selectedServerId && !connectedServers.find(s => s.id === selectedServerId)) {
        selectedServerId = null;
    }

    if (!selectedServerId && connectedServers.length === 1) {
        selectedServerId = connectedServers[0].id;
    }

    list.innerHTML = data.servers.map(server => `
        <div class="server-item ${server.connected ? 'connected' : ''} ${server.id === selectedServerId ? 'selected' : ''}"
             data-id="${server.id}"
             onclick="${server.connected ? `selectServer('${server.id}')` : ''}">
            <div class="server-header">
                <span class="server-id">${server.id}</span>
                <div>
                    <span class="server-status">${server.connected ? '已连接' : '未连接'}</span>
                    <div class="server-selected-tag">当前选中</div>
                </div>
            </div>
            <div class="server-addr">${server.username}@${server.host}:${server.port}</div>
            <div class="server-actions">
                ${server.connected
                    ? `<button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); disconnectServer('${server.id}')">断开</button>`
                    : `<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); connectServer('${server.id}')">连接</button>`
                }
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteServer('${server.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

/**
 * 连接已保存的服务器
 */
async function connectServer(hostId) {
    try {
        const res = await fetch(`/api/ssh/connect/${hostId}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            selectedServerId = hostId;
            refreshServers();
        } else {
            alert('连接失败: ' + data.detail);
        }
    } catch (err) {
        alert('连接失败: ' + err.message);
    }
}

/**
 * 断开连接
 */
async function disconnectServer(hostId) {
    try {
        await fetch(`/api/ssh/disconnect/${hostId}`, { method: 'POST' });
        refreshServers();
    } catch (err) {
        alert('断开失败: ' + err.message);
    }
}

/**
 * 删除服务器配置
 */
async function deleteServer(hostId) {
    if (!confirm(`确定删除服务器 "${hostId}" 吗？这将同时删除保存的配置。`)) return;

    try {
        await fetch(`/api/ssh/config/${hostId}`, { method: 'DELETE' });
        refreshServers();
    } catch (err) {
        alert('删除失败: ' + err.message);
    }
}

/**
 * 手动执行命令
 */
async function manualExec() {
    const input = document.getElementById('execCommand');
    const command = input.value.trim();
    const historyDiv = document.getElementById('execHistory');

    if (!selectedServerId) {
        alert('请先在上方服务器列表中选择一个已连接的服务器');
        return;
    }
    if (!command) {
        alert('请输入命令');
        return;
    }

    // 保存到命令历史
    if (commandHistory[commandHistory.length - 1] !== command) {
        commandHistory.push(command);
    }
    historyIndex = commandHistory.length;
    currentInput = '';

    input.value = '';
    input.style.height = 'auto';

    const emptyState = historyDiv.querySelector('.exec-history-empty');
    if (emptyState) emptyState.remove();

    const itemId = 'exec-' + Date.now();
    historyDiv.innerHTML += `
        <div class="exec-history-item" id="${itemId}">
            <div class="exec-cmd">${escapeHtml(command)}</div>
            <div class="exec-output">执行中...</div>
        </div>
    `;
    historyDiv.scrollTop = historyDiv.scrollHeight;

    try {
        const res = await fetch('/api/ssh/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host_id: selectedServerId, command: command })
        });

        const data = await res.json();
        const itemEl = document.getElementById(itemId);
        const outputEl = itemEl.querySelector('.exec-output');

        if (res.ok) {
            let output = `[Exit: ${data.result.exit_code}]`;
            if (data.result.stdout) output += `\n${data.result.stdout}`;
            if (data.result.stderr) {
                outputEl.innerHTML = `<span>[Exit: ${data.result.exit_code}]</span>` +
                    (data.result.stdout ? `\n${escapeHtml(data.result.stdout)}` : '') +
                    `<span class="exec-error">\n${escapeHtml(data.result.stderr)}</span>`;
            } else {
                outputEl.textContent = output;
            }
        } else {
            outputEl.innerHTML = `<span class="exec-error">错误: ${escapeHtml(data.detail)}</span>`;
        }
    } catch (err) {
        const itemEl = document.getElementById(itemId);
        itemEl.querySelector('.exec-output').innerHTML = `<span class="exec-error">错误: ${escapeHtml(err.message)}</span>`;
    }

    historyDiv.scrollTop = historyDiv.scrollHeight;
}

/**
 * 初始化 SSH 相关事件
 */
function initSSHEvents() {
    // 添加服务器表单
    document.getElementById('connectForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = '连接中...';

        try {
            const res = await fetch('/api/ssh/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: document.getElementById('hostId').value,
                    host: document.getElementById('host').value,
                    port: parseInt(document.getElementById('port').value),
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value
                })
            });

            const data = await res.json();
            if (res.ok) {
                const newHostId = document.getElementById('hostId').value;
                alert(data.message);
                e.target.reset();
                document.getElementById('port').value = '22';
                selectedServerId = newHostId;
                refreshServers();
            } else {
                alert('连接失败: ' + data.detail);
            }
        } catch (err) {
            alert('连接失败: ' + err.message);
        }

        btn.disabled = false;
        btn.textContent = '添加并连接';
    };

    // 手动命令输入框
    const execInput = document.getElementById('execCommand');
    execInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            manualExec();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                if (historyIndex === commandHistory.length) {
                    currentInput = this.value;
                }
                if (historyIndex > 0) {
                    historyIndex--;
                    this.value = commandHistory[historyIndex];
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                this.value = commandHistory[historyIndex];
            } else if (historyIndex === commandHistory.length - 1) {
                historyIndex = commandHistory.length;
                this.value = currentInput;
            }
        }
    });

    execInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
}

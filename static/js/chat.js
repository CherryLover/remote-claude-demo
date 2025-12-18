/**
 * Claude 对话模块
 */

// 流式响应状态
let isStreaming = false;

// ============== 工具渲染相关 ==============

/**
 * 格式化工具参数显示
 */
function formatToolParams(name, input) {
    if (!input) return '';
    // 对于 ssh_exec，主要显示 command
    if (name === 'mcp__ssh-tools__ssh_exec' || name === 'ssh_exec') {
        if (input.command) {
            return input.command;
        }
    }
    // 其他工具显示完整参数
    return JSON.stringify(input, null, 2);
}

/**
 * 获取工具显示名称
 */
function getToolDisplayName(name) {
    const nameMap = {
        'mcp__ssh-tools__ssh_exec': 'ssh_exec',
        'mcp__ssh-tools__ssh_list': 'ssh_list',
    };
    return nameMap[name] || name;
}

/**
 * 获取工具图标
 */
function getToolIcon(name) {
    const displayName = getToolDisplayName(name);
    if (displayName === 'ssh_exec') return '⚡';
    if (displayName === 'ssh_list') return '📋';
    return '⚙️';
}

/**
 * 合并连续的角标：[1][2][3] → [1-3]
 */
function mergeConsecutiveRefs(text) {
    const pattern = /(<span class="tool-ref">\d+<\/span>)+/g;

    return text.replace(pattern, (match) => {
        const nums = [];
        match.replace(/<span class="tool-ref">(\d+)<\/span>/g, (_, num) => {
            nums.push(parseInt(num));
        });

        if (nums.length === 1) {
            return `<span class="tool-ref">${nums[0]}</span>`;
        }

        // 检查是否连续
        let isConsecutive = true;
        for (let i = 1; i < nums.length; i++) {
            if (nums[i] !== nums[i-1] + 1) {
                isConsecutive = false;
                break;
            }
        }

        if (isConsecutive && nums.length > 2) {
            return `<span class="tool-ref">${nums[0]}-${nums[nums.length-1]}</span>`;
        } else {
            return nums.map(n => `<span class="tool-ref">${n}</span>`).join('');
        }
    });
}

/**
 * 渲染消息内容和工具列表
 */
function renderMessageWithTools(text, tools, isComplete = false) {
    let html = formatResponse(text);
    html = mergeConsecutiveRefs(html);

    if (tools.length > 0) {
        html += '<div class="tool-list">';
        tools.forEach((tool, index) => {
            const displayName = getToolDisplayName(tool.name);
            const icon = getToolIcon(tool.name);
            const params = escapeHtml(formatToolParams(tool.name, tool.input));
            const hasResult = tool.result !== undefined;
            const runningClass = (!isComplete && !hasResult && index === tools.length - 1) ? ' running' : '';
            const resultClass = hasResult ? (tool.isError ? ' has-error' : ' has-result') : '';

            let resultHtml = '';
            if (hasResult) {
                const resultText = tool.result || '(无输出)';
                const truncated = resultText.length > 500 ? resultText.slice(0, 500) + '...' : resultText;
                resultHtml = `<div class="tool-result ${tool.isError ? 'error' : ''}">${escapeHtml(truncated)}</div>`;
            }

            html += `
                <div class="tool-item${runningClass}${resultClass}">
                    <span class="tool-icon">${icon}</span>
                    <div class="tool-tooltip">
                        <div class="tool-name">${displayName}</div>
                        <div class="tool-params">${params || '(无参数)'}</div>
                        ${resultHtml}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    return html;
}

// ============== 对话功能 ==============

/**
 * 更新输入区域的禁用状态
 */
function setInputDisabled(disabled) {
    const input = document.getElementById('chatInput');
    const sendBtn = document.querySelector('.btn-send');
    input.disabled = disabled;
    sendBtn.disabled = disabled;
    if (disabled) {
        input.placeholder = 'Claude 正在响应中...';
        sendBtn.style.opacity = '0.5';
    } else {
        input.placeholder = '输入消息，让 Claude 帮你操作服务器... (Enter 发送，Shift+Enter 换行)';
        sendBtn.style.opacity = '1';
    }
}

/**
 * 发送 Claude 消息（流式）
 */
async function sendMessage() {
    if (isStreaming) return;

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    isStreaming = true;
    setInputDisabled(true);

    input.value = '';
    input.style.height = 'auto';
    const container = document.getElementById('chatContainer');

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    container.innerHTML += `
        <div class="message user">
            <div class="message-content">${escapeHtml(message)}</div>
        </div>
    `;

    const assistantId = 'assistant-' + Date.now();
    container.innerHTML += `
        <div class="message assistant" id="${assistantId}">
            <div class="message-content"><span class="loading"></span></div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;

    const contentEl = document.querySelector(`#${assistantId} .message-content`);
    let fullText = '';
    let tools = [];

    try {
        let fullMessage = message;
        const serverId = getSelectedServerId();
        if (serverId) {
            fullMessage = `[当前选中的服务器: ${serverId}] ${message}`;
        }

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: fullMessage })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let eventType = '';
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    eventType = line.slice(7);
                } else if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    console.log(`[SSE] ${eventType}:`, data);

                    if (eventType === 'content') {
                        fullText += data.text;
                        contentEl.innerHTML = renderMessageWithTools(fullText, tools, false);
                        container.scrollTop = container.scrollHeight;
                    } else if (eventType === 'tool_use') {
                        const toolIndex = tools.length + 1;
                        fullText += `<span class="tool-ref">${toolIndex}</span>`;
                        tools.push({
                            id: data.tool_use_id,
                            name: data.name,
                            input: data.input
                        });
                        contentEl.innerHTML = renderMessageWithTools(fullText, tools, false);
                        container.scrollTop = container.scrollHeight;
                    } else if (eventType === 'tool_result') {
                        const tool = tools.find(t => t.id === data.tool_use_id);
                        if (tool) {
                            tool.result = data.content;
                            tool.isError = data.is_error;
                        }
                        contentEl.innerHTML = renderMessageWithTools(fullText, tools, false);
                        container.scrollTop = container.scrollHeight;
                    } else if (eventType === 'error') {
                        contentEl.innerHTML = `<span style="color: #e74c3c;">错误: ${escapeHtml(data.message)}</span>`;
                    } else if (eventType === 'done') {
                        refreshServers();
                    }
                }
            }
        }

        if (fullText) {
            contentEl.innerHTML = renderMessageWithTools(fullText, tools, true);
        } else if (!contentEl.innerHTML.includes('错误')) {
            contentEl.innerHTML = '<span style="color: #888;">（无响应内容）</span>';
        }

    } catch (err) {
        contentEl.innerHTML = `<span style="color: #e74c3c;">错误: ${escapeHtml(err.message)}</span>`;
    } finally {
        isStreaming = false;
        setInputDisabled(false);
    }

    container.scrollTop = container.scrollHeight;
}

/**
 * 初始化对话相关事件
 */
function initChatEvents() {
    const chatInput = document.getElementById('chatInput');

    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

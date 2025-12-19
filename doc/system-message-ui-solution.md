# REQ-005: 系统消息 UI 化

## 需求背景

当前 Claude SDK 返回的 `SystemMessage` 以及其他未识别的消息类型只在后端日志打印，前端无任何展示。用户无法直观了解会话状态、使用的模型、工具连接情况等信息。

## 需求目标

1. **SystemMessage (init)**：以 UI 形式展示在聊天区，让用户了解：
   - 会话已初始化
   - 当前使用的模型
   - 当前选中的服务器

2. **其他未知消息/Block 类型**：只在服务端打印详细日志（已实现），不推送到前端。后续发现有价值的类型时，再专门实现 UI。

## 调研结果

### SystemMessage 数据结构

```python
{
    'type': 'system',
    'subtype': 'init',
    'cwd': '/Users/.../remote-claude-demo',
    'session_id': 'uuid-string',
    'tools': ['Task', 'Bash', ..., 'mcp__ssh-tools__ssh_exec', 'mcp__ssh-tools__ssh_list'],
    'mcp_servers': [{'name': 'ssh-tools', 'status': 'connected'}],
    'model': 'claude-sonnet-4-...'
}
```

### 有价值的字段

| 字段 | 用户价值 | 是否展示 |
|-----|---------|---------|
| `model` | 当前使用的模型 | ✅ 展示 |
| `mcp_servers` | SSH 工具连接状态 | ✅ 可选展示 |
| `session_id` | 无 | ❌ 不展示 |
| `cwd` | 无 | ❌ 不展示 |
| `tools` | 太长 | ❌ 不展示 |

## 技术方案

### 方案选择：前端拼接（方案 A）

- 后端推送 `system_init` 事件（包含 model 等信息）
- 前端收到后，拼接当前选中的服务器名称
- 在聊天区顶部显示系统提示条

### 数据流

```
后端                                    前端
  │                                       │
  │  SystemMessage (init)                 │
  │  ─────────────────────>               │
  │                                       │
  │  SSE: event: system_init              │
  │  data: {model, mcp_servers}           │
  │  ─────────────────────>               │
  │                                       │  拼接 selectedServer
  │                                       │  渲染系统提示条
  │                                       ▼
```

### 后端改动

**文件：`claude/client.py`**

在 `_run_query_sync` 方法中，处理 `SystemMessage (init)`：

```python
# 在 else 分支（Unknown message）中添加处理
if msg_type == "SystemMessage":
    data = getattr(msg, 'data', {})
    if isinstance(data, dict) and data.get('subtype') == 'init':
        result_queue.put({
            "type": "system_init",
            "data": {
                "model": data.get('model', 'unknown'),
                "mcp_servers": data.get('mcp_servers', [])
            }
        })
    # 其他 subtype 只打印日志，不推送前端（已有日志逻辑）
```

> 注：其他未知消息类型保持现有的日志打印逻辑，不推送到前端。

**文件：`app.py`**

在 `/api/chat/stream` 路由中，处理 `system_init` 事件：

```python
elif event["type"] == "system_init":
    yield f"event: system_init\ndata: {json.dumps(event['data'])}\n\n"
```

### 前端改动

**文件：`static/js/chat.js`**

1. 在 `sendMessage` 函数的 SSE 处理中，添加 `system_init` 事件处理：

```javascript
case 'system_init':
    // 获取当前选中的服务器
    const selectedServer = window.selectedServer || '未选择';
    const modelName = data.model ? data.model.split('-').slice(0, 2).join('-') : 'unknown';

    // 在聊天区顶部显示系统提示
    showSystemBanner(`🤖 会话已初始化 · 模型: ${modelName} · 当前服务器: ${selectedServer}`);
    break;
```

2. 添加 `showSystemBanner` 函数：

```javascript
function showSystemBanner(text) {
    const chatMessages = document.getElementById('chatMessages');

    // 移除旧的 banner（如果有）
    const oldBanner = chatMessages.querySelector('.system-banner');
    if (oldBanner) oldBanner.remove();

    // 创建新 banner
    const banner = document.createElement('div');
    banner.className = 'system-banner';
    banner.textContent = text;

    // 插入到聊天区最前面
    chatMessages.insertBefore(banner, chatMessages.firstChild);
}
```

**文件：`static/css/styles.css`**

添加系统提示条样式：

```css
.system-banner {
    background: linear-gradient(135deg, #e8f4f8 0%, #f0f7fa 100%);
    border: 1px solid #b8d4e3;
    border-radius: 8px;
    padding: 8px 16px;
    margin-bottom: 16px;
    font-size: 13px;
    color: #4a6d7c;
    text-align: center;
}
```

## UI 效果

```
┌─────────────────────────────────────────────────────────┐
│  🤖 会话已初始化 · 模型: claude-sonnet · 当前服务器: pkg  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [用户消息]                                               │
│ 帮我查看服务器状态                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [AI 消息]                                                │
│ 好的，让我帮你查看...                                     │
└─────────────────────────────────────────────────────────┘
```

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|-----|---------|------|
| `claude/client.py` | 修改 | 处理 SystemMessage (init)，推送 system_init 事件 |
| `app.py` | 修改 | SSE 路由增加 system_init 事件处理 |
| `static/js/chat.js` | 修改 | 接收 system_init 事件，渲染系统提示条 |
| `static/css/styles.css` | 修改 | 添加 .system-banner 样式 |

## 后续扩展

当通过服务端日志发现某个未知类型频繁出现且有价值时，可以：
1. 在后端为其创建专门的事件类型
2. 在前端添加专门的 UI 渲染逻辑

## 验收标准

1. 发送第一条消息后，聊天区顶部显示系统提示条
2. 提示条显示正确的模型名称（如 claude-sonnet）
3. 提示条显示当前选中的服务器名称
4. 如果没有选中服务器，显示"未选择"

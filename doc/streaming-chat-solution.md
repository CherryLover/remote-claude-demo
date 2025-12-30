# 流式对话响应技术方案

## 背景

当前 `/api/chat` API 是等待 Claude 完整响应后才返回，用户在等待期间只能看到 "Claude 正在思考..." 的提示，体验不佳。需要改为流式返回，让用户实时看到 Claude 的响应内容。

## 技术方案

采用 **Server-Sent Events (SSE)** 方案实现流式响应。

### 为什么选择 SSE

| 方案 | 优点 | 缺点 |
|------|------|------|
| **SSE** | 实现简单、HTTP 原生支持、浏览器自动重连、适合单向流 | 仅支持单向通信 |
| WebSocket | 双向通信、低延迟 | 实现复杂、需要连接管理、对于单向流过度设计 |

当前场景是典型的单向流（用户发问 → Claude 逐步回复），SSE 完全满足需求。

---

## 实现功能清单

### 1. 基础流式响应
- 文本内容逐字显示，用户可实时看到 Claude 的回复
- 使用 `fetch` + `ReadableStream` 处理 SSE 流

### 2. 工具调用可视化
- **文本标记**：工具调用位置显示上标角标 `[1]` `[2]` `[3]`
- **连续合并**：连续 3 个及以上角标自动合并为 `[1-3]` 格式
- **工具列表**：消息气泡下方显示工具图标列表
  - ⚡ = `ssh_exec`
  - 📋 = `ssh_list`
  - ⚙️ = 其他工具
- **悬停详情**：鼠标悬停显示工具名称、执行参数、执行结果
- **状态指示**：
  - 执行中：呼吸动画效果
  - 执行成功：绿色边框
  - 执行失败：红色边框

### 3. 工具执行结果
- 后端解析 `ToolResultBlock` 获取执行结果
- 通过 `tool_result` SSE 事件推送到前端
- 使用 `tool_use_id` 匹配工具调用和结果
- 悬停工具图标时显示完整输出（截断至 500 字符）

### 4. 发送状态控制
- 流式响应期间禁止发送新消息
- 输入框和发送按钮置灰禁用
- placeholder 显示「Claude 正在响应中...」
- 响应完成后自动恢复

---

## 架构设计

### 数据流

```
用户输入 → POST /api/chat/stream → Claude SDK (async generator)
                                          ↓
                                    yield 事件
                                          ↓
                              StreamingResponse (SSE)
                                          ↓
                              fetch + ReadableStream (前端)
                                          ↓
                                    实时更新 UI
```

### SSE 事件类型

| 事件类型 | 说明 | data 格式 |
|---------|------|-----------|
| `content` | 文本内容片段 | `{"text": "..."}` |
| `tool_use` | Claude 调用工具 | `{"tool_use_id": "...", "name": "ssh_exec", "input": {...}}` |
| `tool_result` | 工具执行结果 | `{"tool_use_id": "...", "content": "...", "is_error": false}` |
| `done` | 响应完成 | `{"status": "completed"}` |
| `error` | 发生错误 | `{"message": "..."}` |

---

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `app.py` | 新增 `/api/chat/stream` 端点，处理 SSE 流式响应 |
| `claude/client.py` | 添加 `UserMessage` 和 `ToolResultBlock` 处理，提取工具执行结果 |
| `static/index.html` | 重写 `sendMessage()` 函数，添加工具可视化样式和交互逻辑 |

---

## 关键代码说明

### 后端 - 工具结果提取 (`claude/client.py`)

```python
elif isinstance(msg, UserMessage):
    for block in msg.content:
        if isinstance(block, ToolResultBlock):
            content = ""
            if isinstance(block.content, list):
                for item in block.content:
                    if isinstance(item, dict):
                        content += item.get("text", "")
            result_queue.put({
                "type": "tool_result",
                "data": {
                    "tool_use_id": block.tool_use_id,
                    "content": content,
                    "is_error": block.is_error,
                },
            })
```

### 前端 - 连续角标合并

```javascript
function mergeConsecutiveRefs(text) {
    const pattern = /(<span class="tool-ref">\d+<\/span>)+/g;
    return text.replace(pattern, (match) => {
        const nums = [];
        match.replace(/<span class="tool-ref">(\d+)<\/span>/g, (m, num) => {
            nums.push(parseInt(num));
        });
        if (nums.length > 2) {
            // 检查是否连续
            let isConsecutive = true;
            for (let i = 1; i < nums.length; i++) {
                if (nums[i] !== nums[i-1] + 1) {
                    isConsecutive = false;
                    break;
                }
            }
            if (isConsecutive) {
                return `<span class="tool-ref">${nums[0]}-${nums[nums.length-1]}</span>`;
            }
        }
        return nums.map(n => `<span class="tool-ref">${n}</span>`).join('');
    });
}
```

---

## 调试功能

### 后端日志 (`claude/client.py`)
打印所有 SDK 消息类型和内容块：
```
[SDK] Message: AssistantMessage
  [SDK] Block: TextBlock
    [SDK] TextBlock: 你好...
  [SDK] Block: ToolUseBlock
    [SDK] ToolUseBlock: name=ssh_exec, id=toolu_xxx
[SDK] Message: UserMessage
  [SDK] Block: ToolResultBlock
    [SDK] ToolResultBlock: tool_use_id=toolu_xxx, is_error=False
```

### 前端日志 (浏览器控制台)
打印所有 SSE 事件：
```
[SSE] content: {text: "你好..."}
[SSE] tool_use: {tool_use_id: "...", name: "ssh_exec", input: {...}}
[SSE] tool_result: {tool_use_id: "...", content: "...", is_error: false}
[SSE] done: {status: "completed"}
```

---

## 兼容性说明

- **浏览器**：现代浏览器均支持 `fetch` + `ReadableStream`（Chrome 43+, Firefox 65+, Safari 10.1+）
- **保留原 API**：原 `/api/chat` 端点保留不变，可用于非浏览器客户端或调试

---

## 效果预览

```
┌──────────────────────────────────────────────────────┐
│ 我来检查一下系统状态[1-4]                              │
│                                                      │
│ 服务器运行正常，这是详细信息：                          │
│ - 系统：Ubuntu 22.04                                  │
│ - CPU：Intel Xeon E5-2680                            │
│ - 内存：957Mi (已用 185Mi)                            │
│ - 磁盘：23G (已用 40%)                                │
│ ──────────────────────────────────────────────────── │
│ ⚡  ⚡  ⚡  📋     ← 鼠标悬停显示详情                   │
└──────────────────────────────────────────────────────┘
```

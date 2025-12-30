# Chat UI 增强方案

## 背景

用户在最近一次需求讨论中提出了以下改进点：

1. 消息发送后需要提供“手动停止”能力，以便中断长时间的流式响应。
2. 对话气泡宽度过大，影响阅读体验，希望根据内容长度自适应，但仍保留最大宽度。
3. Web 端尚未渲染 Markdown，代码块、列表、标题等格式无法直接查看。

## 目标

- 在前端聊天输入区加入“停止”按钮，与流式响应状态联动，支持手动终止 SSE。
- 调整消息气泡布局，短文本时缩短宽度，长文本保留上限，兼容两端（用户/助手）。
- 引入可靠的 Markdown 渲染方案（本地 `marked`），并强化样式以适配常见 Markdown 元素。

## 技术方案

### 停止按钮

- 在 `static/index.html` 中新增 `btn-stop`，默认禁用；当流式请求进行中启用。
- 使用 `AbortController`，记录 `currentStreamController` 和 `manualStopRequested`。
- `stopStreaming()` 调用 `abort()`，捕获 `AbortError` 后展示“响应已被手动停止”提示。

### 消息气泡自适应

- 将 `.message` 改为 `display: flex`，区分 `user` 与 `assistant` 方向。
- `.message-content` 使用 `inline-block` 并设置 `max-width: min(620px, 72vw)`，通过内容宽度自动收缩。
- 为 Markdown 元素（段落、列表、标题、代码块）补充样式，保证渲染效果。

### Markdown 渲染

- 引入 `static/js/lib/marked.min.js`（通过 CDN 下载的本地文件）。
- 在 `utils.js` 中初始化 `marked`，`formatResponse` 先转义再交给 `marked.parse`，同时保护工具角标标签。
- 聊天内容（用户、助手）均统一调用 `formatResponse`，从而保留换行、代码块等格式。

## 测试点

1. 手动发送长任务后点击“停止”，输入框与按钮状态恢复正常，并出现提示文案。
2. 输入短语（如“好的”）和长段 Markdown（代码块、列表）分别验证气泡宽度变化。
3. 发送 Markdown 文本，确认标题、列表、`inline code`、```代码块``` 正常渲染。
4. 浏览器缓存清空后再次访问，`marked` 正常加载；无脚本时退化处理仍能展示基本换行。

## 后续

- 可考虑在停止后自动保留未完成内容的“继续”操作。
- Markdown 渲染已具雏形，后续可以补齐表格、脚注等样式需求。

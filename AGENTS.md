请用中文回复


## 项目概述

基于 Claude Agent SDK 的远程服务器管理 Web 服务。用户通过自然语言与 Claude 对话来管理多台 SSH 服务器。

## 常用命令

```bash
# 安装依赖
pip install -r requirements.txt

# 运行服务 (端口 8000)
python app.py

# 需要配置环境变量 ANTHROPIC_API_KEY
```

## 架构

```
app.py                 # FastAPI 入口，定义所有 API 路由
models.py              # Pydantic 请求模型
config/
  claude_config.py     # ClaudeConfigManager - Claude 配置管理（三级优先级）
claude/
  client.py            # ClaudeSessionClient - Claude SDK 封装
ssh/
  manager.py           # SSHConnectionManager - SSH 连接管理
  tools.py             # MCP 工具定义 (ssh_exec, ssh_list)
static/
  index.html           # Web UI 入口
  css/
    styles.css         # 全局样式
  js/
    utils.js           # 通用工具函数
    ssh.js             # SSH 服务器管理
    chat.js            # Claude 对话
    config.js          # Claude 配置管理
    main.js            # 入口和初始化
doc/
  requirements-pool.md # 需求池
  *.md                 # 技术方案文档
```

### 核心设计

**异步混合处理**: Claude SDK 运行在独立线程中，通过 `queue.Queue` 与 FastAPI 异步上下文通信，避免嵌套事件循环问题。

**MCP 工具系统**: 使用 `claude_agent_sdk` 的 `@tool` 装饰器定义工具，通过 `create_sdk_mcp_server` 创建 MCP 服务器供 Claude 调用。

### API 路由

- `GET /` - Web UI
- `POST /api/ssh/connect` - 新建 SSH 连接
- `POST /api/ssh/connect/{host_id}` - 使用已保存配置连接
- `POST /api/ssh/disconnect/{host_id}` - 断开连接
- `DELETE /api/ssh/config/{host_id}` - 删除配置
- `GET /api/ssh/list` - 列出所有服务器
- `POST /api/ssh/exec` - 执行命令
- `POST /api/chat` - Claude 对话（普通）
- `POST /api/chat/stream` - Claude 对话（SSE 流式）
- `GET /api/claude/config` - 获取 Claude 配置（脱敏）
- `POST /api/claude/config` - 设置 Claude 配置
- `DELETE /api/claude/config` - 清除 Web 配置

### 数据持久化

SSH 服务器配置保存在 `ssh_configs.json`，包含 host、username、password、port。

Claude 配置保存在 `claude_config.json`，支持三级优先级：Web 配置 > 项目 .env > 系统环境变量。

### 前端对话体验

- 聊天区提供“停止”按钮，通过 `AbortController` 中断流式响应，并提示“响应已被手动停止”。
- 用户与助手消息统一使用 `formatResponse` + `marked` 进行 Markdown 渲染；支持代码块、列表、标题等。
- 消息气泡由 `flex` 布局 + `inline-block` 控制宽度，短文本可自适应收缩，最长不超过 `min(620px, 72vw)`。

## 开发流程

功能开发遵循以下流程：

1. **创建需求** - 在 `doc/requirements-pool.md` 中新增需求条目
2. **讨论细节** - 与用户确认需求范围、技术方案、优先级等
3. **写文档** - 在 `doc/` 下创建技术方案文档（如 `xxx-solution.md`）
4. **确认文档** - 用户审阅并确认方案
5. **写代码** - 按文档实现功能
6. **用户验收** - 用户测试验证功能
7. **更新文档** - 根据实际实现更新 CLAUDE.md 和方案文档
8. **更新需求池** - 将需求状态改为"已完成"


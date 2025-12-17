# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
claude/
  client.py            # ClaudeSessionClient - Claude SDK 封装
ssh/
  manager.py           # SSHConnectionManager - SSH 连接管理
  tools.py             # MCP 工具定义 (ssh_exec, ssh_list)
static/
  index.html           # Web UI
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
- `POST /api/chat` - Claude 对话

### 数据持久化

SSH 服务器配置保存在 `ssh_configs.json`，包含 host、username、password、port。

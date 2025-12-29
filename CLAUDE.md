# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Claude Agent SDK 的远程服务器管理桌面应用。用户通过自然语言与 Claude 对话来管理多台 SSH 服务器。

技术栈：Electron + React + Vite + @anthropic-ai/claude-agent-sdk

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式运行
npm run electron:dev

# 构建应用
npm run electron:build

# 需要在 .env 中配置 ANTHROPIC_API_KEY
```

## 架构

```
electron/
  main.cjs             # Electron 主进程入口
  preload.cjs          # 预加载脚本，暴露 API 给渲染进程
  services/
    claude.mjs         # Claude Agent SDK 服务，含 SSH MCP 工具
    ssh.cjs            # SSH 连接管理服务 (ssh2)
src/
  App.jsx              # React 主组件
  components/
    Chat/              # 聊天相关组件
      ChatArea.jsx     # 聊天区域
      ChatInput.jsx    # 输入框
      MessageItem.jsx  # 消息项
    Terminal/
      TerminalPanel.jsx  # 终端面板
    Settings/
      SettingsModal.jsx  # 设置弹窗
      AddServerModal.jsx # 添加服务器弹窗
    ServerManager.jsx  # 服务器列表管理
    ConfigPanel.jsx    # Claude 配置面板
    Sidebar.jsx        # 侧边栏
  utils/
    api.js             # API 适配层（支持 Electron/Web）
  index.css            # 全局样式
doc/
  requirements-pool.md # 需求池
  *.md                 # 技术方案文档
```

### 核心设计

**Electron 架构**:
- 主进程 (`main.cjs`) 负责窗口管理和 IPC 处理
- 预加载脚本 (`preload.cjs`) 安全地暴露 API 给渲染进程
- 渲染进程 (React) 通过 `window.electronAPI` 与主进程通信

**Claude Agent SDK 集成**:
- 使用 `@anthropic-ai/claude-agent-sdk` 的 `query` 函数
- 通过 `createSdkMcpServer` 创建自定义 SSH 工具
- 支持流式响应，通过 IPC 事件传递消息

**SSH 连接管理**:
- 使用 `ssh2` 库管理 SSH 连接
- 配置保存在用户数据目录 (`app.getPath('userData')`)
- 支持密码保存和自动重连

### IPC 通道

**Claude 相关**:
- `claude:chat` - 发送消息
- `claude:stream` - 流式响应事件
- `claude:stop` - 停止对话
- `claude:clearSession` - 清除会话
- `claude:getConfig` / `claude:setConfig` - 配置管理

**SSH 相关**:
- `ssh:connect` - 新建连接
- `ssh:reconnect` - 使用保存的配置重连
- `ssh:disconnect` - 断开连接
- `ssh:deleteConfig` - 删除配置
- `ssh:exec` - 执行命令
- `ssh:list` - 列出服务器

### MCP 工具

Claude 可以使用以下 SSH 工具：

- `mcp__ssh-tools__ssh_exec` - 在远程服务器执行命令
- `mcp__ssh-tools__ssh_list` - 列出所有服务器及状态

### 数据持久化

SSH 配置保存在 `{userData}/ssh_configs.json`，包含 host、username、password、port。

### 环境变量

从项目根目录的 `.env` 文件加载：
- `ANTHROPIC_API_KEY` - Claude API 密钥
- `ANTHROPIC_BASE_URL` - API 地址（可选，用于代理）

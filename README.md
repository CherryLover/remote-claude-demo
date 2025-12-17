# Remote Claude Demo

基于 Claude Agent SDK 的远程服务器管理 Web 服务。通过自然语言与 Claude 对话，管理多台 SSH 服务器。

## 功能特性

- Web UI 管理多个 SSH 服务器连接
- 通过自然语言指令执行远程命令
- 使用 Claude Agent SDK 提供智能交互
- 支持服务器配置持久化

## 技术栈

- **后端**: FastAPI + Uvicorn
- **AI**: Claude Agent SDK
- **SSH**: Paramiko
- **前端**: 原生 HTML/CSS/JavaScript

## 安装

1. 克隆仓库

```bash
git clone https://github.com/CherryLover/remote-claude-demo.git
cd remote-claude-demo
```

2. 创建虚拟环境

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# 或 .venv\Scripts\activate  # Windows
```

3. 安装依赖

```bash
pip install -r requirements.txt
```

4. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置 ANTHROPIC_API_KEY
```

## 运行

```bash
python app.py
```

服务启动后访问 http://localhost:8000

## 使用方法

1. 在左侧面板添加 SSH 服务器配置
2. 点击连接按钮建立 SSH 连接
3. 在右侧对话框与 Claude 交互，执行远程命令

## 许可证

MIT

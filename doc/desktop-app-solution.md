# 桌面应用技术方案

## 概述

将当前 Web 应用打包为桌面应用，使用 PyWebView 方案。

## 技术选型

**选定方案**: PyWebView

**原因**:
- 现有代码改动最小
- 与 Python 技术栈一致
- 轻量（使用系统原生 WebView）
- 打包简单（PyInstaller）

## 实现原理

```
┌─────────────────────────────────────────────┐
│              桌面应用窗口                      │
│  ┌───────────────────────────────────────┐  │
│  │         PyWebView (原生窗口)            │  │
│  │                                       │  │
│  │    加载 http://127.0.0.1:{port}       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    ↓ 请求
┌─────────────────────────────────────────────┐
│     FastAPI Server (后台线程运行)             │
│     - SSH 管理                              │
│     - Claude SDK                           │
└─────────────────────────────────────────────┘
```

## 基础实现代码

```python
import webview
import threading
import uvicorn
from app import app

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

if __name__ == '__main__':
    # 1. 后台启动 FastAPI
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # 2. 创建原生窗口加载页面
    webview.create_window(
        title='Remote Claude',
        url='http://127.0.0.1:8000',
        width=1200,
        height=800
    )
    webview.start()
```

## 依赖

```
pywebview
pyinstaller  # 打包用
```

## 安全增强方案（可选）

### 方案 1：随机端口

防止用户通过浏览器直接访问。

```python
import socket

def get_free_port():
    with socket.socket() as s:
        s.bind(('', 0))
        return s.getsockname()[1]

port = get_free_port()  # 随机端口如 52341
uvicorn.run(app, port=port)
webview.create_window('Remote Claude', f'http://127.0.0.1:{port}')
```

### 方案 2：Token 验证

通过中间件验证请求来源。

```python
import secrets
from fastapi.responses import JSONResponse

TOKEN = secrets.token_urlsafe(32)

@app.middleware("http")
async def check_token(request, call_next):
    if request.headers.get("X-App-Token") != TOKEN:
        return JSONResponse(status_code=403, content={"error": "Forbidden"})
    return await call_next(request)
```

### 方案 3：本地文件加载

完全绕过 HTTP，使用 PyWebView 的 JS-Python 桥接。

```python
webview.create_window('Remote Claude', 'static/index.html')
```

需要改造前端，用 `window.pywebview.api` 替代 fetch 调用。

## 打包命令

```bash
# macOS
pyinstaller --onefile --windowed --name "RemoteClaude" main_desktop.py

# Windows
pyinstaller --onefile --windowed --icon=icon.ico --name "RemoteClaude" main_desktop.py
```

## 备选方案对比

| 方案 | 打包体积 | 改动量 | 跨平台一致性 |
|------|---------|--------|-------------|
| PyWebView | 小 | 最小 | 一般 |
| Electron | 大(150MB+) | 中 | 好 |
| Tauri | 小(10MB) | 中 | 好 |
| PySide6 | 中 | 大(重写前端) | 好 |

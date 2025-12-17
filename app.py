#!/usr/bin/env python3
"""
Remote Claude Service - 使用 Claude Agent SDK 的独立 Web 服务
采用线程隔离 + 队列通信模式，避免异步嵌套问题
"""

import os
import json
import asyncio
import queue
import threading
from typing import Any, Optional, AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import paramiko
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
)

load_dotenv()


# ============ 配置文件路径 ============
CONFIG_FILE = Path(__file__).parent / "ssh_configs.json"


# ============ SSH 连接管理器 ============
class SSHConnectionManager:
    """管理多个 SSH 连接和配置持久化"""

    def __init__(self):
        self.connections: dict[str, paramiko.SSHClient] = {}
        self.configs: dict[str, dict] = {}
        self._load_configs()

    def _load_configs(self):
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    self.configs = json.load(f)
            except Exception:
                self.configs = {}

    def _save_configs(self):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.configs, f, ensure_ascii=False, indent=2)

    def connect(self, host_id: str, host: str, username: str,
                password: str = None, port: int = 22) -> str:
        if host_id in self.connections:
            return f"主机 {host_id} 已经连接"

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(host, port=port, username=username, password=password, timeout=10)
            self.connections[host_id] = client
            self.configs[host_id] = {
                "host": host,
                "username": username,
                "password": password,
                "port": port
            }
            self._save_configs()
            return f"已成功连接到 {host_id} ({username}@{host}:{port})"
        except Exception as e:
            raise Exception(f"连接失败: {str(e)}")

    def connect_by_id(self, host_id: str) -> str:
        if host_id not in self.configs:
            raise Exception(f"未找到配置: {host_id}")
        if host_id in self.connections:
            return f"主机 {host_id} 已经连接"
        config = self.configs[host_id]
        return self.connect(
            host_id=host_id,
            host=config["host"],
            username=config["username"],
            password=config.get("password"),
            port=config.get("port", 22)
        )

    def execute(self, host_id: str, command: str, timeout: int = 30) -> dict:
        if host_id not in self.connections:
            raise Exception(f"主机 {host_id} 未连接，请先点击连接按钮")
        client = self.connections[host_id]
        try:
            stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
            return {
                "stdout": stdout.read().decode('utf-8'),
                "stderr": stderr.read().decode('utf-8'),
                "exit_code": stdout.channel.recv_exit_status()
            }
        except Exception as e:
            raise Exception(f"执行命令失败: {str(e)}")

    def disconnect(self, host_id: str) -> str:
        if host_id not in self.connections:
            return f"主机 {host_id} 未连接"
        self.connections[host_id].close()
        del self.connections[host_id]
        return f"已断开与 {host_id} 的连接"

    def delete_config(self, host_id: str) -> str:
        if host_id in self.connections:
            self.connections[host_id].close()
            del self.connections[host_id]
        if host_id in self.configs:
            del self.configs[host_id]
            self._save_configs()
            return f"已删除配置: {host_id}"
        return f"配置不存在: {host_id}"

    def list_all(self) -> list[dict]:
        result = []
        for host_id, config in self.configs.items():
            result.append({
                "id": host_id,
                "host": config["host"],
                "username": config["username"],
                "port": config.get("port", 22),
                "connected": host_id in self.connections
            })
        return result

    def list_connected(self) -> list[dict]:
        return [item for item in self.list_all() if item["connected"]]

    def close_all(self):
        for client in self.connections.values():
            client.close()
        self.connections.clear()


# 全局 SSH 管理器
ssh_manager = SSHConnectionManager()


# ============ 自定义 SSH 工具 ============

@tool("ssh_exec", "在已连接的远程服务器上执行 Shell 命令", {"host_id": str, "command": str})
async def ssh_exec(args: dict[str, Any]) -> dict[str, Any]:
    try:
        result = ssh_manager.execute(args["host_id"], args["command"])
        output = f"Exit Code: {result['exit_code']}\n"
        if result['stdout'].strip():
            output += f"--- STDOUT ---\n{result['stdout']}"
        if result['stderr'].strip():
            output += f"--- STDERR ---\n{result['stderr']}"
        return {"content": [{"type": "text", "text": output}]}
    except Exception as e:
        return {"content": [{"type": "text", "text": f"错误: {str(e)}"}], "is_error": True}


@tool("ssh_list", "列出所有当前已连接的 SSH 服务器", {})
async def ssh_list(args: dict[str, Any]) -> dict[str, Any]:
    connections = ssh_manager.list_connected()
    if not connections:
        return {"content": [{"type": "text", "text": "当前没有活跃的 SSH 连接。请先在左侧面板添加服务器。"}]}
    lines = ["当前活跃的 SSH 连接:"]
    for conn in connections:
        lines.append(f"  - {conn['id']}: {conn['username']}@{conn['host']}:{conn['port']}")
    return {"content": [{"type": "text", "text": "\n".join(lines)}]}


# 创建 MCP 服务器
ssh_mcp_server = create_sdk_mcp_server(
    name="ssh-tools",
    version="1.0.0",
    tools=[ssh_exec, ssh_list]
)


# ============ Claude Session Client (线程隔离模式) ============

class ClaudeSessionClient:
    """
    单个会话的 Claude Client 封装
    使用独立线程运行 Claude SDK，通过队列传递消息，
    避免 FastAPI 异步上下文中的嵌套问题
    """

    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._client: Optional[ClaudeSDKClient] = None
        self._context_manager = None
        self._started = threading.Event()
        self._stop_event = threading.Event()

    def _create_options(self) -> ClaudeAgentOptions:
        system_prompt = """你是一个远程服务器管理助手。用户已经通过 Web UI 添加了一些 SSH 服务器连接。

你可以使用以下工具：
- ssh_list: 查看当前已连接的服务器列表
- ssh_exec: 在指定服务器上执行命令 (参数: host_id, command)

使用流程：
1. 先用 ssh_list 查看有哪些服务器可用
2. 然后用 ssh_exec 在指定服务器上执行命令

请帮助用户安全、高效地管理他们的远程服务器。用中文回复。"""

        return ClaudeAgentOptions(
            mcp_servers={"ssh-tools": ssh_mcp_server},
            allowed_tools=[
                "mcp__ssh-tools__ssh_exec",
                "mcp__ssh-tools__ssh_list",
            ],
            permission_mode="acceptEdits",
            system_prompt=system_prompt,
        )

    def _run_event_loop(self):
        """在独立线程中运行事件循环"""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        async def setup_client():
            options = self._create_options()
            self._context_manager = ClaudeSDKClient(options=options)
            self._client = await self._context_manager.__aenter__()

        try:
            self._loop.run_until_complete(setup_client())
            self._started.set()

            # 保持事件循环运行
            while not self._stop_event.is_set():
                self._loop.run_until_complete(asyncio.sleep(0.1))

        except Exception as e:
            print(f"Event loop error: {e}")
        finally:
            if self._context_manager and self._client:
                try:
                    self._loop.run_until_complete(self._context_manager.__aexit__(None, None, None))
                except Exception:
                    pass
            self._loop.close()

    def _ensure_thread_started(self):
        """确保后台线程已启动"""
        if self._thread is None or not self._thread.is_alive():
            self._stop_event.clear()
            self._started.clear()
            self._thread = threading.Thread(target=self._run_event_loop, daemon=True)
            self._thread.start()
            self._started.wait(timeout=30)

    def _run_query_sync(self, message: str, result_queue: queue.Queue):
        """在后台线程中同步执行查询"""

        async def do_query():
            try:
                await self._client.query(message)

                async for msg in self._client.receive_response():
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if isinstance(block, TextBlock):
                                result_queue.put({
                                    "type": "content",
                                    "data": block.text
                                })
                            elif isinstance(block, ToolUseBlock):
                                result_queue.put({
                                    "type": "tool_use",
                                    "data": {
                                        "tool": block.name,
                                        "input": block.input
                                    }
                                })
                    elif isinstance(msg, ResultMessage):
                        result_queue.put({
                            "type": "done",
                            "data": {"status": "completed"}
                        })
                        break

            except Exception as e:
                result_queue.put({
                    "type": "error",
                    "data": {"message": str(e)}
                })
            finally:
                result_queue.put(None)

        future = asyncio.run_coroutine_threadsafe(do_query(), self._loop)
        future.result()

    async def query(self, message: str) -> AsyncIterator[dict]:
        """发送查询并流式返回结果"""
        self._ensure_thread_started()

        result_queue = queue.Queue()

        query_thread = threading.Thread(
            target=self._run_query_sync,
            args=(message, result_queue),
            daemon=True
        )
        query_thread.start()

        while True:
            try:
                event = result_queue.get(timeout=0.1)
                if event is None:
                    break
                yield event
            except queue.Empty:
                await asyncio.sleep(0.01)

        query_thread.join(timeout=1)

    async def close(self):
        """关闭客户端"""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)


# 全局 Claude 客户端
claude_client: Optional[ClaudeSessionClient] = None


# ============ FastAPI 应用 ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    global claude_client
    claude_client = ClaudeSessionClient()
    yield
    if claude_client:
        await claude_client.close()
    ssh_manager.close_all()


app = FastAPI(title="Remote Claude Service", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============ 请求/响应模型 ============

class SSHConnectRequest(BaseModel):
    host_id: str
    host: str
    username: str
    password: str
    port: int = 22


class SSHExecRequest(BaseModel):
    host_id: str
    command: str


class ChatRequest(BaseModel):
    message: str


# ============ API 路由 ============

@app.get("/")
async def root():
    return FileResponse("static/index.html")


# --- SSH 管理 API ---

@app.post("/api/ssh/connect")
async def api_ssh_connect(req: SSHConnectRequest):
    try:
        result = ssh_manager.connect(
            host_id=req.host_id,
            host=req.host,
            username=req.username,
            password=req.password,
            port=req.port
        )
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ssh/connect/{host_id}")
async def api_ssh_connect_by_id(host_id: str):
    try:
        result = ssh_manager.connect_by_id(host_id)
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ssh/disconnect/{host_id}")
async def api_ssh_disconnect(host_id: str):
    result = ssh_manager.disconnect(host_id)
    return {"success": True, "message": result}


@app.delete("/api/ssh/config/{host_id}")
async def api_ssh_delete_config(host_id: str):
    result = ssh_manager.delete_config(host_id)
    return {"success": True, "message": result}


@app.get("/api/ssh/list")
async def api_ssh_list():
    return {"servers": ssh_manager.list_all()}


@app.post("/api/ssh/exec")
async def api_ssh_exec(req: SSHExecRequest):
    try:
        result = ssh_manager.execute(req.host_id, req.command)
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Claude Chat API ---

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """使用 Claude Agent SDK 处理对话"""
    try:
        response_text = ""

        async for event in claude_client.query(req.message):
            event_type = event["type"]

            if event_type == "content":
                response_text += event["data"]
            elif event_type == "error":
                raise Exception(event["data"]["message"])

        return {"response": response_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude SDK 错误: {str(e)}")


# ============ 启动入口 ============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

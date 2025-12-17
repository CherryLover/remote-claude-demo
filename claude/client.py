"""Claude Agent SDK 客户端封装"""

import asyncio
import queue
import threading
from typing import Optional, AsyncIterator

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ResultMessage,
)

from ssh import ssh_mcp_server


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
                    self._loop.run_until_complete(
                        self._context_manager.__aexit__(None, None, None)
                    )
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
                                result_queue.put({"type": "content", "data": block.text})
                            elif isinstance(block, ToolUseBlock):
                                result_queue.put(
                                    {
                                        "type": "tool_use",
                                        "data": {"tool": block.name, "input": block.input},
                                    }
                                )
                    elif isinstance(msg, ResultMessage):
                        result_queue.put(
                            {"type": "done", "data": {"status": "completed"}}
                        )
                        break

            except Exception as e:
                result_queue.put({"type": "error", "data": {"message": str(e)}})
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
            daemon=True,
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

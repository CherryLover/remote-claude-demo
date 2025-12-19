#!/usr/bin/env python3
"""
Remote Claude Service - 使用 Claude Agent SDK 的独立 Web 服务
"""

import json
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse

from ssh.manager import ssh_manager
from claude import ClaudeSessionClient
from config import claude_config_manager
from models import SSHConnectRequest, SSHExecRequest, ChatRequest, ClaudeConfigRequest

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("remote-claude")

# 全局 Claude 客户端
claude_client: Optional[ClaudeSessionClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global claude_client
    logger.info("正在启动 Remote Claude Service...")
    claude_client = ClaudeSessionClient()
    logger.info("Claude 客户端初始化完成")
    yield
    logger.info("正在关闭服务...")
    if claude_client:
        await claude_client.close()
    ssh_manager.close_all()
    logger.info("服务已关闭")


app = FastAPI(title="Remote Claude Service", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============ API 路由 ============


@app.get("/")
async def root():
    return FileResponse("static/index.html")


# --- SSH 管理 API ---


@app.post("/api/ssh/connect")
async def api_ssh_connect(req: SSHConnectRequest):
    logger.info(f"[SSH] 尝试连接: {req.host_id} ({req.username}@{req.host}:{req.port})")
    try:
        result = ssh_manager.connect(
            host_id=req.host_id,
            host=req.host,
            username=req.username,
            password=req.password,
            port=req.port,
        )
        logger.info(f"[SSH] 连接成功: {req.host_id}")
        return {"success": True, "message": result}
    except Exception as e:
        logger.error(f"[SSH] 连接失败: {req.host_id} - {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ssh/connect/{host_id}")
async def api_ssh_connect_by_id(host_id: str):
    logger.info(f"[SSH] 使用已保存配置连接: {host_id}")
    try:
        result = ssh_manager.connect_by_id(host_id)
        logger.info(f"[SSH] 连接成功: {host_id}")
        return {"success": True, "message": result}
    except Exception as e:
        logger.error(f"[SSH] 连接失败: {host_id} - {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ssh/disconnect/{host_id}")
async def api_ssh_disconnect(host_id: str):
    logger.info(f"[SSH] 断开连接: {host_id}")
    result = ssh_manager.disconnect(host_id)
    return {"success": True, "message": result}


@app.delete("/api/ssh/config/{host_id}")
async def api_ssh_delete_config(host_id: str):
    logger.info(f"[SSH] 删除配置: {host_id}")
    result = ssh_manager.delete_config(host_id)
    return {"success": True, "message": result}


@app.get("/api/ssh/list")
async def api_ssh_list():
    return {"servers": ssh_manager.list_all()}


@app.post("/api/ssh/exec")
async def api_ssh_exec(req: SSHExecRequest):
    logger.info(f"[SSH] 执行命令: {req.host_id} -> {req.command[:50]}{'...' if len(req.command) > 50 else ''}")
    try:
        result = ssh_manager.execute(req.host_id, req.command)
        logger.info(f"[SSH] 命令执行完成: {req.host_id}, exit_code={result.get('exit_code', 'N/A')}")
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"[SSH] 命令执行失败: {req.host_id} - {e}")
        raise HTTPException(status_code=400, detail=str(e))


# --- Claude Chat API ---


@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """使用 Claude Agent SDK 处理对话（非流式，保留用于兼容）"""
    logger.info(f"[Chat] 收到消息: {req.message[:80]}{'...' if len(req.message) > 80 else ''}")
    try:
        response_text = ""

        async for event in claude_client.query(req.message):
            event_type = event["type"]

            if event_type == "content":
                response_text += event["data"]
            elif event_type == "tool_use":
                logger.info(f"[Chat] Claude 使用工具: {event.get('data', {}).get('name', 'unknown')}")
            elif event_type == "error":
                raise Exception(event["data"]["message"])

        logger.info(f"[Chat] 响应完成，长度: {len(response_text)} 字符")
        return {"response": response_text}

    except Exception as e:
        logger.error(f"[Chat] 错误: {e}")
        raise HTTPException(status_code=500, detail=f"Claude SDK 错误: {str(e)}")


@app.post("/api/chat/stream")
async def api_chat_stream(req: ChatRequest):
    """使用 SSE 流式返回 Claude 响应"""
    logger.info(f"[Chat/Stream] 收到消息: {req.message[:80]}{'...' if len(req.message) > 80 else ''}")

    async def event_generator():
        try:
            async for event in claude_client.query(req.message):
                event_type = event["type"]

                if event_type == "content":
                    data = json.dumps({"text": event["data"]}, ensure_ascii=False)
                    yield f"event: content\ndata: {data}\n\n"

                elif event_type == "tool_use":
                    tool_data = event.get("data", {})
                    logger.info(f"[Chat/Stream] Claude 使用工具: {tool_data.get('tool', 'unknown')}")
                    data = json.dumps({
                        "tool_use_id": tool_data.get("tool_use_id"),
                        "name": tool_data.get("tool"),
                        "input": tool_data.get("input")
                    }, ensure_ascii=False)
                    yield f"event: tool_use\ndata: {data}\n\n"

                elif event_type == "tool_result":
                    result_data = event.get("data", {})
                    data = json.dumps({
                        "tool_use_id": result_data.get("tool_use_id"),
                        "content": result_data.get("content", ""),
                        "is_error": result_data.get("is_error", False),
                    }, ensure_ascii=False)
                    yield f"event: tool_result\ndata: {data}\n\n"

                elif event_type == "system_init":
                    init_data = event.get("data", {})
                    logger.info(f"[Chat/Stream] 会话初始化: model={init_data.get('model', 'unknown')}")
                    data = json.dumps(init_data, ensure_ascii=False)
                    yield f"event: system_init\ndata: {data}\n\n"

                elif event_type == "done":
                    yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"

                elif event_type == "error":
                    data = json.dumps({"message": event["data"]["message"]}, ensure_ascii=False)
                    yield f"event: error\ndata: {data}\n\n"

            logger.info("[Chat/Stream] 响应完成")

        except Exception as e:
            logger.error(f"[Chat/Stream] 错误: {e}")
            data = json.dumps({"message": str(e)}, ensure_ascii=False)
            yield f"event: error\ndata: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# --- Claude Config API ---


@app.get("/api/claude/config")
async def api_get_claude_config():
    """获取 Claude 配置（脱敏）"""
    return claude_config_manager.get_masked_config()


@app.post("/api/claude/config")
async def api_set_claude_config(req: ClaudeConfigRequest):
    """设置 Claude 配置"""
    global claude_client

    logger.info("[Config] 更新 Claude 配置")
    claude_config_manager.set_config(
        api_key=req.api_key,
        base_url=req.base_url
    )

    # 关闭当前会话，下次对话时会自动重建
    if claude_client:
        await claude_client.close()
        claude_client = ClaudeSessionClient()
        logger.info("[Config] Claude 客户端已重建")

    return {"status": "ok", "message": "配置已保存并生效"}


@app.delete("/api/claude/config")
async def api_clear_claude_config():
    """清除 Claude Web 配置"""
    global claude_client

    logger.info("[Config] 清除 Claude Web 配置")
    claude_config_manager.clear_config()

    # 重建客户端以使用新的配置源
    if claude_client:
        await claude_client.close()
        claude_client = ClaudeSessionClient()
        logger.info("[Config] Claude 客户端已重建")

    return {"status": "ok", "message": "配置已清除"}


# ============ 启动入口 ============
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

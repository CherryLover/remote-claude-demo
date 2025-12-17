#!/usr/bin/env python3
"""
Remote Claude Service - 使用 Claude Agent SDK 的独立 Web 服务
"""

from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from ssh.manager import ssh_manager
from claude import ClaudeSessionClient
from models import SSHConnectRequest, SSHExecRequest, ChatRequest

load_dotenv()

# 全局 Claude 客户端
claude_client: Optional[ClaudeSessionClient] = None


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
            port=req.port,
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

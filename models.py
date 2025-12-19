"""Pydantic 请求/响应模型"""

from typing import Optional
from pydantic import BaseModel


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


class ClaudeConfigRequest(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None

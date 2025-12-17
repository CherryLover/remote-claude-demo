"""Pydantic 请求/响应模型"""

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

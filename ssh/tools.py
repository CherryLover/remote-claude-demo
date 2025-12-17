"""SSH MCP 工具定义"""

from typing import Any

from claude_agent_sdk import tool, create_sdk_mcp_server

from .manager import ssh_manager


@tool("ssh_exec", "在已连接的远程服务器上执行 Shell 命令", {"host_id": str, "command": str})
async def ssh_exec(args: dict[str, Any]) -> dict[str, Any]:
    try:
        result = ssh_manager.execute(args["host_id"], args["command"])
        output = f"Exit Code: {result['exit_code']}\n"
        if result["stdout"].strip():
            output += f"--- STDOUT ---\n{result['stdout']}"
        if result["stderr"].strip():
            output += f"--- STDERR ---\n{result['stderr']}"
        return {"content": [{"type": "text", "text": output}]}
    except Exception as e:
        return {"content": [{"type": "text", "text": f"错误: {str(e)}"}], "is_error": True}


@tool("ssh_list", "列出所有当前已连接的 SSH 服务器", {})
async def ssh_list(args: dict[str, Any]) -> dict[str, Any]:
    connections = ssh_manager.list_connected()
    if not connections:
        return {
            "content": [
                {"type": "text", "text": "当前没有活跃的 SSH 连接。请先在左侧面板添加服务器。"}
            ]
        }
    lines = ["当前活跃的 SSH 连接:"]
    for conn in connections:
        lines.append(f"  - {conn['id']}: {conn['username']}@{conn['host']}:{conn['port']}")
    return {"content": [{"type": "text", "text": "\n".join(lines)}]}


# 创建 MCP 服务器
ssh_mcp_server = create_sdk_mcp_server(
    name="ssh-tools",
    version="1.0.0",
    tools=[ssh_exec, ssh_list],
)

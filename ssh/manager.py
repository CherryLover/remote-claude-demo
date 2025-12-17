"""SSH 连接管理器"""

import json
from pathlib import Path

import paramiko

CONFIG_FILE = Path(__file__).parent.parent / "ssh_configs.json"


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

    def connect(
        self,
        host_id: str,
        host: str,
        username: str,
        password: str = None,
        port: int = 22,
    ) -> str:
        if host_id in self.connections:
            return f"主机 {host_id} 已经连接"

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            client.connect(
                host, port=port, username=username, password=password, timeout=10
            )
            self.connections[host_id] = client
            self.configs[host_id] = {
                "host": host,
                "username": username,
                "password": password,
                "port": port,
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
            port=config.get("port", 22),
        )

    def execute(self, host_id: str, command: str, timeout: int = 30) -> dict:
        if host_id not in self.connections:
            raise Exception(f"主机 {host_id} 未连接，请先点击连接按钮")
        client = self.connections[host_id]
        try:
            stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
            return {
                "stdout": stdout.read().decode("utf-8"),
                "stderr": stderr.read().decode("utf-8"),
                "exit_code": stdout.channel.recv_exit_status(),
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
            result.append(
                {
                    "id": host_id,
                    "host": config["host"],
                    "username": config["username"],
                    "port": config.get("port", 22),
                    "connected": host_id in self.connections,
                }
            )
        return result

    def list_connected(self) -> list[dict]:
        return [item for item in self.list_all() if item["connected"]]

    def close_all(self):
        for client in self.connections.values():
            client.close()
        self.connections.clear()


# 全局 SSH 管理器实例
ssh_manager = SSHConnectionManager()

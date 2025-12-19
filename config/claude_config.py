"""Claude 配置管理器"""

import os
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
from dotenv import dotenv_values

CONFIG_FILE = Path("claude_config.json")
ENV_FILE = Path(".env")


@dataclass
class ClaudeConfig:
    """Claude 配置数据类"""
    api_key: str
    base_url: Optional[str] = None


class ClaudeConfigManager:
    """Claude 配置管理器"""

    def _load_from_file(self) -> dict:
        """从 Web 配置文件加载"""
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        return {}

    def _load_from_dotenv(self) -> dict:
        """从项目 .env 文件加载（不污染系统环境变量）"""
        if ENV_FILE.exists():
            try:
                return dotenv_values(ENV_FILE)
            except Exception:
                return {}
        return {}

    def _save_to_file(self, config: dict):
        """保存到 Web 配置文件"""
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)

    def get_config(self) -> ClaudeConfig:
        """
        获取配置（三级优先级）

        优先级：Web 配置 > 项目 .env > 系统环境变量
        """
        web_config = self._load_from_file()
        dotenv_config = self._load_from_dotenv()

        # 三级优先级
        api_key = (
            web_config.get("api_key")
            or dotenv_config.get("ANTHROPIC_API_KEY")
            or os.getenv("ANTHROPIC_API_KEY")
        )
        base_url = (
            web_config.get("base_url")
            or dotenv_config.get("ANTHROPIC_BASE_URL")
            or os.getenv("ANTHROPIC_BASE_URL")
        )

        if not api_key:
            raise ValueError(
                "未配置 API Key。请通过以下方式之一配置：\n"
                "1. Web UI 配置\n"
                "2. 项目 .env 文件设置 ANTHROPIC_API_KEY\n"
                "3. 系统环境变量 ANTHROPIC_API_KEY"
            )

        return ClaudeConfig(api_key=api_key, base_url=base_url)

    def set_config(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """设置 Web 配置"""
        config = self._load_from_file()

        if api_key is not None:
            config["api_key"] = api_key
        if base_url is not None:
            config["base_url"] = base_url if base_url else None

        self._save_to_file(config)

    def get_masked_config(self) -> dict:
        """获取脱敏后的配置（用于前端展示）"""
        web_config = self._load_from_file()
        dotenv_config = self._load_from_dotenv()
        sys_api_key = os.getenv("ANTHROPIC_API_KEY")
        sys_base_url = os.getenv("ANTHROPIC_BASE_URL")

        def mask_key(key: Optional[str]) -> Optional[str]:
            if not key:
                return None
            if len(key) <= 10:
                return "*" * len(key)
            return f"{key[:6]}...{key[-4:]}"

        # 确定当前生效的配置来源
        active_source = None
        if web_config.get("api_key"):
            active_source = "web"
        elif dotenv_config.get("ANTHROPIC_API_KEY"):
            active_source = "dotenv"
        elif sys_api_key:
            active_source = "system"

        return {
            "web": {
                "api_key": mask_key(web_config.get("api_key")),
                "base_url": web_config.get("base_url"),
                "has_api_key": bool(web_config.get("api_key")),
            },
            "dotenv": {
                "api_key": mask_key(dotenv_config.get("ANTHROPIC_API_KEY")),
                "base_url": dotenv_config.get("ANTHROPIC_BASE_URL"),
                "has_api_key": bool(dotenv_config.get("ANTHROPIC_API_KEY")),
            },
            "system": {
                "api_key": mask_key(sys_api_key),
                "base_url": sys_base_url,
                "has_api_key": bool(sys_api_key),
            },
            "active_source": active_source
        }

    def clear_config(self):
        """清除 Web 配置"""
        if CONFIG_FILE.exists():
            CONFIG_FILE.unlink()


# 全局实例
claude_config_manager = ClaudeConfigManager()

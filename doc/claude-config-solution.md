# Claude 环境变量配置方案

## 需求概述

支持自定义 Claude Agent SDK 的环境变量配置，包括：
- **API Key** (`ANTHROPIC_API_KEY`) - 必须
- **Base URL** (`ANTHROPIC_BASE_URL`) - 可选，用于代理或私有部署

## 配置优先级

**三级优先级**：Web 配置 > 项目 .env > 系统环境变量

```
if Web 配置存在:
    使用 Web 配置
elif 项目 .env 配置存在:
    使用项目 .env 配置
elif 系统环境变量存在:
    使用系统环境变量
else:
    报错，提示用户配置
```

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 (最高) | Web 配置 | 通过 Web UI 配置，存储在 `claude_config.json` |
| 2 | 项目 .env | 项目根目录的 `.env` 文件，通过 `python-dotenv` 加载 |
| 3 (最低) | 系统环境变量 | 系统级别的环境变量 |

## 技术方案

### 1. 配置存储

新增配置文件 `claude_config.json`：

```json
{
  "api_key": "sk-ant-xxx...xxx",
  "base_url": "https://api.anthropic.com"
}
```

### 2. 配置管理模块

新增 `config/claude_config.py`：

```python
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
            return dotenv_values(ENV_FILE)
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
```

**说明**：使用 `dotenv_values()` 而非 `load_dotenv()`，避免污染系统环境变量，确保优先级判断准确。

### 3. API 路由

在 `app.py` 中新增：

```python
from config.claude_config import claude_config_manager

# 获取配置（脱敏）
@app.get("/api/claude/config")
async def get_claude_config():
    return claude_config_manager.get_masked_config()

# 设置配置
@app.post("/api/claude/config")
async def set_claude_config(request: ClaudeConfigRequest):
    claude_config_manager.set_config(
        api_key=request.api_key,
        base_url=request.base_url
    )
    return {"status": "ok", "message": "配置已保存"}

# 清除配置
@app.delete("/api/claude/config")
async def clear_claude_config():
    claude_config_manager.clear_config()
    return {"status": "ok", "message": "配置已清除"}
```

### 4. Claude Client 集成

修改 `claude/client.py`，在创建 client 时注入配置：

```python
from config.claude_config import claude_config_manager

def _create_options(self) -> ClaudeAgentOptions:
    config = claude_config_manager.get_config()

    # 构建环境变量
    env = {"ANTHROPIC_API_KEY": config.api_key}
    if config.base_url:
        env["ANTHROPIC_BASE_URL"] = config.base_url

    return ClaudeAgentOptions(
        env=env,  # 注入配置
        mcp_servers={"ssh-tools": ssh_mcp_server},
        allowed_tools=[...],
        permission_mode="acceptEdits",
        system_prompt=system_prompt,
    )
```

### 5. 前端 UI

在 Web UI 中新增配置面板：

```
┌──────────────────────────────────────────────────────────┐
│ Claude 配置                                               │
├──────────────────────────────────────────────────────────┤
│ API Key:  [sk-ant-...xxxx              ] [保存] [清除]   │
│ Base URL: [https://api.anthropic.com   ] [保存] [清除]   │
├──────────────────────────────────────────────────────────┤
│ 配置来源（优先级从高到低）：                               │
│                                                          │
│ ● Web 配置     : sk-ant-...xxxx  ← 当前生效              │
│ ○ 项目 .env    : sk-ant-...yyyy                          │
│ ○ 系统环境变量  : sk-ant-...zzzz                          │
└──────────────────────────────────────────────────────────┘
```

**脱敏规则**：
- API Key 显示为 `sk-ant-...xxxx`（前6位 + ... + 后4位）
- 输入框在编辑时显示完整内容，失焦后脱敏

**交互说明**：
- 显示三级配置来源，用 ● 标记当前生效的来源
- "清除" 按钮仅清除 Web 配置，清除后自动降级到下一优先级
- 项目 .env 和系统环境变量为只读展示

### 6. 配置生效机制

配置保存后需要重建 Claude 客户端才能生效。有两种方案：

**方案 A：自动重建（推荐）**
- 配置保存后，自动关闭当前 Claude 会话
- 下次对话时使用新配置创建客户端

**方案 B：手动重建**
- 配置保存后，提示用户需要刷新页面或点击"应用配置"按钮

**推荐方案 A**，实现方式：

```python
@app.post("/api/claude/config")
async def set_claude_config(request: ClaudeConfigRequest):
    claude_config_manager.set_config(...)

    # 关闭当前会话，下次对话时会自动重建
    if claude_client:
        await claude_client.close()
        claude_client = None

    return {"status": "ok", "message": "配置已保存并生效"}
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `config/__init__.py` | 新增 | 模块初始化 |
| `config/claude_config.py` | 新增 | 配置管理器 |
| `models.py` | 修改 | 新增 ClaudeConfigRequest 模型 |
| `app.py` | 修改 | 新增配置 API 路由 |
| `claude/client.py` | 修改 | 集成配置管理器 |
| `static/index.html` | 修改 | 新增配置面板 UI |
| `requirements.txt` | 修改 | 新增 `python-dotenv` 依赖 |
| `claude_config.json` | 新增 | Web 配置持久化文件（运行时生成） |
| `.env.example` | 新增 | 环境变量示例文件 |
| `.gitignore` | 修改 | 忽略 `claude_config.json` 和 `.env` |

### .env.example 内容

```bash
# Claude API 配置
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

## 安全考虑

1. **配置文件安全**：`claude_config.json` 和 `.env` 加入 `.gitignore`，避免敏感信息泄露
2. **前端脱敏**：API Key 在前端展示时进行脱敏处理
3. **传输安全**：建议生产环境使用 HTTPS
4. **示例文件**：提供 `.env.example` 作为配置模板，不包含真实密钥

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 三级配置均未设置 API Key | 抛出异常，提示用户通过 Web UI / .env / 系统环境变量配置 |
| API Key 格式无效 | Claude SDK 调用时返回错误，前端展示错误信息 |
| Base URL 无法访问 | Claude SDK 调用时返回错误，前端展示错误信息 |
| .env 文件格式错误 | 捕获异常，降级到系统环境变量 |

## 测试用例

### 优先级测试

| # | Web | .env | 系统 | 预期结果 |
|---|-----|------|------|----------|
| 1 | ✓ | ✓ | ✓ | 使用 Web 配置 |
| 2 | ✓ | ✓ | ✗ | 使用 Web 配置 |
| 3 | ✓ | ✗ | ✓ | 使用 Web 配置 |
| 4 | ✓ | ✗ | ✗ | 使用 Web 配置 |
| 5 | ✗ | ✓ | ✓ | 使用 .env 配置 |
| 6 | ✗ | ✓ | ✗ | 使用 .env 配置 |
| 7 | ✗ | ✗ | ✓ | 使用系统环境变量 |
| 8 | ✗ | ✗ | ✗ | 报错 |

### 功能测试

1. Web 配置保存后立即对话 → 新配置生效
2. 清除 Web 配置 → 自动降级到 .env 或系统环境变量
3. 前端展示三级配置来源及脱敏后的 API Key
4. 前端正确标记当前生效的配置来源

# 需求池

| ID | 需求名称 | 描述 | 相关文档 | 状态 | 优先级 |
|----|---------|------|---------|------|--------|
| REQ-001 | 桌面应用打包 | 将 Web 应用打包为桌面端应用，使用 PyWebView 方案 | [desktop-app-solution.md](./desktop-app-solution.md) | 待开发 | P2 |
| REQ-002 | 流式对话响应 | 使用 SSE 实现 Claude 对话的流式返回，提升用户体验 | [streaming-chat-solution.md](./streaming-chat-solution.md) | 已完成 | P1 |
| REQ-003 | Claude 环境变量配置 | 支持自定义 Claude 的环境变量（请求地址、API Key 等），支持本地配置和 Web 配置两种方式，Web 配置后立即生效 | [claude-config-solution.md](./claude-config-solution.md) | 已完成 | P1 |

## 状态说明

- **待开发**: 需求已确认，等待排期
- **开发中**: 正在开发
- **测试中**: 开发完成，测试阶段
- **已完成**: 已上线/合并
- **暂缓**: 暂时搁置

## 优先级说明

- **P0**: 紧急，立即处理
- **P1**: 高优先级，当前迭代
- **P2**: 中优先级，下个迭代
- **P3**: 低优先级，有空再做

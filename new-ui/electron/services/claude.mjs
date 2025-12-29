/**
 * Claude Agent SDK 服务
 * 处理与 Claude 的对话，支持流式响应
 */
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

// 日志工具
const log = {
  info: (...args) => console.log('[Claude]', ...args),
  error: (...args) => console.error('[Claude ERROR]', ...args),
  debug: (...args) => console.log('[Claude DEBUG]', ...args),
}

// SSH 服务引用（会在初始化时设置）
let sshServiceRef = null

/**
 * 设置 SSH 服务引用
 */
export function setSshService(service) {
  sshServiceRef = service
  log.info('SSH service reference set')
}

/**
 * 创建 SSH MCP 服务器
 */
function createSshMcpServer() {
  return createSdkMcpServer({
    name: 'ssh-tools',
    version: '1.0.0',
    tools: [
      tool(
        'ssh_exec',
        '在已连接的远程 SSH 服务器上执行 Shell 命令',
        {
          host_id: z.string().describe('SSH 服务器 ID，格式为 username@host:port'),
          command: z.string().describe('要执行的 Shell 命令')
        },
        async (args) => {
          log.info('SSH tool called:', args.host_id, args.command)

          if (!sshServiceRef) {
            return {
              content: [{ type: 'text', text: '错误: SSH 服务未初始化' }],
              is_error: true
            }
          }

          try {
            const result = await sshServiceRef.exec(args.host_id, args.command)
            log.info('SSH exec result:', result.success, result.exitCode)

            if (!result.success) {
              return {
                content: [{ type: 'text', text: `错误: ${result.error}` }],
                is_error: true
              }
            }

            let output = `Exit Code: ${result.exitCode}\n`
            if (result.stdout) {
              output += `--- STDOUT ---\n${result.stdout}\n`
            }
            if (result.stderr) {
              output += `--- STDERR ---\n${result.stderr}`
            }

            return {
              content: [{ type: 'text', text: output }]
            }
          } catch (error) {
            log.error('SSH exec error:', error)
            return {
              content: [{ type: 'text', text: `错误: ${error.message}` }],
              is_error: true
            }
          }
        }
      ),
      tool(
        'ssh_list',
        '列出所有已配置的 SSH 服务器及其连接状态',
        {},
        async () => {
          log.info('SSH list tool called')

          if (!sshServiceRef) {
            return {
              content: [{ type: 'text', text: '错误: SSH 服务未初始化' }],
              is_error: true
            }
          }

          try {
            const servers = sshServiceRef.list()

            if (servers.length === 0) {
              return {
                content: [{ type: 'text', text: '没有配置任何 SSH 服务器' }]
              }
            }

            const lines = servers.map(s => {
              const status = s.connected ? '✓ 已连接' : '○ 未连接'
              return `${status} ${s.hostId}`
            })

            return {
              content: [{ type: 'text', text: `SSH 服务器列表:\n${lines.join('\n')}` }]
            }
          } catch (error) {
            log.error('SSH list error:', error)
            return {
              content: [{ type: 'text', text: `错误: ${error.message}` }],
              is_error: true
            }
          }
        }
      )
    ]
  })
}

class ClaudeService {
  constructor() {
    this.currentSession = null
    this.abortController = null
    this.sshMcpServer = null
    this.config = {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-sonnet-4-5',
      baseUrl: process.env.ANTHROPIC_BASE_URL || undefined
    }
    log.info('ClaudeService initialized')
    log.info('  API Key:', this.config.apiKey ? `${this.config.apiKey.slice(0, 15)}...` : 'not set')
    log.info('  Base URL:', this.config.baseUrl || 'default')
    log.info('  Model:', this.config.model)
  }

  /**
   * 初始化 MCP 服务器
   */
  initMcpServers() {
    if (!this.sshMcpServer) {
      this.sshMcpServer = createSshMcpServer()
      log.info('SSH MCP server created')
    }
  }

  /**
   * 更新配置
   */
  setConfig(config) {
    this.config = { ...this.config, ...config }
    log.info('Config updated:', {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey
    })
  }

  /**
   * 获取配置（脱敏）
   */
  getConfig() {
    return {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasApiKey: !!this.config.apiKey,
      apiKeyPreview: this.config.apiKey
        ? `${this.config.apiKey.slice(0, 10)}...${this.config.apiKey.slice(-4)}`
        : ''
    }
  }

  /**
   * 创建异步消息生成器
   */
  async *createMessageGenerator(prompt) {
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: prompt
      }
    }
  }

  /**
   * 流式对话
   * @param {string} prompt - 用户消息
   * @param {object} options - 选项
   * @param {function} onMessage - 消息回调
   */
  async chat(prompt, options = {}, onMessage) {
    log.info('='.repeat(50))
    log.info('Chat started')
    log.info('  Prompt:', prompt.slice(0, 100) + (prompt.length > 100 ? '...' : ''))
    log.info('  Session:', this.currentSession || 'new session')

    // 初始化 MCP 服务器
    this.initMcpServers()

    // 设置环境变量（SDK 会读取）
    if (this.config.apiKey) {
      process.env.ANTHROPIC_API_KEY = this.config.apiKey
    }
    if (this.config.baseUrl) {
      process.env.ANTHROPIC_BASE_URL = this.config.baseUrl
    }

    log.debug('Environment set:')
    log.debug('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'set' : 'not set')
    log.debug('  ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL || 'not set')

    const queryOptions = {
      model: this.config.model,
      permissionMode: 'bypassPermissions', // 桌面应用中跳过权限检查
      ...options
    }

    // 添加 MCP 服务器
    if (this.sshMcpServer) {
      queryOptions.mcpServers = {
        'ssh-tools': this.sshMcpServer
      }
      log.info('SSH MCP server added to query options')
    }

    // 如果有会话，继续对话
    if (this.currentSession) {
      queryOptions.resume = this.currentSession
      log.info('Resuming session:', this.currentSession)
    }

    log.info('Query options:', JSON.stringify({
      ...queryOptions,
      mcpServers: queryOptions.mcpServers ? 'configured' : 'none'
    }, null, 2))

    try {
      log.info('Calling query()...')

      // 使用异步生成器作为 prompt
      const response = query({
        prompt: this.createMessageGenerator(prompt),
        options: queryOptions
      })

      log.info('Got response iterator, starting to read messages...')

      let messageCount = 0
      for await (const message of response) {
        messageCount++
        log.debug(`Message #${messageCount}:`, message.type, message.subtype || '')

        // 处理不同类型的消息
        switch (message.type) {
          case 'system':
            if (message.subtype === 'init') {
              this.currentSession = message.session_id
              log.info('Session initialized:', message.session_id)
              log.info('  Model:', message.model)
              log.info('  Tools:', message.tools?.length || 0)
              onMessage({
                type: 'system',
                subtype: 'init',
                sessionId: message.session_id,
                model: message.model,
                tools: message.tools || [],
                skills: message.skills || []
              })
            } else if (message.subtype === 'completion') {
              log.info('Session completed')
              onMessage({
                type: 'system',
                subtype: 'completion'
              })
            } else {
              log.debug('System message:', message.subtype)
            }
            break

          case 'assistant':
            // 助手消息
            let content = ''
            if (typeof message.content === 'string') {
              content = message.content
            } else if (Array.isArray(message.content)) {
              content = message.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('')
            }
            if (content) {
              log.debug('Assistant content:', content.slice(0, 50) + (content.length > 50 ? '...' : ''))
              onMessage({
                type: 'assistant',
                content
              })
            } else {
              log.debug('Assistant message with no text content, raw:', JSON.stringify(message).slice(0, 200))
            }
            break

          case 'result':
            // 最终结果消息
            if (message.result) {
              log.info('Result:', message.result.slice(0, 100))
              onMessage({
                type: 'assistant',
                content: message.result
              })
            }
            break

          case 'tool_call':
            log.info('Tool call:', message.tool_name)
            log.debug('  Input:', JSON.stringify(message.input).slice(0, 200))
            onMessage({
              type: 'tool_call',
              toolName: message.tool_name,
              input: message.input
            })
            break

          case 'tool_result':
            log.info('Tool result:', message.tool_name)
            log.debug('  Result:', JSON.stringify(message.result).slice(0, 200))
            onMessage({
              type: 'tool_result',
              toolName: message.tool_name,
              result: message.result
            })
            break

          case 'error':
            log.error('Error message:', message.error)
            onMessage({
              type: 'error',
              error: message.error
            })
            break

          default:
            // 其他消息类型
            log.debug('Other message type:', message.type, message)
            onMessage({
              type: 'other',
              message
            })
        }
      }

      log.info(`Chat completed, total messages: ${messageCount}`)
      // 完成
      onMessage({ type: 'done' })

    } catch (error) {
      log.error('Chat error:', error.message)
      log.error('  Stack:', error.stack)
      onMessage({
        type: 'error',
        error: {
          message: error.message || 'Unknown error',
          code: error.code
        }
      })
    }

    log.info('='.repeat(50))
  }

  /**
   * 停止当前对话
   */
  stop() {
    log.info('Stop requested')
  }

  /**
   * 清除会话
   */
  clearSession() {
    log.info('Session cleared, was:', this.currentSession)
    this.currentSession = null
  }
}

// 单例导出
export const claudeService = new ClaudeService()
export default claudeService

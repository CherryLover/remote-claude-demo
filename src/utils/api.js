/**
 * API 适配层
 * 自动检测运行环境（Electron 或 Web），使用对应的 API
 */

// 检测是否在 Electron 环境中
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
}

// Electron API 实现
const electronApi = {
  // SSH
  getServers: async () => {
    const servers = await window.electronAPI.ssh.list()
    // 转换格式：hostId -> id
    const formattedServers = servers.map(s => ({
      id: s.hostId,
      host: s.host,
      port: s.port,
      username: s.username,
      connected: s.connected,
      authType: s.authType
    }))
    return { servers: formattedServers }
  },

  addServer: async (data) => {
    const result = await window.electronAPI.ssh.connect(data)
    return { ok: result.success, ...result }
  },

  connectSavedServer: async (hostId) => {
    // Electron 版本：尝试使用保存的配置重连
    const result = await window.electronAPI.ssh.reconnect(hostId)
    if (result.needPassword) {
      return { ok: false, needPassword: true, error: '请输入密码连接' }
    }
    return { ok: result.success, ...result }
  },

  disconnectServer: async (hostId) => {
    const result = await window.electronAPI.ssh.disconnect(hostId)
    return { ok: result.success }
  },

  deleteServer: async (hostId) => {
    const result = await window.electronAPI.ssh.deleteConfig(hostId)
    return { ok: result.success }
  },

  execCommand: async (hostId, command) => {
    const result = await window.electronAPI.ssh.exec(hostId, command)
    // 转换格式以匹配 Web API 返回格式
    return {
      ok: result.success,
      result: {
        exit_code: result.exitCode,
        stdout: result.stdout || '',
        stderr: result.stderr || ''
      },
      detail: result.error
    }
  },

  // Config
  getConfig: async () => {
    const config = await window.electronAPI.claude.getConfig()
    return config
  },

  saveConfig: async (data) => {
    const result = await window.electronAPI.claude.setConfig(data)
    return { ok: result.success, ...result }
  },

  clearConfig: async () => {
    // Electron 版本清除配置
    const result = await window.electronAPI.claude.setConfig({
      apiKey: '',
      model: 'claude-sonnet-4-5',
      baseUrl: ''
    })
    return { ok: result.success }
  },

  // Chat - Electron 使用 IPC 流式通信
  chatStream: (message, signal) => {
    console.log('[API] chatStream called with message:', message.slice(0, 50))
    // 返回一个特殊对象，表示使用 Electron IPC
    return {
      isElectronStream: true,
      start: async (onMessage) => {
        console.log('[API] start() called, setting up listener')
        return new Promise((resolve, reject) => {
          // 设置流式响应监听
          const handleMessage = (data) => {
            console.log('[API] handleMessage received:', data.type, data.subtype || '')
            onMessage(data)
            // 当收到 done 或 error 时，完成 Promise
            if (data.type === 'done' || data.type === 'error') {
              console.log('[API] Received done/error, cleaning up')
              window.electronAPI.claude.offChatStream()
              resolve()
            }
          }

          window.electronAPI.claude.onChatStream(handleMessage)
          console.log('[API] Listener set, calling chat()')

          // 发送消息
          window.electronAPI.claude.chat(message)
            .then(result => {
              console.log('[API] chat() returned:', result)
            })
            .catch(err => {
              console.error('[API] chat() error:', err)
              window.electronAPI.claude.offChatStream()
              reject(err)
            })
        })
      },
      abort: () => {
        console.log('[API] abort() called')
        window.electronAPI.claude.stopChat()
        window.electronAPI.claude.offChatStream()
      }
    }
  },

  // Electron 特有的 API
  clearSession: async () => {
    return await window.electronAPI.claude.clearSession()
  }
}

// Web API 实现（原有的 fetch 实现）
const webApi = {
  // SSH
  getServers: async () => {
    const res = await fetch('/api/ssh/list')
    return res.json()
  },

  addServer: async (data) => {
    const res = await fetch('/api/ssh/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const json = await res.json()
    return { ok: res.ok, ...json }
  },

  connectSavedServer: async (id) => {
    const res = await fetch(`/api/ssh/connect/${id}`, { method: 'POST' })
    const json = await res.json()
    return { ok: res.ok, ...json }
  },

  disconnectServer: async (id) => {
    const res = await fetch(`/api/ssh/disconnect/${id}`, { method: 'POST' })
    return { ok: res.ok }
  },

  deleteServer: async (id) => {
    const res = await fetch(`/api/ssh/config/${id}`, { method: 'DELETE' })
    return { ok: res.ok }
  },

  execCommand: async (hostId, command) => {
    const res = await fetch('/api/ssh/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host_id: hostId, command })
    })
    const json = await res.json()
    return { ok: res.ok, ...json }
  },

  // Config
  getConfig: async () => {
    const res = await fetch('/api/claude/config')
    return res.json()
  },

  saveConfig: async (data) => {
    const res = await fetch('/api/claude/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const json = await res.json()
    return { ok: res.ok, ...json }
  },

  clearConfig: async () => {
    const res = await fetch('/api/claude/config', { method: 'DELETE' })
    const json = await res.json()
    return { ok: res.ok, ...json }
  },

  // Chat
  chatStream: (message, signal) => {
    return fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal
    })
  },

  clearSession: async () => {
    // Web 版本暂不支持
    return { success: true }
  }
}

// 根据环境选择 API 实现
export const api = isElectron() ? electronApi : webApi

// 导出环境检测函数
export { isElectron }

/**
 * SSH 连接管理服务
 * 使用 ssh2 库管理多个 SSH 连接
 */
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')

// 配置文件路径（延迟获取，等 app ready 后）
let configPath = null
const getConfigPath = () => {
  if (!configPath) {
    const { app } = require('electron')
    const userDataPath = app.getPath('userData')
    configPath = path.join(userDataPath, 'ssh_configs.json')
  }
  return configPath
}

class SSHService {
  constructor() {
    // 存储活跃的 SSH 连接 { hostId: { client, config } }
    this.connections = new Map()
    // 存储 SSH 配置
    this.configs = new Map()
    // 标记是否已加载配置
    this.configsLoaded = false
  }

  /**
   * 确保配置已加载（延迟加载）
   */
  ensureConfigsLoaded() {
    if (!this.configsLoaded) {
      this.loadConfigs()
      this.configsLoaded = true
    }
  }

  /**
   * 生成 hostId
   */
  generateHostId(config) {
    return `${config.username}@${config.host}:${config.port || 22}`
  }

  /**
   * 加载保存的配置
   */
  loadConfigs() {
    try {
      const configPath = getConfigPath()
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        for (const [hostId, config] of Object.entries(data)) {
          this.configs.set(hostId, config)
        }
        console.log(`Loaded ${this.configs.size} SSH configs`)
      }
    } catch (error) {
      console.error('Failed to load SSH configs:', error)
    }
  }

  /**
   * 保存配置到文件
   */
  saveConfigs() {
    try {
      const configPath = getConfigPath()
      const data = Object.fromEntries(this.configs)
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Failed to save SSH configs:', error)
    }
  }

  /**
   * 连接到 SSH 服务器
   * @param {object} config - { host, port, username, password, privateKey }
   */
  async connect(config) {
    this.ensureConfigsLoaded()
    const hostId = this.generateHostId(config)

    // 如果已连接，先断开
    if (this.connections.has(hostId)) {
      await this.disconnect(hostId)
    }

    return new Promise((resolve, reject) => {
      const client = new Client()

      client.on('ready', () => {
        console.log(`SSH connected: ${hostId}`)
        this.connections.set(hostId, { client, config })
        // 保存配置（包括密码，方便重连）
        const savedConfig = {
          host: config.host,
          port: config.port || 22,
          username: config.username,
          // 标记认证方式
          authType: config.privateKey ? 'key' : 'password'
        }
        // 保存密码（如果有）
        if (config.password) {
          savedConfig.password = config.password
        }
        this.configs.set(hostId, savedConfig)
        this.saveConfigs()
        resolve({
          success: true,
          hostId,
          message: `Connected to ${hostId}`
        })
      })

      client.on('error', (err) => {
        console.error(`SSH error for ${hostId}:`, err.message)
        reject({
          success: false,
          hostId,
          error: err.message
        })
      })

      client.on('close', () => {
        console.log(`SSH connection closed: ${hostId}`)
        this.connections.delete(hostId)
      })

      // 构建连接配置
      const connectConfig = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: 10000
      }

      // 支持密码或私钥认证
      if (config.privateKey) {
        connectConfig.privateKey = config.privateKey
        if (config.passphrase) {
          connectConfig.passphrase = config.passphrase
        }
      } else if (config.password) {
        connectConfig.password = config.password
      }

      client.connect(connectConfig)
    })
  }

  /**
   * 断开 SSH 连接
   */
  async disconnect(hostId) {
    const conn = this.connections.get(hostId)
    if (conn) {
      conn.client.end()
      this.connections.delete(hostId)
      return { success: true, hostId, message: `Disconnected from ${hostId}` }
    }
    return { success: false, hostId, error: 'Connection not found' }
  }

  /**
   * 删除保存的配置
   */
  deleteConfig(hostId) {
    // 先断开连接
    if (this.connections.has(hostId)) {
      this.disconnect(hostId)
    }
    // 删除配置
    if (this.configs.has(hostId)) {
      this.configs.delete(hostId)
      this.saveConfigs()
      return { success: true, hostId, message: `Config deleted: ${hostId}` }
    }
    return { success: false, hostId, error: 'Config not found' }
  }

  /**
   * 执行 SSH 命令
   */
  async exec(hostId, command) {
    const conn = this.connections.get(hostId)
    if (!conn) {
      return {
        success: false,
        hostId,
        error: `Not connected to ${hostId}`
      }
    }

    return new Promise((resolve) => {
      conn.client.exec(command, (err, stream) => {
        if (err) {
          resolve({
            success: false,
            hostId,
            command,
            error: err.message
          })
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('close', (code) => {
          resolve({
            success: code === 0,
            hostId,
            command,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code
          })
        })

        stream.on('data', (data) => {
          stdout += data.toString()
        })

        stream.stderr.on('data', (data) => {
          stderr += data.toString()
        })
      })
    })
  }

  /**
   * 列出所有服务器（配置 + 连接状态）
   */
  list() {
    this.ensureConfigsLoaded()
    const servers = []

    // 遍历所有配置
    for (const [hostId, config] of this.configs) {
      servers.push({
        hostId,
        ...config,
        connected: this.connections.has(hostId)
      })
    }

    return servers
  }

  /**
   * 检查是否已连接
   */
  isConnected(hostId) {
    return this.connections.has(hostId)
  }

  /**
   * 获取保存的配置
   */
  getConfig(hostId) {
    this.ensureConfigsLoaded()
    return this.configs.get(hostId) || null
  }

  /**
   * 使用保存的配置重新连接
   */
  async reconnect(hostId) {
    this.ensureConfigsLoaded()
    const config = this.configs.get(hostId)
    if (!config) {
      return { success: false, error: 'Config not found' }
    }
    if (!config.password) {
      return { success: false, needPassword: true, error: 'Password not saved' }
    }
    return await this.connect(config)
  }

  /**
   * 关闭所有连接
   */
  closeAll() {
    for (const [hostId, conn] of this.connections) {
      conn.client.end()
    }
    this.connections.clear()
  }
}

// 单例导出
const sshService = new SSHService()
module.exports = { sshService }

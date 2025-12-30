const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { sshService } = require('./services/ssh.cjs')

// 加载 .env 环境变量
function loadEnvFile() {
  // 尝试多个可能的 .env 路径
  const possiblePaths = [
    path.join(__dirname, '../.env'),              // 开发模式：electron/../.env (项目根目录)
    path.join(__dirname, '../../.env'),           // 打包后可能的路径
    path.join(app.getAppPath(), '.env'),          // 相对于 app 路径
    path.join(process.cwd(), '.env'),             // 当前工作目录
  ]

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log(`Loading .env from: ${envPath}`)
      require('dotenv').config({ path: envPath })
      return true
    }
  }

  console.log('No .env file found, using system environment variables')
  return false
}

// 在最早期加载环境变量
loadEnvFile()

// 开发模式检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let claudeService = null
let setSshService = null

// 动态导入 ES Module
async function loadClaudeService() {
  const module = await import('./services/claude.mjs')
  claudeService = module.claudeService
  setSshService = module.setSshService
  return claudeService
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false  // 禁用 sandbox 以支持 preload 脚本
    }
  })

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:30005')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // 打印环境变量加载情况
  console.log('Environment variables:')
  console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? `${process.env.ANTHROPIC_API_KEY.slice(0, 15)}...` : 'not set')
  console.log('  ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL || 'not set')

  // 加载 Claude 服务
  await loadClaudeService()
  console.log('Claude service loaded')

  // 设置 SSH 服务引用，让 Claude 可以使用 SSH 工具
  if (setSshService) {
    setSshService(sshService)
    console.log('SSH service reference set for Claude')
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============ IPC 处理器 ============

// 测试连接
ipcMain.handle('ping', () => {
  return 'pong from main process'
})

// ============ Claude 相关 IPC ============

// 获取 Claude 配置
ipcMain.handle('claude:getConfig', () => {
  if (!claudeService) {
    return { error: 'Claude service not loaded' }
  }
  return claudeService.getConfig()
})

// 设置 Claude 配置
ipcMain.handle('claude:setConfig', (event, config) => {
  if (!claudeService) {
    return { error: 'Claude service not loaded' }
  }
  claudeService.setConfig(config)
  return { success: true }
})

// 流式对话
ipcMain.handle('claude:chat', async (event, message, options = {}) => {
  console.log('[Main] claude:chat called with message:', message.slice(0, 50))
  if (!claudeService) {
    console.log('[Main] Claude service not loaded!')
    return { error: 'Claude service not loaded' }
  }

  // 使用流式回调发送消息到渲染进程
  await claudeService.chat(message, options, (data) => {
    console.log('[Main] Sending to renderer:', data.type, data.subtype || '')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude:stream', data)
      console.log('[Main] Message sent to renderer')
    } else {
      console.log('[Main] mainWindow not available!')
    }
  })

  console.log('[Main] claude:chat completed')
  return { success: true }
})

// 停止对话
ipcMain.handle('claude:stop', () => {
  if (!claudeService) {
    return { error: 'Claude service not loaded' }
  }
  claudeService.stop()
  return { success: true }
})

// 清除会话
ipcMain.handle('claude:clearSession', () => {
  if (!claudeService) {
    return { error: 'Claude service not loaded' }
  }
  claudeService.clearSession()
  return { success: true }
})

// ============ SSH 相关 IPC ============

// 连接 SSH 服务器
ipcMain.handle('ssh:connect', async (event, config) => {
  try {
    return await sshService.connect(config)
  } catch (error) {
    return error
  }
})

// 使用保存的配置重连 SSH 服务器
ipcMain.handle('ssh:reconnect', async (event, hostId) => {
  try {
    return await sshService.reconnect(hostId)
  } catch (error) {
    return error
  }
})

// 断开 SSH 连接
ipcMain.handle('ssh:disconnect', async (event, hostId) => {
  return await sshService.disconnect(hostId)
})

// 删除 SSH 配置
ipcMain.handle('ssh:deleteConfig', (event, hostId) => {
  return sshService.deleteConfig(hostId)
})

// 执行 SSH 命令
ipcMain.handle('ssh:exec', async (event, hostId, command) => {
  return await sshService.exec(hostId, command)
})

// 列出所有 SSH 服务器
ipcMain.handle('ssh:list', () => {
  return sshService.list()
})

// 应用退出时关闭所有 SSH 连接
app.on('before-quit', () => {
  sshService.closeAll()
})

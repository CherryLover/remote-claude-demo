const { contextBridge, ipcRenderer } = require('electron')

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 测试连接
  ping: () => ipcRenderer.invoke('ping'),

  // SSH 相关 API
  ssh: {
    connect: (config) => ipcRenderer.invoke('ssh:connect', config),
    reconnect: (hostId) => ipcRenderer.invoke('ssh:reconnect', hostId),
    disconnect: (hostId) => ipcRenderer.invoke('ssh:disconnect', hostId),
    deleteConfig: (hostId) => ipcRenderer.invoke('ssh:deleteConfig', hostId),
    exec: (hostId, command) => ipcRenderer.invoke('ssh:exec', hostId, command),
    list: () => ipcRenderer.invoke('ssh:list')
  },

  // Claude 相关 API
  claude: {
    chat: (message, options) => ipcRenderer.invoke('claude:chat', message, options),
    // 流式响应使用事件监听
    onChatStream: (callback) => {
      // 先移除旧的监听器，避免重复
      ipcRenderer.removeAllListeners('claude:stream')
      ipcRenderer.on('claude:stream', (event, data) => {
        console.log('[Preload] Received stream data:', data.type)
        callback(data)
      })
    },
    offChatStream: () => {
      console.log('[Preload] Removing stream listeners')
      ipcRenderer.removeAllListeners('claude:stream')
    },
    stopChat: () => ipcRenderer.invoke('claude:stop'),
    clearSession: () => ipcRenderer.invoke('claude:clearSession'),
    getConfig: () => ipcRenderer.invoke('claude:getConfig'),
    setConfig: (config) => ipcRenderer.invoke('claude:setConfig', config)
  }
})

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/Chat/ChatArea';
import TerminalPanel from './components/Terminal/TerminalPanel';
import SettingsModal from './components/Settings/SettingsModal';
import { api } from './utils/api';

function App() {
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [showTerminal, setShowTerminal] = useState(true);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);

  const refreshServers = useCallback(async () => {
    try {
      const data = await api.getServers();
      if (data.servers) {
        setServers(data.servers);
        const connectedServers = data.servers.filter(s => s.connected);
        if (selectedServerId) {
          const stillConnected = connectedServers.find(s => s.id === selectedServerId);
          if (!stillConnected) setSelectedServerId(null);
        }
        if (!selectedServerId && connectedServers.length === 1) {
          setSelectedServerId(connectedServers[0].id);
        }
      } else {
        setServers([]);
        setSelectedServerId(null);
      }
    } catch (err) {
      console.error('Failed to load servers', err);
    }
  }, [selectedServerId]);

  useEffect(() => {
    refreshServers();
  }, []);

  const toggleTerminal = () => {
    const newShowTerminal = !showTerminal;
    setShowTerminal(newShowTerminal);
    // 关闭终端时，也要重置最大化状态
    if (!newShowTerminal) {
      setIsTerminalMaximized(false);
    }
  };

  const closeTerminal = () => {
    setShowTerminal(false);
    setIsTerminalMaximized(false);
  };

  const toggleMaximize = () => {
    setIsTerminalMaximized(!isTerminalMaximized);
  };

  return (
    <div className={`app-container ${isTerminalMaximized ? 'terminal-maximized' : ''}`}>
      <Sidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onServerSelect={setSelectedServerId}
        refreshServers={refreshServers}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Middle: Chat Area (Hidden when terminal is maximized) */}
      {/* Middle: Chat Area (Hidden when terminal is maximized) */}
      <div className={`main-content ${isTerminalMaximized ? 'hidden' : ''}`}>
        <div className="main-header">
          <div className="header-spacer"></div>
          {!showTerminal && (
            <button className="btn-toggle-term" onClick={() => setShowTerminal(true)}>
              <span className="icon">_&gt;</span> TERM
            </button>
          )}
        </div>
        <ChatArea
          selectedServerId={selectedServerId}
          refreshServers={refreshServers}
          servers={servers}
        />
      </div>

      {/* Right: Terminal Panel (Vertical) */}
      <div className={`right-panel ${showTerminal ? 'open' : 'closed'} ${isTerminalMaximized ? 'maximized' : ''}`}>
        <TerminalPanel
          selectedServerId={selectedServerId}
          isVertical={true}
          onClose={closeTerminal}
          onMaximize={toggleMaximize}
          isMaximized={isTerminalMaximized}
        />
      </div>



      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;

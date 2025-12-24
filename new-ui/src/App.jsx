import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/Chat/ChatArea';
import { api } from './utils/api';

function App() {
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);

  const refreshServers = useCallback(async () => {
    try {
      const data = await api.getServers();
      if (data.servers) {
        setServers(data.servers);

        // Logic from original ssh.js to maintain selection
        const connectedServers = data.servers.filter(s => s.connected);

        // If current selection is invalid (not connected), deselect
        if (selectedServerId) {
          const stillConnected = connectedServers.find(s => s.id === selectedServerId);
          if (!stillConnected) {
            setSelectedServerId(null);
          }
        }

        // If no selection and only 1 connected, auto select
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
  }, []); // Initial load

  return (
    <>
      <Sidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onServerSelect={setSelectedServerId}
        refreshServers={refreshServers}
      />
      <ChatArea
        selectedServerId={selectedServerId}
        refreshServers={refreshServers}
      />
    </>
  );
}

export default App;

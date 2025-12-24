export const api = {
    // SSH
    getServers: async () => {
        const res = await fetch('/api/ssh/list');
        return res.json();
    },

    addServer: async (data) => {
        const res = await fetch('/api/ssh/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        return { ok: res.ok, ...json };
    },

    connectSavedServer: async (id) => {
        const res = await fetch(`/api/ssh/connect/${id}`, { method: 'POST' });
        const json = await res.json();
        return { ok: res.ok, ...json };
    },

    disconnectServer: async (id) => {
        const res = await fetch(`/api/ssh/disconnect/${id}`, { method: 'POST' });
        // disconnect usually doesn't return JSON body in the original code? 
        // Original: await fetch(...); refreshServers();
        // Just return ok
        return { ok: res.ok };
    },

    deleteServer: async (id) => {
        const res = await fetch(`/api/ssh/config/${id}`, { method: 'DELETE' });
        // Original: just fetch
        return { ok: res.ok };
    },

    execCommand: async (hostId, command) => {
        const res = await fetch('/api/ssh/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host_id: hostId, command })
        });
        const json = await res.json();
        return { ok: res.ok, ...json };
    },

    // Config
    getConfig: async () => {
        const res = await fetch('/api/claude/config');
        return res.json();
    },

    saveConfig: async (data) => {
        const res = await fetch('/api/claude/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        return { ok: res.ok, ...json };
    },

    clearConfig: async () => {
        const res = await fetch('/api/claude/config', { method: 'DELETE' });
        const json = await res.json();
        return { ok: res.ok, ...json };
    },

    // Chat
    chatStream: (message, signal) => {
        return fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
            signal
        });
    }
};

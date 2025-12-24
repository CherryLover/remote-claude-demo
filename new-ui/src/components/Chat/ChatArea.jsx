import React, { useState, useRef, useEffect } from 'react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import { api } from '../../utils/api';

const ChatArea = ({ selectedServerId, refreshServers }) => {
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [systemBanner, setSystemBanner] = useState('');
    const [controller, setController] = useState(null);
    const chatContainerRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isStreaming]);

    const stopStreaming = () => {
        if (controller) {
            controller.abort();
            setController(null);
            setIsStreaming(false);
            // Add note to last message
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    // We append note to content. But content is HTML sometimes? 
                    // Let's add a separate flag or just modify content.
                    // Implementation choice: append span
                    lastMsg.content += '<div class="message-note">响应已被手动停止</div>';
                }
                return newMessages;
            });
        }
    };

    const sendMessage = async (text) => {
        if (isStreaming) return;

        // Add user message
        const userMsg = { id: Date.now(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);

        // Add assistant placeholder
        const assistantId = Date.now() + 1;
        const assistantMsg = { id: assistantId, role: 'assistant', content: '', tools: [] };
        setMessages(prev => [...prev, assistantMsg]);

        setIsStreaming(true);
        const abortController = new AbortController();
        setController(abortController);

        let fullText = '';
        let currentTools = [];

        try {
            let fullMessage = text;
            if (selectedServerId) {
                fullMessage = `[当前选中的服务器: ${selectedServerId}] ${text}`;
            }

            const response = await api.chatStream(fullMessage, abortController.signal);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        var eventType = line.slice(7);
                    } else if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));

                        if (eventType === 'content') {
                            fullText += data.text;
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId ? { ...m, content: fullText } : m
                            ));
                        } else if (eventType === 'tool_use') {
                            currentTools.push({
                                id: data.tool_use_id,
                                name: data.name,
                                input: data.input
                            });
                            // Add ref marker
                            const toolIndex = currentTools.length; // 1-based
                            fullText += `<span class="tool-ref">${toolIndex}</span>`;

                            setMessages(prev => prev.map(m =>
                                m.id === assistantId ? { ...m, content: fullText, tools: [...currentTools] } : m
                            ));
                        } else if (eventType === 'tool_result') {
                            const toolIndex = currentTools.findIndex(t => t.id === data.tool_use_id);
                            if (toolIndex !== -1) {
                                currentTools[toolIndex] = {
                                    ...currentTools[toolIndex],
                                    result: data.content,
                                    isError: data.is_error
                                };
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantId ? { ...m, tools: [...currentTools] } : m
                                ));
                            }
                        } else if (eventType === 'system_init') {
                            const serverName = selectedServerId || '未选择';
                            const modelName = data.model ? data.model.split('-').slice(0, 2).join('-') : 'unknown';
                            setSystemBanner(`🤖 会话已初始化 · 模型: ${modelName} · 当前服务器: ${serverName}`);
                        } else if (eventType === 'error') {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantId ? { ...m, content: fullText + `<span style="color: #e74c3c;">错误: ${data.message}</span>` } : m
                            ));
                        } else if (eventType === 'done') {
                            refreshServers();
                        }
                    }
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                // Handled in stopStreaming usually, but if aborted elsewhere
            } else {
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: fullText + `<div style="color: #e74c3c;">错误: ${err.message}</div>` } : m
                ));
            }
        } finally {
            setIsStreaming(false);
            setController(null);
        }
    };

    return (
        <div className="main">
            <div className="header">
                <h1>Remote Claude Service</h1>
                <p>使用 Claude 智能管理你的远程服务器</p>
            </div>

            <div className="chat-container" id="chatContainer" ref={chatContainerRef}>
                {systemBanner && <div className="system-banner">{systemBanner}</div>}
                {messages.length === 0 && (
                    <div className="empty-state">
                        <p>先在左侧添加 SSH 服务器，然后在下方输入框与 Claude 对话</p>
                        <p>例如: "帮我看看 my-server 的系统负载"</p>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <MessageItem
                        key={msg.id}
                        {...msg}
                        isStreaming={isStreaming}
                        isLast={index === messages.length - 1}
                    />
                ))}
            </div>

            <ChatInput
                onSend={sendMessage}
                onStop={stopStreaming}
                isStreaming={isStreaming}
                disabled={isStreaming} // Original: input disabled while streaming
            />
        </div>
    );
};

export default ChatArea;

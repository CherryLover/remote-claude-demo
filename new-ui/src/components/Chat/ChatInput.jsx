import React, { useRef, useEffect } from 'react';

const ChatInput = ({ onSend, onStop, isStreaming, disabled }) => {
    const textareaRef = useRef(null);

    // Auto resize
    const handleInput = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const value = e.target.value.trim();
            if (value && !isStreaming && !disabled) {
                onSend(value);
                e.target.value = '';
                e.target.style.height = 'auto';
            }
        }
    };

    const handleSendClick = () => {
        if (textareaRef.current) {
            const value = textareaRef.current.value.trim();
            if (value) {
                onSend(value);
                textareaRef.current.value = '';
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    return (
        <div className="chat-input-container">
            <textarea
                id="chatInput"
                ref={textareaRef}
                placeholder={disabled ? 'Claude 正在响应中...' : '输入消息，让 Claude 帮你操作服务器... (Enter 发送，Shift + Enter 换行)'}
                rows="1"
                disabled={disabled}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
            ></textarea>
            <button
                className="btn btn-stop"
                id="stopButton"
                onClick={onStop}
                disabled={!isStreaming}
            >
                停止
            </button>
            <button
                className="btn btn-primary btn-send"
                onClick={handleSendClick}
                disabled={disabled}
            >
                发送
            </button>
        </div>
    );
};

export default ChatInput;

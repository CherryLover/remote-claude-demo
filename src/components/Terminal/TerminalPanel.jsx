import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../utils/api';

const TerminalPanel = ({ selectedServerId, isVertical, onClose, onMaximize, isMaximized }) => {
    const [command, setCommand] = useState('');
    const [historyList, setHistoryList] = useState([]);
    const [cmdHistory, setCmdHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInput, setTempInput] = useState('');

    const historyRef = useRef(null);
    const inputRef = useRef(null);

    // Auto scroll when history updates
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [historyList]);

    // Focus input on click
    const handleContainerClick = () => {
        if (selectedServerId && inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleExec = async (e) => {
        if (e) e.preventDefault();
        const cmd = command.trim();
        if (!cmd) return;

        if (cmdHistory[cmdHistory.length - 1] !== cmd) {
            setCmdHistory([...cmdHistory, cmd]);
        }
        setHistoryIndex(cmdHistory.length + (cmdHistory[cmdHistory.length - 1] !== cmd ? 1 : 0));
        setTempInput('');
        setCommand('');

        const newItem = {
            id: 'exec-' + Date.now(),
            cmd: cmd,
            output: '',
            isError: false,
            loading: true
        };
        setHistoryList(prev => [...prev, newItem]);

        try {
            const res = await api.execCommand(selectedServerId, cmd);
            setHistoryList(prev => prev.map(item => {
                if (item.id === newItem.id) {
                    if (res.ok && res.result) {
                        return {
                            ...item,
                            loading: false,
                            result: {
                                exitCode: res.result.exit_code,
                                stdout: res.result.stdout,
                                stderr: res.result.stderr
                            }
                        };
                    } else {
                        return { ...item, loading: false, error: res.detail || 'Unknown error' };
                    }
                }
                return item;
            }));
        } catch (err) {
            setHistoryList(prev => prev.map(item => {
                if (item.id === newItem.id) return { ...item, loading: false, error: err.message };
                return item;
            }));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleExec(e);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length > 0) {
                if (historyIndex === cmdHistory.length) setTempInput(command);
                if (historyIndex > 0) {
                    const newIndex = historyIndex - 1;
                    setHistoryIndex(newIndex);
                    setCommand(cmdHistory[newIndex]);
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < cmdHistory.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setCommand(cmdHistory[newIndex]);
            } else if (historyIndex === cmdHistory.length - 1) {
                setHistoryIndex(cmdHistory.length);
                setCommand(tempInput);
            }
        }
    };

    if (!selectedServerId) {
        return (
            <div className="terminal-panel full-height">
                <div className="terminal-header">
                    <div className="terminal-title">TERMINAL</div>
                    <div className="terminal-controls">
                        <button className="btn-icon" onClick={onClose}>×</button>
                    </div>
                </div>
                <div className="terminal-empty-state">
                    <div className="empty-icon" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>💻</div>
                    <p style={{ color: '#ccc', fontWeight: 600 }}>TERMINAL READY</p>
                    <span style={{ color: '#666' }}>Please select a server to establish SSH connection</span>
                </div>
            </div>
        );
    }

    return (
        <div className="terminal-panel full-height" onClick={handleContainerClick}>
            <div className="terminal-header">
                <div className="terminal-title">
                    <span className="icon">_&gt;</span> {selectedServerId}
                </div>
                <div className="terminal-controls">
                    <button className="btn-icon" onClick={onMaximize} title={isMaximized ? "Restore" : "Maximize"}>
                        {isMaximized ? '❐' : '□'}
                    </button>
                    <button className="btn-icon" onClick={onClose} title="Close">×</button>
                </div>
            </div>

            <div className="terminal-body" ref={historyRef}>
                {historyList.map(item => (
                    <div className="term-item" key={item.id}>
                        <div className="term-line cmd">
                            <span className="prompt">➜</span> {item.cmd}
                        </div>
                        <div className="term-output">
                            {item.loading && <span className="loading-dots">...</span>}
                            {item.error && <span className="error">{item.error}</span>}
                            {item.result && (
                                <>
                                    {item.result.stdout}
                                    {item.result.stderr && <span className="error">{item.result.stderr}</span>}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="terminal-footer">
                <span className="prompt">{selectedServerId} $</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    autoFocus
                />
            </div>
        </div>
    );
};

export default TerminalPanel;

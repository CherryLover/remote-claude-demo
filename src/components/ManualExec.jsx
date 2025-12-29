import React, { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { escapeHtml } from '../utils/format';

const ManualExec = ({ selectedServerId }) => {
    const [command, setCommand] = useState('');
    const [historyList, setHistoryList] = useState([]); // List of execution results
    const [cmdHistory, setCmdHistory] = useState([]); // List of past commands for Up/Down
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInput, setTempInput] = useState('');

    const historyRef = useRef(null);
    const textareaRef = useRef(null);

    // Auto scroll to bottom when historyList updates
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [historyList]);

    // Auto resize textarea
    const handleInput = (e) => {
        setCommand(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
    };

    const handleExec = async () => {
        const cmd = command.trim();
        if (!selectedServerId) {
            alert('请先在上方服务器列表中选择一个已连接的服务器');
            return;
        }
        if (!cmd) {
            alert('请输入命令');
            return;
        }

        // Add to command history
        if (cmdHistory[cmdHistory.length - 1] !== cmd) {
            setCmdHistory([...cmdHistory, cmd]);
        }
        setHistoryIndex(cmdHistory.length + (cmdHistory[cmdHistory.length - 1] !== cmd ? 1 : 0));
        setTempInput('');

        setCommand('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
        }

        // Add executing item
        const newItem = {
            id: 'exec-' + Date.now(),
            cmd: cmd,
            output: '执行中...',
            isError: false,
            loading: true
        };
        setHistoryList(prev => [...prev, newItem]);

        try {
            const res = await api.execCommand(selectedServerId, cmd);

            setHistoryList(prev => prev.map(item => {
                if (item.id === newItem.id) {
                    if (res.ok && res.result) {
                        const { exit_code, stdout, stderr } = res.result;
                        let outputText = `[Exit: ${exit_code}]`;
                        if (stdout) outputText += '\n' + stdout;

                        // Store structured result for rendering
                        return {
                            ...item,
                            loading: false,
                            result: {
                                exitCode: exit_code,
                                stdout,
                                stderr
                            }
                        };
                    } else {
                        return {
                            ...item,
                            loading: false,
                            error: res.detail || 'Unknown error'
                        };
                    }
                }
                return item;
            }));

        } catch (err) {
            setHistoryList(prev => prev.map(item => {
                if (item.id === newItem.id) {
                    return { ...item, loading: false, error: err.message };
                }
                return item;
            }));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleExec();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length > 0) {
                if (historyIndex === cmdHistory.length) {
                    setTempInput(command); // Save current input
                }
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

    return (
        <div className="manual-exec">
            <h3>手动执行命令</h3>
            <div id="execHistory" className="exec-history" ref={historyRef}>
                {historyList.length === 0 && (
                    <div className="exec-history-empty">执行结果将显示在这里</div>
                )}
                {historyList.map(item => (
                    <div className="exec-history-item" key={item.id}>
                        <div className="exec-cmd">{item.cmd}</div>
                        <div className="exec-output">
                            {item.loading ? (
                                '执行中...'
                            ) : item.error ? (
                                <span className="exec-error">错误: {item.error}</span>
                            ) : (
                                <>
                                    <span>[Exit: {item.result.exitCode}]</span>
                                    {item.result.stdout && `\n${item.result.stdout}`}
                                    {item.result.stderr && (
                                        <span className="exec-error">{'\n' + item.result.stderr}</span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="exec-input-row">
                <textarea
                    id="execCommand"
                    placeholder="ls"
                    rows="1"
                    ref={textareaRef}
                    value={command}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                ></textarea>
                <button className="btn btn-primary btn-exec" onClick={handleExec}>执行</button>
            </div>
        </div>
    );
};

export default ManualExec;

import React from 'react';
import { getToolDisplayName, getToolIcon, formatToolParams } from '../../utils/format';

const ToolList = ({ tools, isStreaming }) => {
    if (!tools || tools.length === 0) return null;

    return (
        <div className="tool-list">
            {tools.map((tool, index) => {
                const displayName = getToolDisplayName(tool.name);
                const icon = getToolIcon(tool.name);
                const params = formatToolParams(tool.name, tool.input);
                const hasResult = tool.result !== undefined;
                const isRunning = isStreaming && !hasResult && index === tools.length - 1;

                let resultHtml = null;
                if (hasResult) {
                    const resultText = tool.result || '(无输出)';
                    const truncated = resultText.length > 500 ? resultText.slice(0, 500) + '...' : resultText;
                    resultHtml = (
                        <div className={`tool-result ${tool.isError ? 'error' : ''}`}>
                            {truncated}
                        </div>
                    );
                }

                return (
                    <div
                        key={tool.id}
                        className={`tool-item ${isRunning ? 'running' : ''} ${hasResult ? (tool.isError ? 'has-error' : 'has-result') : ''}`}
                    >
                        <span className="tool-icon">{icon}</span>
                        <div className="tool-tooltip">
                            <div className="tool-name">{displayName}</div>
                            <div className="tool-params">{params || '(无参数)'}</div>
                            {resultHtml}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ToolList;

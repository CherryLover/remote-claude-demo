import React, { useMemo } from 'react';
import ToolList from './ToolList';
import { formatResponse, mergeConsecutiveRefs } from '../../utils/format';

const MessageItem = ({ role, content, tools, isStreaming, isLast }) => {
    const processedHtml = useMemo(() => {
        let html = formatResponse(content);
        html = mergeConsecutiveRefs(html);
        if (!html && !content && !tools?.length) {
            // Handle empty loading state or empty message
            if (role === 'assistant' && isStreaming && isLast) {
                return '<span class="loading"></span>';
            }
            return '<span style="color: #888;">（无响应内容）</span>';
        }
        if (role === 'assistant' && !html && isStreaming && isLast) {
            return '<span class="loading"></span>';
        }
        return html;
    }, [content, role, isStreaming, isLast, tools]);

    return (
        <div className={`message ${role}`}>
            <div className="message-content">
                <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
                {(role === 'assistant') && (
                    <ToolList tools={tools} isStreaming={isStreaming && isLast} />
                )}
                {/* Error handling usually embedded in content or added as extra note */}
            </div>
        </div>
    );
};

export default MessageItem;

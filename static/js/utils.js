/**
 * 通用工具函数模块
 */

/**
 * HTML 转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 统一设置 Markdown 渲染选项
if (window.marked) {
    window.marked.setOptions({
        breaks: true,
        mangle: false,
        headerIds: false
    });
}

/**
 * 折叠/展开功能
 */
function toggleCollapse(el) {
    el.classList.toggle('collapsed');
    const content = el.nextElementSibling;
    content.classList.toggle('collapsed');
}

/**
 * 格式化响应文本（保护 tool-ref 标签）
 */
function formatResponse(text) {
    // 先保护 tool-ref 标签（用占位符替换）
    const toolRefs = [];
    let protectedText = text.replace(/<span class="tool-ref">(\d+)<\/span>/g, (_, num) => {
        toolRefs.push(num);
        return `__TOOL_REF_${toolRefs.length - 1}__`;
    });

    const sanitized = escapeHtml(protectedText);
    let html;

    if (window.marked && window.marked.parse) {
        html = window.marked.parse(sanitized);
    } else {
        // 兜底处理，至少支持基础格式
        html = sanitized
            .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
            .replace(/`([^`]+)`/g, '<code style="background:#0d0d1a;padding:2px 6px;border-radius:4px;">$1</code>')
            .replace(/\n/g, '<br>');
    }

    // 恢复 tool-ref 标签
    html = html.replace(/__TOOL_REF_(\d+)__/g, (_, idx) => {
        return `<span class="tool-ref">${toolRefs[parseInt(idx, 10)]}</span>`;
    });

    return html;
}

import { marked } from 'marked';

// Configure marked
marked.setOptions({
    breaks: true,
    mangle: false,
    headerIds: false
});

/**
 * HTML Escape
 */
export function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Format response text (Markdown + Tool Ref protection)
 */
export function formatResponse(text) {
    if (!text) return '';

    // Protect tool-ref tags
    const toolRefs = [];
    let protectedText = text.replace(/<span class="tool-ref">(\d+)<\/span>/g, (_, num) => {
        toolRefs.push(num);
        return `__TOOL_REF_${toolRefs.length - 1}__`;
    });

    // We can't use generic escape because markdown needs to be parsed.
    // Original code: escapeHtml(protectedText); then marked.parse
    // But marked expects markdown source.
    // If we escape everything, markdown symbols like # or * will be escaped and not rendered.
    // Original code:
    // const sanitized = escapeHtml(protectedText);
    // html = window.marked.parse(sanitized);
    //
    // Wait, if I escapeHtml first, then `**bold**` becomes `**bold**` (chars unchanged) 
    // but `<script>` becomes `&lt;script&gt;`.
    // marked usually handles security but extra escaping prevents HTML injection.

    // Let's stick to original logic:
    // 1. Protect refs
    // 2. Escape HTML (so user cannot inject arbitrary HTML)
    // 3. Mark parse (render markdown syntax)
    // 4. Restore refs

    // Note: escapeHtml does NOT escape * or #.

    const sanitized = escapeHtml(protectedText);
    let html = marked.parse(sanitized);

    // Restore tool-ref tags
    html = html.replace(/__TOOL_REF_(\d+)__/g, (_, idx) => {
        return `<span class="tool-ref">${toolRefs[parseInt(idx, 10)]}</span>`;
    });

    return html;
}

/**
 * Merge consecutive refs: [1][2][3] -> [1-3]
 */
export function mergeConsecutiveRefs(html) {
    if (!html) return '';
    const pattern = /(<span class="tool-ref">\d+<\/span>)+/g;

    return html.replace(pattern, (match) => {
        const nums = [];
        // We need to re-match the inner spans
        const innerRegex = /<span class="tool-ref">(\d+)<\/span>/g;
        let innerMatch;
        while ((innerMatch = innerRegex.exec(match)) !== null) {
            nums.push(parseInt(innerMatch[1]));
        }

        if (nums.length === 1) {
            return `<span class="tool-ref">${nums[0]}</span>`;
        }

        let isConsecutive = true;
        for (let i = 1; i < nums.length; i++) {
            if (nums[i] !== nums[i - 1] + 1) {
                isConsecutive = false;
                break;
            }
        }

        if (isConsecutive && nums.length > 2) {
            return `<span class="tool-ref">${nums[0]}-${nums[nums.length - 1]}</span>`;
        } else {
            return nums.map(n => `<span class="tool-ref">${n}</span>`).join('');
        }
    });
}

export function formatToolParams(name, input) {
    if (!input) return '';
    if (name === 'mcp__ssh-tools__ssh_exec' || name === 'ssh_exec') {
        if (input.command) {
            return input.command;
        }
    }
    return JSON.stringify(input, null, 2);
}

export function getToolDisplayName(name) {
    const nameMap = {
        'mcp__ssh-tools__ssh_exec': 'ssh_exec',
        'mcp__ssh-tools__ssh_list': 'ssh_list',
    };
    return nameMap[name] || name;
}

export function getToolIcon(name) {
    const displayName = getToolDisplayName(name);
    if (displayName === 'ssh_exec') return '⚡';
    if (displayName === 'ssh_list') return '📋';
    return '⚙️';
}

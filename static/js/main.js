/**
 * 应用入口和初始化模块
 */

/**
 * 初始化侧边栏拖拽
 */
function initSidebarResizer() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebarResizer');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const minWidth = 280;
        const maxWidth = window.innerWidth / 2;
        let newWidth = e.clientX;

        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

/**
 * 应用初始化
 */
function initApp() {
    // 初始化各模块事件
    initSSHEvents();
    initChatEvents();
    initSidebarResizer();

    // 加载服务器列表
    refreshServers();
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

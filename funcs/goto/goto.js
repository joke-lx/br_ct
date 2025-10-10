// content.js - 浏览器插件内容脚本
(function() {
    'use strict';

    // 防止重复注入
    if (window.circularMenuInjected) {
        return;
    }
    window.circularMenuInjected = true;

    // 注入样式
    const style = document.createElement('style');
    style.textContent = `
        .circular-menu-container {
            position: fixed;
            bottom: 100px;
            right: 100px;
            z-index: 999999;
            font-family: 'Arial', sans-serif;
        }
        .circular-menu-circle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: white;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: all 0.2s;
            user-select: none;
            font-weight: bold;
            color: #667eea;
            font-size: 24px;
            border: 3px solid #667eea;
        }
        .circular-menu-circle:hover {
            transform: scale(1.1);
        }
        .circular-menu-circle.active {
            background: #ff4757;
            color: white;
            border-color: #ff4757;
        }
        .circular-menu-item {
            position: fixed;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: white;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            opacity: 0;
            transform: scale(0);
            transition: all 0.3s ease;
            font-size: 11px;
            color: #667eea;
            font-weight: 500;
            z-index: 999998;
            pointer-events: none;
            text-align: center;
            padding: 5px;
            box-sizing: border-box;
        }
        .circular-menu-item.show {
            opacity: 1;
            transform: scale(1);
            pointer-events: auto;
        }
        .circular-menu-item:hover {
            background: #667eea;
            color: white;
            transform: scale(1.15);
            z-index: 1000000;
        }
    `;
    document.head.appendChild(style);

    // 菜单数据结构
    const menuData = {
        name: '菜单',
        isRoot: true,
        children: [
            {
                name: '📄 文件',
                children: [
                    { name: '新建', children: [] },
                    { name: '打开', children: [] },
                    { name: '保存', children: [] },
                    { name: '主题', children: [] },
                    { name: '语言', children: [] }
                ]
            },
            {
                name: '✏️ 编辑',
                children: [
                    { name: '复制', children: [] },
                    { name: '粘贴', children: [] },
                    { name: '剪切', children: [] }
                ]
            },
            {
                name: '👁️ 视图',
                children: [
                    { name: '全屏', children: [] },
                    { name: '缩放', children: [] }
                ]
            },
            {
                name: '⚙️ 设置',
                children: [
                    { name: '主题', children: [] },
                    { name: '语言', children: [] }
                ]
            },
            {
                name: '⚙️ 设置',
                children: [
                    { name: '主题', children: [] },
                    { name: '语言', children: [] }
                ]
            }
        ]
    };

    // 创建主容器
    const container = document.createElement('div');
    container.className = 'circular-menu-container';
    container.id = 'circularMenuContainer';

    // 创建主圆圈
    const mainCircle = document.createElement('div');
    mainCircle.className = 'circular-menu-circle';
    mainCircle.innerHTML = '☰';
    mainCircle.title = '点击激活菜单';
    container.appendChild(mainCircle);
    document.body.appendChild(container);

    // ========== 拖动逻辑 ==========
    let isDragging = false;
    let offsetX, offsetY;

    // 从 localStorage 读取上次位置
    const savedPos = JSON.parse(localStorage.getItem('menuPosition') || '{}');
    if (savedPos.left && savedPos.top) {
        container.style.left = savedPos.left;
        container.style.top = savedPos.top;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    mainCircle.addEventListener('mousedown', (e) => {
        if (!isActive) {
            isDragging = true;
            const rect = container.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            container.style.left = `${x}px`;
            container.style.top = `${y}px`;
            container.style.right = 'auto';
            container.style.bottom = 'auto';
            container.style.position = 'fixed';
        }
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            localStorage.setItem('menuPosition', JSON.stringify({
                left: container.style.left,
                top: container.style.top
            }));
        }
    });

    // 状态变量
    let isActive = false;
    let currentMenuItems = [];
    let activeSubmenus = [];

    function getCircleCenter() {
        const rect = mainCircle.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    // 点击切换激活状态
    mainCircle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isDragging) return;
        isActive = !isActive;

        if (isActive) {
            mainCircle.classList.add('active');
            mainCircle.innerHTML = '✕';
            mainCircle.title = '关闭菜单';
            clearMenuItems(); // 先清除旧菜单
            showMenu(menuData.children, mainCircle); // ✅ 点击后立即展开
        } else {
            mainCircle.classList.remove('active');
            mainCircle.innerHTML = '☰';
            mainCircle.title = '点击激活菜单';
            clearMenuItems();
        }
    });

    // 显示一级/二级菜单
    function showMenu(items, parentElement) {
        clearMenuItems();
        const center = getCircleCenter();
        const radius = 100;
        const angleStep = (Math.PI * 2) / items.length;

        items.forEach((item, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const menuItem = document.createElement('div');
            menuItem.className = 'circular-menu-item';
            menuItem.textContent = item.name;
            menuItem.style.left = `${center.x - 25 + x}px`;
            menuItem.style.top = `${center.y - 25 + y}px`;
            document.body.appendChild(menuItem);
            currentMenuItems.push(menuItem);

            setTimeout(() => menuItem.classList.add('show'), index * 50);

            // 悬停时展开子菜单
            menuItem.addEventListener('mouseenter', () => {
                clearSubmenus();
                if (item.children && item.children.length > 0) {
                    showSubmenu(item.children, menuItem, angle);
                }
            });

            // 点击事件
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('点击了菜单项:', item.name);
            });
        });
    }

    // ✅ 自动根据父级角度朝外展开 180°
    function showSubmenu(items, parentElement, parentAngle) {
        const rect = parentElement.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        const radius = 80;
        const spread = Math.PI; // 半圆
        const startAngle = parentAngle - spread / 2;
        const endAngle = parentAngle + spread / 2;
        const angleStep = (endAngle - startAngle) / Math.max(items.length - 1, 1);

        items.forEach((item, index) => {
            const angle = startAngle + index * angleStep;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const submenuItem = document.createElement('div');
            submenuItem.className = 'circular-menu-item';
            submenuItem.textContent = item.name;
            submenuItem.style.left = `${center.x - 25 + x}px`;
            submenuItem.style.top = `${center.y - 25 + y}px`;
            document.body.appendChild(submenuItem);
            activeSubmenus.push(submenuItem);

            setTimeout(() => submenuItem.classList.add('show'), index * 50);

            submenuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('点击了子菜单项:', item.name);
            });
        });
    }

    // 清除子菜单
    function clearSubmenus() {
        activeSubmenus.forEach(item => {
            item.classList.remove('show');
            setTimeout(() => item.remove(), 300);
        });
        activeSubmenus = [];
    }

    // 清除所有菜单项
    function clearMenuItems() {
        currentMenuItems.forEach(item => {
            item.classList.remove('show');
            setTimeout(() => item.remove(), 300);
        });
        currentMenuItems = [];
        clearSubmenus();
    }

    // 点击页面其他地方关闭菜单
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target) &&
            !e.target.classList.contains('circular-menu-item')) {
            if (isActive) {
                isActive = false;
                mainCircle.classList.remove('active');
                mainCircle.innerHTML = '☰';
                mainCircle.title = '点击激活菜单';
                clearMenuItems();
            }
        }
    });

    // 页面滚动时更新
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (isActive && currentMenuItems.length > 0) {
                showMenu(menuData.children, mainCircle);
            }
        }, 100);
    });

    console.log('圆形菜单插件已加载 (支持拖动 + 位置记忆 + 自动展开 + 子菜单方向优化)');
})();

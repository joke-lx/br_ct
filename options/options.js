/**
 * 选项页面主入口
 * 负责侧边栏导航和子页面加载
 */

const STORAGE_KEYS = {
  selectedTab: 'optionsSelectedTab',
  sidebarCollapsed: 'optionsSidebarCollapsed',
  focusMode: 'optionsFocusMode',
};

// 导航项配置
const NAV_ITEMS = [
  { icon: 'PL', name: '平台显示', page: 'platform/index.html' },
  { icon: 'API', name: 'API 配置', page: 'api/index.html' },
  { icon: 'DB', name: '存储管理', page: 'storage/index.html' },
  { icon: 'MN', name: '菜单配置', page: 'menu/index.html' },
  { icon: 'NT', name: '随手笔记', page: 'notes/index.html' },
  { icon: 'OC', name: 'OCR 批量识别', page: 'ocr/index.html' },
  { icon: 'TM', name: '倒计时面板', page: 'countdown/index.html' },
  { icon: 'PR', name: '提示词编辑', page: 'prompts_editor/prompts_editor.html' },
  { icon: 'CMD', name: '本地命令管理', page: 'local_cmd/index.html' },
];

/**
 * 初始化选项页面
 */
function initializeOptions() {
  const frame = document.getElementById('content-frame');
  const navItems = document.querySelectorAll('.nav-item');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const focusBtn = document.getElementById('focus-btn');

  // 恢复侧边栏状态
  chrome.storage.local.get([STORAGE_KEYS.sidebarCollapsed], (result) => {
    if (result[STORAGE_KEYS.sidebarCollapsed]) {
      document.querySelector('.app-container').classList.add('sidebar-collapsed');
    }
  });

  // 恢复专注模式状态
  chrome.storage.local.get([STORAGE_KEYS.focusMode], (result) => {
    if (result[STORAGE_KEYS.focusMode]) {
      document.querySelector('.app-container').classList.add('focus-mode');
    }
  });

  // 恢复上次选中的 tab
  chrome.storage.local.get([STORAGE_KEYS.selectedTab], (result) => {
    const savedTab = result[STORAGE_KEYS.selectedTab];
    if (savedTab) {
      const targetNav = document.querySelector(`[data-page="${savedTab}"]`);
      if (targetNav) {
        navItems.forEach(nav => nav.classList.remove('active'));
        targetNav.classList.add('active');
        frame.src = savedTab;
        return;
      }
    }
    // 默认加载第一个 tab
    if (navItems.length > 0) {
      navItems[0].classList.add('active');
      frame.src = navItems[0].getAttribute('data-page');
    }
  });

  // 监听导航点击事件
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page) {
        frame.src = page;
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        chrome.storage.local.set({ [STORAGE_KEYS.selectedTab]: page });
      }
    });
  });

  // 监听来自 iframe 的消息
  window.addEventListener('message', (event) => {
    if (event.data.action === 'navigateToHistory') {
      frame.src = 'countdown/history.html';
      updateNavActive('countdown/index.html');
    } else if (event.data.action === 'navigateToTimers') {
      frame.src = 'countdown/index.html';
      updateNavActive('countdown/index.html');
    } else if (event.data.action === 'refreshTimers') {
      const currentSrc = frame.src;
      if (currentSrc.includes('countdown/index.html')) {
        frame.contentWindow.postMessage({ action: 'refresh' }, '*');
      }
    }
  });

  // 侧边栏折叠按钮
  collapseBtn.addEventListener('click', () => {
    const appContainer = document.querySelector('.app-container');
    appContainer.classList.remove('focus-mode');
    const isCollapsed = appContainer.classList.toggle('sidebar-collapsed');
    chrome.storage.local.set({ [STORAGE_KEYS.sidebarCollapsed]: isCollapsed });
    chrome.storage.local.set({ [STORAGE_KEYS.focusMode]: false });
  });

  // 专注模式按钮
  focusBtn.addEventListener('click', toggleFocusMode);

  // 初始化悬浮圆环导航
  initNavRing();
}

/**
 * 初始化悬浮点导航
 */
function initNavRing() {
  const container = document.getElementById('dot-nav');
  const itemsContainer = document.getElementById('dot-nav-items');

  // 第一个导航项为退出按钮（专注模式下显示）
  const exitItem = document.createElement('div');
  exitItem.className = 'dot-nav-item';
  exitItem.id = 'dot-nav-exit';
  exitItem.innerHTML = `
    <span class="dot-nav-item-icon">X</span>
    <span class="dot-nav-item-label">退出专注</span>
  `;

  exitItem.addEventListener('click', () => {
    if (isFocusMode()) {
      toggleFocusMode();
    }
  });

  itemsContainer.appendChild(exitItem);

  // 创建导航项
  NAV_ITEMS.forEach((item) => {
    const navItem = document.createElement('div');
    navItem.className = 'dot-nav-item';
    navItem.dataset.page = item.page;
    navItem.innerHTML = `
      <span class="dot-nav-item-icon">${item.icon}</span>
      <span class="dot-nav-item-label">${item.name}</span>
    `;

    navItem.addEventListener('click', () => {
      navigateToPage(item.page);
    });

    itemsContainer.appendChild(navItem);
  });

  // 更新显示状态
  updateNavRingActive();
}

/**
 * 检查是否处于专注模式
 */
function isFocusMode() {
  const appContainer = document.querySelector('.app-container');
  return appContainer.classList.contains('focus-mode');
}

/**
 * 更新点导航的显示状态
 */
function updateNavRingActive() {
  const container = document.getElementById('dot-nav');
  const exitItem = document.getElementById('dot-nav-exit');
  const items = document.querySelectorAll('.dot-nav-item');
  const currentPage = getCurrentPage();

  // 专注模式下显示退出按钮
  if (isFocusMode()) {
    exitItem.style.display = 'flex';
  } else {
    exitItem.style.display = 'none';
  }

  // 更新选中状态
  items.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === currentPage) {
      item.classList.add('active');
    }
  });
}

/**
 * 切换专注模式
 */
function toggleFocusMode() {
  const appContainer = document.querySelector('.app-container');
  const isFocus = appContainer.classList.toggle('focus-mode');

  if (isFocus) {
    appContainer.classList.remove('sidebar-collapsed');
  }

  chrome.storage.local.set({ [STORAGE_KEYS.focusMode]: isFocus });
  updateNavRingActive();
}

/**
 * 获取当前页面路径
 */
function getCurrentPage() {
  const frame = document.getElementById('content-frame');
  if (!frame.src) return NAV_ITEMS[0].page;

  try {
    const url = new URL(frame.src);
    const pathParts = url.pathname.split('/');
    const optionsIndex = pathParts.indexOf('options');
    if (optionsIndex !== -1) {
      return pathParts.slice(optionsIndex + 1).join('/');
    }
    return pathParts[pathParts.length - 1];
  } catch {
    return NAV_ITEMS[0].page;
  }
}

/**
 * 导航到指定页面
 */
function navigateToPage(page) {
  const frame = document.getElementById('content-frame');
  const sidebarNavItems = document.querySelectorAll('.sidebar-nav .nav-item');

  // 更新 iframe
  frame.src = page;

  // 更新侧边栏激活状态
  sidebarNavItems.forEach(nav => {
    nav.classList.remove('active');
    if (nav.getAttribute('data-page') === page) {
      nav.classList.add('active');
    }
  });

  // 保存当前 tab
  chrome.storage.local.set({ [STORAGE_KEYS.selectedTab]: page });

  // 更新圆环导航的选中状态
  updateNavRingActive();
}

/**
 * 更新导航激活状态并保存
 */
function updateNavActive(page) {
  const navItems = document.querySelectorAll('.nav-item');
  const targetNav = document.querySelector(`[data-page="${page}"]`);
  if (targetNav) {
    navItems.forEach(nav => nav.classList.remove('active'));
    targetNav.classList.add('active');
    chrome.storage.local.set({ [STORAGE_KEYS.selectedTab]: page });
  }
  updateNavRingActive();
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);

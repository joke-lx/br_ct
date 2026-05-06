/**
 * 选项页面主入口
 * 负责侧边栏导航和子页面加载
 */

const STORAGE_KEYS = {
  selectedTab: 'optionsSelectedTab',
  sidebarCollapsed: 'optionsSidebarCollapsed',
};

/**
 * 初始化选项页面
 */
function initializeOptions() {
  const frame = document.getElementById('content-frame');
  const navItems = document.querySelectorAll('.nav-item');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');

  // 恢复侧边栏状态
  chrome.storage.local.get([STORAGE_KEYS.sidebarCollapsed], (result) => {
    if (result[STORAGE_KEYS.sidebarCollapsed]) {
      document.querySelector('.app-container').classList.add('sidebar-collapsed');
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
        // 更新 iframe src
        frame.src = page;

        // 更新激活状态
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // 保存当前 tab 到 storage
        chrome.storage.local.set({ [STORAGE_KEYS.selectedTab]: page });
      }
    });
  });

  // 监听来自 iframe 的消息（用于倒计时面板和流水表之间的导航）
  window.addEventListener('message', (event) => {
    if (event.data.action === 'navigateToHistory') {
      frame.src = 'countdown/history.html';
      updateNavActive('countdown/index.html');
    } else if (event.data.action === 'navigateToTimers') {
      frame.src = 'countdown/index.html';
      updateNavActive('countdown/index.html');
    } else if (event.data.action === 'refreshTimers') {
      // 通知刷新
      const currentSrc = frame.src;
      if (currentSrc.includes('countdown/index.html')) {
        frame.contentWindow.postMessage({ action: 'refresh' }, '*');
      }
    }
  });

  // 侧边栏折叠按钮
  collapseBtn.addEventListener('click', () => {
    const appContainer = document.querySelector('.app-container');
    const isCollapsed = appContainer.classList.toggle('sidebar-collapsed');
    chrome.storage.local.set({ [STORAGE_KEYS.sidebarCollapsed]: isCollapsed });
  });
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
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);

/**
 * 选项页面主入口
 * 负责侧边栏导航和子页面加载
 */

/**
 * 初始化选项页面
 */
function initializeOptions() {
  const frame = document.getElementById('content-frame');
  const navItems = document.querySelectorAll('.nav-item');

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
      }
    });
  });

  // 监听来自 iframe 的消息（用于倒计时面板和流水表之间的导航）
  window.addEventListener('message', (event) => {
    if (event.data.action === 'navigateToHistory') {
      frame.src = 'countdown/history.html';
      // 更新激活状态
      navItems.forEach(nav => nav.classList.remove('active'));
      const countdownNav = document.querySelector('[data-page="countdown/index.html"]');
      if (countdownNav) {
        countdownNav.classList.add('active');
      }
    } else if (event.data.action === 'navigateToTimers') {
      frame.src = 'countdown/index.html';
      // 更新激活状态
      navItems.forEach(nav => nav.classList.remove('active'));
      const countdownNav = document.querySelector('[data-page="countdown/index.html"]');
      if (countdownNav) {
        countdownNav.classList.add('active');
      }
    } else if (event.data.action === 'refreshTimers') {
      // 通知刷新
      const currentSrc = frame.src;
      if (currentSrc.includes('countdown/index.html')) {
        frame.contentWindow.postMessage({ action: 'refresh' }, '*');
      }
    }
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);

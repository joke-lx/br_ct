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
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);

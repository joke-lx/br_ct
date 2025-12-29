/**
 * 选项页面主入口
 * 负责侧边栏导航和子页面加载
 */

// 当前激活的页面
let currentPage = 'platform';

/**
 * 初始化选项页面
 */
function initializeOptions() {
  const frame = document.getElementById('content-frame');
  const navItems = document.querySelectorAll('.nav-item');

  // 监听 iframe 加载完成事件
  frame.addEventListener('load', () => {
    try {
      const currentPath = frame.src.split('/').pop();

      // 更新导航激活状态
      navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'platform.html')) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    } catch (e) {
      // 跨域或其他安全限制导致无法访问
      console.log('Frame loaded:', e);
    }
  });

  // 监听导航点击事件（可选：用于单页应用模式）
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // 默认链接行为会更新 iframe，这里只需要更新激活状态
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);

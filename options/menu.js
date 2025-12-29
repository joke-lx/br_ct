/**
 * 菜单配置页面
 */

const CUSTOM_MENU_CONFIG_KEY = 'customMenuConfig';

// DOM 元素
let menuConfigContent;
let statusMessage;
let currentMenuData = null;

/**
 * 初始化菜单配置页面
 */
function initializeMenuConfig() {
  menuConfigContent = document.getElementById('menu-config-content');
  statusMessage = document.getElementById('menu-status-message');

  // 加载菜单配置
  loadMenuConfig();

  // 刷新按钮
  document.getElementById('refresh-menu').addEventListener('click', loadMenuConfig);

  // 恢复默认按钮
  document.getElementById('reset-menu').addEventListener('click', resetMenuConfig);
}

/**
 * 加载菜单配置
 */
function loadMenuConfig() {
  chrome.runtime.sendMessage({ action: 'getMenuData' }, (response) => {
    if (response && response.status === 'ok' && response.data) {
      currentMenuData = response.data;
      renderMenuConfig(response.data);
    } else {
      showEmptyState('无法加载菜单配置');
    }
  });
}

/**
 * 渲染菜单配置
 */
function renderMenuConfig(menuData) {
  if (!menuData || !menuData.children || menuData.children.length === 0) {
    showEmptyState('菜单配置为空');
    return;
  }

  menuConfigContent.innerHTML = renderMenuGroup(menuData, 0);
}

/**
 * 渲染菜单分组
 */
function renderMenuGroup(group, level) {
  const indent = level * 16;
  const hasChildren = group.children && group.children.length > 0;

  let html = `
    <div class="menu-config-item" style="margin-left: ${indent}px">
      <div class="menu-config-item-header">
        <span class="menu-config-item-title">${escapeHtml(group.name)}</span>
        ${hasChildren ? `<span class="key-type">${group.children.length} 项</span>` : ''}
      </div>
  `;

  if (hasChildren) {
    html += `<div class="menu-config-item-body">`;
    group.children.forEach(child => {
      if (child.children && child.children.length > 0) {
        // 子菜单组
        html += renderMenuGroup(child, level + 1);
      } else {
        // 单个链接项
        html += renderMenuItem(child, level + 1);
      }
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * 渲染单个菜单项
 */
function renderMenuItem(item, level) {
  const indent = level * 16;
  return `
    <div class="menu-config-item" style="margin-left: ${indent}px">
      <div class="menu-config-item-header">
        <span class="menu-config-item-title">${escapeHtml(item.name)}</span>
        ${item.url ? `<span class="key-type">链接</span>` : ''}
      </div>
      ${item.url ? `<div style="font-size: 12px; color: #6c757d; margin-top: 4px; padding-left: 8px;">${escapeHtml(item.url)}</div>` : ''}
    </div>
  `;
}

/**
 * 显示空状态
 */
function showEmptyState(message) {
  menuConfigContent.innerHTML = `
    <div class="menu-empty-state">
      <div class="menu-empty-state-icon">📋</div>
      <div class="menu-empty-state-text">${message}</div>
      <div class="menu-empty-state-hint">点击"刷新"按钮重新加载</div>
    </div>
  `;
}

/**
 * 恢复默认菜单配置
 */
function resetMenuConfig() {
  if (confirm('确定要恢复默认菜单配置吗？这将清除自定义配置。')) {
    chrome.storage.local.remove(CUSTOM_MENU_CONFIG_KEY, () => {
      showStatusMessage('已恢复默认菜单配置', 'success');
      loadMenuConfig();
    });
  }
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;

  // 3秒后自动隐藏
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeMenuConfig);

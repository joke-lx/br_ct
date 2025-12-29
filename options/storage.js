/**
 * 存储调试页面
 */

// 默认菜单配置（与 gotoServer.js 保持一致）
const defaultMenuData = {
  name: '菜单',
  isRoot: true,
  children: [
    {
      name: '📄 feed',
      children: [
        { name: 'IT老齐', url: 'https://www.itlaoqi.com/chapter.html?sid=143&cid=3292', children: [] },
        { name: 'NOTION', url: 'https://www.notion.so/a23ee5b49d7d474ebf9d3e3094441088', children: [] },
        { name: 'B站', url: 'https://www.bilibili.com', children: [] },
        { name: 'github', url: 'https://github.com/', children: [] },
        { name: 'gitee', url: 'https://gitee.com/', children: [] },
      ]
    },
    {
      name: '📄 面包',
      children: [
        { name: '上海演唱会', url: 'https://www.bilibili.com/video/BV1L48qzsESK?spm_id_from=333.788.videopod.sections', children: [] },
        { name: '宁波演唱会', url: 'https://www.bilibili.com/video/BV1pca3zPECZ/?spm_id_from=333.337.search-card.all.click&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '北京演唱会', url: 'https://www.bilibili.com/video/BV13hSzYfEfD?spm_id_from=333.788.videopod.sections&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '广州演唱会', url: 'https://www.bilibili.com/video/BV1g2oiYqEiM?spm_id_from=333.788.videopod.sections&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '成都演唱会', url: 'https://www.bilibili.com/video/BV1dUjkzqEUj/?spm_id_from=333.788.videopod.sections&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '天津演唱会', url: 'https://www.bilibili.com/video/BV1hNq1BTEG8/?spm_id_from=333.337.search-card.all.click', children: [] },
      ]
    },
    {
      name: '📄 网站跳转3',
      children: [
        { name: 'gitee_api', url: 'https://gitee.com/api/v5/swagger', children: [] },
        { name: '高德地图', url: 'https://ditu.amap.com/', children: [] },
        { name: '抖音', url: 'https://www.douyin.com', children: [] },
      ]
    }
  ]
};

// DOM 元素
let debugContent;
let statusMessage;
let menuEditor;
let editorStatus;

/**
 * 初始化存储调试页面
 */
function initializeStorageDebug() {
  debugContent = document.getElementById('storage-debug-content');
  statusMessage = document.getElementById('storage-status-message');
  menuEditor = document.getElementById('menu-config-editor');
  editorStatus = document.getElementById('editor-status');

  // 加载存储数据
  loadStorageDebug();

  // 刷新按钮
  document.getElementById('refresh-storage').addEventListener('click', loadStorageDebug);

  // 清空按钮
  document.getElementById('clear-storage').addEventListener('click', clearAllStorage);

  // 菜单配置编辑器按钮
  document.getElementById('load-menu-config').addEventListener('click', loadMenuConfig);
  document.getElementById('save-menu-config').addEventListener('click', saveMenuConfig);
  document.getElementById('reset-menu-config').addEventListener('click', resetMenuConfig);
  document.getElementById('format-menu-config').addEventListener('click', formatMenuConfig);

  // 编辑器内容变化时隐藏状态
  menuEditor.addEventListener('input', () => {
    editorStatus.style.display = 'none';
  });

  // 使用事件委托处理折叠/展开
  debugContent.addEventListener('click', (e) => {
    const target = e.target.closest('[data-toggle]');
    if (!target) return;

    const toggleType = target.getAttribute('data-toggle');
    if (toggleType === 'group') {
      // 切换分组
      const content = target.nextElementSibling;
      content.classList.toggle('collapsed');
    } else if (toggleType === 'item') {
      // 切换项目
      const content = target.nextElementSibling;
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
    }
  });
}

/**
 * 加载并显示存储数据（分组显示）
 */
function loadStorageDebug() {
  chrome.storage.local.get(null, (items) => {
    if (Object.keys(items).length === 0) {
      debugContent.innerHTML = '';
      return;
    }

    // 对 key 进行分组
    const grouped = groupStorageKeys(items);

    // 渲染分组
    debugContent.innerHTML = renderGroupedStorage(grouped);
  });
}

/**
 * 对存储 key 进行分组
 */
function groupStorageKeys(items) {
  const groups = {
    queue: { name: '📋 任务队列', items: [], keys: [] },
    config: { name: '⚙️ 配置设置', items: [], keys: [] },
    menu: { name: '📋 菜单配置', items: [], keys: [] },
    video: { name: '🎬 视频配置', items: [], keys: [] },
    history: { name: '🕒 历史记录', items: [], keys: [] },
    other: { name: '📦 其他数据', items: [], keys: [] }
  };

  Object.entries(items).forEach(([key, value]) => {
    const item = { key, value };

    // 队列相关
    if (key.includes('Queue') || key.includes('queue') || key === 'actionsQueue') {
      groups.queue.items.push(item);
      groups.queue.keys.push(key);
    }
    // 配置相关
    else if (key.includes('Config') || key.includes('config') || key.includes('Settings') || key.includes('settings')) {
      groups.config.items.push(item);
      groups.config.keys.push(key);
    }
    // 菜单相关
    else if (key.includes('Menu') || key.includes('menu')) {
      groups.menu.items.push(item);
      groups.menu.keys.push(key);
    }
    // 视频相关
    else if (key.includes('video') || key.includes('Video')) {
      groups.video.items.push(item);
      groups.video.keys.push(key);
    }
    // 历史记录
    else if (key.includes('history') || key.includes('History')) {
      groups.history.items.push(item);
      groups.history.keys.push(key);
    }
    // 其他
    else {
      groups.other.items.push(item);
      groups.other.keys.push(key);
    }
  });

  // 只返回有数据的分组
  return Object.values(groups).filter(g => g.items.length > 0);
}

/**
 * 渲染分组存储
 */
function renderGroupedStorage(groups) {
  return groups.map(group => `
    <div class="storage-group">
      <div class="storage-group-header" data-toggle="group">
        <span>${group.name}</span>
        <span class="group-badge">${group.items.length} 项</span>
      </div>
      <div class="storage-group-content">
        ${group.items.map(item => renderStorageItem(item)).join('')}
      </div>
    </div>
  `).join('');
}

/**
 * 渲染单个存储项
 */
function renderStorageItem(item) {
  const valueType = getValueType(item.value);
  const content = renderValue(item.value, item.key);

  return `
    <div class="storage-item">
      <div class="storage-item-header" data-toggle="item">
        <span class="key-name">${escapeHtml(item.key)}</span>
        <span class="key-type">${valueType}</span>
      </div>
      <div class="storage-item-content" style="display: none;">
        ${content}
      </div>
    </div>
  `;
}

/**
 * 获取值类型
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array[]';
    return `array[${value.length}]`;
  }
  const type = typeof value;
  if (type === 'object') return 'object';
  return type;
}

/**
 * 渲染值（结构化显示）
 */
function renderValue(value, key) {
  // 特殊处理 actionsQueue
  if (key === 'actionsQueue' && Array.isArray(value)) {
    return renderActionsQueue(value);
  }

  // 数组类型
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<div class="json-null">空数组 []</div>';
    }
    return `
      <div class="json-viewer">
        ${value.map((item, index) => `
          <div class="array-card">
            <div class="array-card-header">[${index}] ${getValueType(item)}</div>
            <div class="array-card-body">${formatValue(item)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 对象类型
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '<div class="json-null">空对象 {}</div>';
    }
    return `
      <div class="json-viewer">
        ${Object.entries(value).map(([k, v]) => `
          <div class="json-object-item">
            <span class="json-key">${escapeHtml(k)}</span>: <span class="json-${getJsonClass(v)}">${formatValue(v)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 基础类型
  return `<div class="json-viewer"><span class="json-${getJsonClass(value)}">${escapeHtml(String(value))}</span></div>`;
}

/**
 * 特殊渲染 actionsQueue
 */
function renderActionsQueue(queue) {
  if (!queue || queue.length === 0) {
    return '<div class="json-null">队列为空</div>';
  }

  return `
    <div>
      ${queue.map((item, index) => {
        const platform = item.platform || 'unknown';
        const message = item.message ? (typeof item.message === 'string' ? item.message : JSON.stringify(item.message).substring(0, 100)) : '';
        return `
          <div class="queue-item">
            <div class="queue-item-index">${index + 1}</div>
            <div class="queue-item-content">
              <span class="queue-item-platform">${escapeHtml(platform)}</span>
              ${message ? `<div style="color: #6c757d; margin-top: 2px;">${escapeHtml(message)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 格式化值用于显示
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${escapeHtml(value)}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (typeof value === 'object') return `Object{${Object.keys(value).length} keys}`;
  return String(value);
}

/**
 * 获取 JSON CSS 类名
 */
function getJsonClass(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'object';
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 清空所有存储数据
 */
function clearAllStorage() {
  if (confirm('确定要清空所有存储数据吗？此操作不可恢复！')) {
    chrome.storage.local.clear(() => {
      showStatusMessage('存储数据已清空', 'success');
      loadStorageDebug();
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

// ==================== 菜单配置编辑功能 ====================

/**
 * 加载菜单配置到编辑器
 */
function loadMenuConfig() {
  chrome.storage.local.get(['customMenuConfig'], (result) => {
    const config = result.customMenuConfig || defaultMenuData;
    menuEditor.value = JSON.stringify(config, null, 2);
    showEditorStatus('配置已加载', 'valid');
  });
}

/**
 * 保存菜单配置
 */
function saveMenuConfig() {
  const configText = menuEditor.value.trim();

  if (!configText) {
    showEditorStatus('配置不能为空', 'invalid');
    return;
  }

  try {
    const config = JSON.parse(configText);

    // 验证配置结构
    if (!validateMenuConfig(config)) {
      showEditorStatus('配置结构无效：必须包含 name, isRoot, children 属性', 'invalid');
      return;
    }

    // 保存到 storage
    chrome.storage.local.set({ customMenuConfig: config }, () => {
      showEditorStatus('配置已保存到 customMenuConfig', 'valid');
      showStatusMessage('菜单配置已保存', 'success');
      // 刷新存储显示
      loadStorageDebug();
    });
  } catch (e) {
    showEditorStatus('JSON 格式错误: ' + e.message, 'invalid');
  }
}

/**
 * 重置为默认配置
 */
function resetMenuConfig() {
  if (confirm('确定要重置为默认菜单配置吗？当前自定义配置将被删除。')) {
    menuEditor.value = JSON.stringify(defaultMenuData, null, 2);
    showEditorStatus('已重置为默认配置（点击保存生效）', 'valid');

    // 删除自定义配置
    chrome.storage.local.remove(['customMenuConfig'], () => {
      showStatusMessage('已重置为默认菜单配置', 'success');
      loadStorageDebug();
    });
  }
}

/**
 * 格式化 JSON
 */
function formatMenuConfig() {
  const configText = menuEditor.value.trim();

  if (!configText) {
    showEditorStatus('没有内容可格式化', 'invalid');
    return;
  }

  try {
    const config = JSON.parse(configText);
    menuEditor.value = JSON.stringify(config, null, 2);
    showEditorStatus('已格式化', 'valid');
  } catch (e) {
    showEditorStatus('JSON 格式错误，无法格式化: ' + e.message, 'invalid');
  }
}

/**
 * 验证菜单配置结构
 */
function validateMenuConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (typeof config.name !== 'string') return false;
  if (typeof config.isRoot !== 'boolean') return false;
  if (!Array.isArray(config.children)) return false;

  // 递归验证子项
  for (const child of config.children) {
    if (!child || typeof child !== 'object') return false;
    if (typeof child.name !== 'string') return false;
    if (!Array.isArray(child.children)) return false;

    // 叶子节点应该有 url
    if (child.children.length === 0 && typeof child.url !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * 显示编辑器状态
 */
function showEditorStatus(message, type) {
  editorStatus.textContent = message;
  editorStatus.className = `editor-status ${type}`;
  editorStatus.style.display = 'block';

  // 3秒后自动隐藏
  setTimeout(() => {
    editorStatus.style.display = 'none';
  }, 3000);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeStorageDebug);

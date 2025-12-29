// options.js

const CUSTOM_MENU_CONFIG_KEY = 'customMenuConfig';

// 平台配置数据
const PLATFORM_CONFIG = {
  yuanbao: {
    name: '元宝',
    icon: '元',
    color: '#ff6b35',
    defaultVisible: true
  },
  gemini: {
    name: 'Gemini',
    icon: 'G',
    color: '#4285f4',
    defaultVisible: true
  },
  chatgpt: {
    name: 'ChatGPT',
    icon: 'C',
    color: '#10a37f',
    defaultVisible: true
  },
  claude: {
    name: 'Claude',
    icon: 'A',
    color: '#cc785c',
    defaultVisible: true
  },
  doubao: {
    name: '豆包',
    icon: '豆',
    color: '#ff6900',
    defaultVisible: true
  },
  googlestudio: {
    name: 'GAS',
    icon: 'GAS',
    color: '#5f6368',
    defaultVisible: true
  },
  tongyi: {
    name: '通义',
    icon: '通',
    color: '#ff6600',
    defaultVisible: true
  },
   glm: {
    name: 'glm',
    icon: 'g',
    color: '#62a3d8ff',
    defaultVisible: true
  }
};

const PLATFORM_VISIBILITY_KEY = 'platformVisibilitySettings';

// DOM 元素
let platformGrid;
let statusMessage;

/**
 * 初始化选项页面
 */
function initializeOptions() {
  platformGrid = document.getElementById('platform-grid');
  statusMessage = document.getElementById('status-message');

  // 生成平台选项
  generatePlatformOptions();

  // 加载保存的设置
  loadPlatformVisibilitySettings();

  // 绑定事件监听器
  bindEventListeners();

  // 初始化新功能
  initStorageDebug();
  initMenuConfig();
}

/**
 * 生成平台选项
 */
function generatePlatformOptions() {
  platformGrid.innerHTML = '';

  Object.entries(PLATFORM_CONFIG).forEach(([platformId, config]) => {
    const platformItem = document.createElement('div');
    platformItem.className = 'platform-item';

    platformItem.innerHTML = `
      <input
        type="checkbox"
        class="platform-checkbox"
        id="platform-${platformId}"
        data-platform="${platformId}"
      >
      <label class="platform-label" for="platform-${platformId}">
        <div class="platform-icon" style="background-color: ${config.color}">
          ${config.icon}
        </div>
        <span>${config.name}</span>
      </label>
    `;

    platformGrid.appendChild(platformItem);
  });
}

/**
 * 加载平台可见性设置
 */
function loadPlatformVisibilitySettings() {
  chrome.storage.local.get([PLATFORM_VISIBILITY_KEY], (result) => {
    const settings = result[PLATFORM_VISIBILITY_KEY] || {};

    // 应用保存的设置，如果没有保存的设置则使用默认值
    Object.entries(PLATFORM_CONFIG).forEach(([platformId, config]) => {
      const checkbox = document.getElementById(`platform-${platformId}`);
      if (checkbox) {
        checkbox.checked = settings.hasOwnProperty(platformId)
          ? settings[platformId]
          : config.defaultVisible;
      }
    });
  });
}

/**
 * 保存平台可见性设置
 */
function savePlatformVisibilitySettings() {
  const settings = {};

  // 收集所有平台的可见性设置
  Object.keys(PLATFORM_CONFIG).forEach(platformId => {
    const checkbox = document.getElementById(`platform-${platformId}`);
    if (checkbox) {
      settings[platformId] = checkbox.checked;
    }
  });

  // 保存到本地存储
  chrome.storage.local.set({ [PLATFORM_VISIBILITY_KEY]: settings }, () => {
    showStatusMessage('设置已保存', 'success');

    // 通知popup页面更新平台显示
    chrome.runtime.sendMessage({
      action: 'platformVisibilityUpdated',
      settings: settings
    }).catch(() => {
      console.log('Popup页面可能未打开，忽略消息错误');
    });
  });
}

/**
 * 重置为默认设置
 */
function resetToDefaults() {
  Object.entries(PLATFORM_CONFIG).forEach(([platformId, config]) => {
    const checkbox = document.getElementById(`platform-${platformId}`);
    if (checkbox) {
      checkbox.checked = config.defaultVisible;
    }
  });

  showStatusMessage('已重置为默认设置', 'success');
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  // 3秒后自动隐藏
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 3000);
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
  // 保存设置按钮
  document.getElementById('save-settings').addEventListener('click', savePlatformVisibilitySettings);

  // 重置设置按钮
  document.getElementById('reset-settings').addEventListener('click', resetToDefaults);

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'getPlatformVisibilitySettings') {
      const settings = {};
      Object.keys(PLATFORM_CONFIG).forEach(platformId => {
        const checkbox = document.getElementById(`platform-${platformId}`);
        if (checkbox) {
          settings[platformId] = checkbox.checked;
        }
      });
      sendResponse({ settings });
    }
  });
}

// ==================== 存储调试功能 ====================

/**
 * 初始化存储调试功能
 */
function initStorageDebug() {
  loadStorageDebug();

  // 刷新按钮
  document.getElementById('refresh-storage').addEventListener('click', loadStorageDebug);

  // 清空按钮
  document.getElementById('clear-storage').addEventListener('click', clearAllStorage);

  // 使用事件委托处理折叠/展开
  document.getElementById('storage-debug-content').addEventListener('click', (e) => {
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
    const debugContent = document.getElementById('storage-debug-content');

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
      loadPlatformVisibilitySettings();
      loadMenuConfig();
    });
  }
}

// ==================== 自定义菜单配置功能 ====================

/**
 * 初始化菜单配置功能
 */
function initMenuConfig() {
  loadMenuConfig();

  // 保存按钮
  document.getElementById('save-menu-config').addEventListener('click', saveMenuConfig);

  // 恢复默认按钮
  document.getElementById('reset-menu-config').addEventListener('click', resetMenuConfig);
}

/**
 * 加载菜单配置
 */
function loadMenuConfig() {
  chrome.storage.local.get([CUSTOM_MENU_CONFIG_KEY], (result) => {
    const textarea = document.getElementById('menu-config-textarea');

    if (result[CUSTOM_MENU_CONFIG_KEY]) {
      // 如果有自定义配置，格式化后显示
      textarea.value = JSON.stringify(result[CUSTOM_MENU_CONFIG_KEY], null, 2);
    } else {
      // 如果没有自定义配置，显示空
      textarea.value = '';
    }
  });
}

/**
 * 保存菜单配置
 */
function saveMenuConfig() {
  const textarea = document.getElementById('menu-config-textarea');
  const configText = textarea.value.trim();

  if (!configText) {
    // 如果为空，删除自定义配置
    chrome.storage.local.remove(CUSTOM_MENU_CONFIG_KEY, () => {
      showStatusMessage('已清除自定义配置，将使用默认菜单', 'success');
    });
    return;
  }

  try {
    const config = JSON.parse(configText);

    // 验证配置格式
    if (!config.name || !config.children || !Array.isArray(config.children)) {
      throw new Error('配置格式错误：必须包含 name 和 children 字段');
    }

    // 保存配置
    chrome.storage.local.set({ [CUSTOM_MENU_CONFIG_KEY]: config }, () => {
      showStatusMessage('菜单配置已保存', 'success');
    });
  } catch (error) {
    showStatusMessage('配置格式错误：' + error.message, 'error');
  }
}

/**
 * 恢复默认菜单配置
 */
function resetMenuConfig() {
  if (confirm('确定要恢复默认菜单配置吗？')) {
    chrome.storage.local.remove(CUSTOM_MENU_CONFIG_KEY, () => {
      document.getElementById('menu-config-textarea').value = '';
      showStatusMessage('已恢复默认菜单配置', 'success');
    });
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);
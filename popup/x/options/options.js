// options.js

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
    }).catch(err => {
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
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeOptions);
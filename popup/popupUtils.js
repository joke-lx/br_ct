
import { populateOptimizer } from './promots/promptsUI.js';

// popupUtils.js
const HISTORY_KEY = 'messageHistory';
const OPTIMIZER_KEY = 'selectedOptimizer';
const MAX_HISTORY = 5;

// DOM 元素缓存
let elements = {};

/**
 * 初始化弹窗，获取并缓存 DOM 元素
 */
function initializePopup() {
  elements = {
    platformCheckboxes: document.querySelectorAll('.platform-icon-option input[type="checkbox"]'),
    messageInput: document.getElementById('message-input'),
    sendButton: document.getElementById('send-button'),
    selectAllButton: document.getElementById('select-all'),
    historySelect: document.getElementById('history-select'),
    promptOptimizerSelect: document.getElementById('prompt-optimizer-select')
  };

  // 自动聚焦输入框
  if (elements.messageInput) {
    setTimeout(() => {
      elements.messageInput.focus();
      const len = elements.messageInput.value.length;
      elements.messageInput.setSelectionRange(len, len);
    }, 100);
  }

  // 初始化优化器下拉框
  populateOptimizer(elements.promptOptimizerSelect);
}

/**
 * 加载存储的数据
 */
function loadStoredData() {
  chrome.storage.sync.get(['lastMessage', 'platformStates', HISTORY_KEY, OPTIMIZER_KEY], (result) => {
    // 恢复最后输入的消息
    if (result.lastMessage) {
      elements.messageInput.value = result.lastMessage;
    }
    
    // 恢复平台选择状态
    if (result.platformStates) {
      restorePlatformStates(result.platformStates);
    }
    
    // 恢复历史记录
    if (result[HISTORY_KEY]) {
      populateHistory(elements.historySelect, result[HISTORY_KEY]);
    }
    
    // 恢复优化器选择
    if (result[OPTIMIZER_KEY]) {
      elements.promptOptimizerSelect.value = result[OPTIMIZER_KEY];
    }
  });
}

/**
 * 恢复平台选择状态
 */
function restorePlatformStates(platformStates) {
  elements.platformCheckboxes.forEach(cb => {
    const iconWrapper = cb.closest('.platform-icon-option').querySelector('.icon-wrapper');
    
    if (platformStates.hasOwnProperty(cb.dataset.platform)) {
      cb.checked = platformStates[cb.dataset.platform];
      if (iconWrapper) {
        iconWrapper.classList.toggle('checked', cb.checked);
      }
    }
  });
  updateSelectAllText();
}

/**
 * 设置所有事件监听器
 */
function setupEventListeners() {
  // 输入框内容变化时保存
  elements.messageInput.addEventListener('input', () => {
    chrome.storage.sync.set({ lastMessage: elements.messageInput.value });
  });

  // 历史记录选择
  elements.historySelect.addEventListener('change', () => {
    if (elements.historySelect.value) {
      elements.messageInput.value = elements.historySelect.value;
      elements.messageInput.dispatchEvent(new Event('input'));
    }
  });

  // 优化器选择
  elements.promptOptimizerSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ [OPTIMIZER_KEY]: elements.promptOptimizerSelect.value });
  });

  // 平台复选框变化
  elements.platformCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const iconWrapper = cb.closest('.platform-icon-option').querySelector('.icon-wrapper');
      if (iconWrapper) {
        iconWrapper.classList.toggle('checked', cb.checked);
      }
      savePlatformStates();
      updateSelectAllText();
    });
  });

  // 全选/取消全选按钮
  elements.selectAllButton.addEventListener('click', toggleSelectAll);

  // 发送按钮
  elements.sendButton.addEventListener('click', startSending);
}

/**
 * 更新全选按钮文本
 */
function updateSelectAllText() {
  const allChecked = Array.from(elements.platformCheckboxes).every(checkbox => checkbox.checked);
  elements.selectAllButton.textContent = allChecked ? '取消全选' : '全选';
}

/**
 * 切换全选/取消全选状态
 */
function toggleSelectAll() {
  const allChecked = Array.from(elements.platformCheckboxes).every(checkbox => checkbox.checked);
  
  elements.platformCheckboxes.forEach(checkbox => { 
    checkbox.checked = !allChecked; 
    const iconWrapper = checkbox.closest('.platform-icon-option').querySelector('.icon-wrapper');
    if (iconWrapper) {
      iconWrapper.classList.toggle('checked', checkbox.checked);
    }
  });
  
  updateSelectAllText();
  savePlatformStates();
}



/**
 * 渲染历史消息
 */
function populateHistory(historySelect, history) {
  historySelect.innerHTML = `<option value="">选择历史消息</option>`;
  history.forEach(msg => {
    const opt = document.createElement('option');
    opt.value = msg;
    opt.textContent = msg.length > 40 ? msg.slice(0, 40) + '...' : msg;
    historySelect.appendChild(opt);
  });
}

/**
 * 添加消息到历史
 */
function addToHistory(message) {
  chrome.storage.sync.get(HISTORY_KEY, (result) => {
    let history = result[HISTORY_KEY] || [];
    history = history.filter(item => item !== message);
    history.unshift(message);
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    chrome.storage.sync.set({ [HISTORY_KEY]: history }, () => {
      populateHistory(elements.historySelect, history);
    });
  });
}

/**
 * 保存平台勾选状态
 */
function savePlatformStates() {
  const checkedStates = {};
  elements.platformCheckboxes.forEach(cb => {
    checkedStates[cb.dataset.platform] = cb.checked;
  });
  chrome.storage.sync.set({ platformStates: checkedStates });
}

/**
 * 发送消息逻辑
 */
function startSending() {
  const originalMessage = elements.messageInput.value.trim();
  if (!originalMessage) {
    console.error('请输入消息内容');
    return;
  }

  const optimizerKey = elements.promptOptimizerSelect.value;
  let finalMessage = originalMessage;

  if (optimizerKey && PROMPT_TEMPLATES[optimizerKey]) {
    const template = PROMPT_TEMPLATES[optimizerKey].template;
    finalMessage = template.includes('%s')
      ? template.replace('%s', originalMessage)
      : originalMessage + ' ' + template;
  }

  const selectedPlatforms = Array.from(elements.platformCheckboxes)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.dataset.platform);

  if (selectedPlatforms.length === 0) {
    console.error('请至少选择一个平台');
    return;
  }

  savePlatformStates();
  addToHistory(originalMessage);

  elements.sendButton.disabled = true;
  elements.sendButton.textContent = '发送中...';

  const actionsQueue = selectedPlatforms.map(platform => ({ platform, message: finalMessage }));

  chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
    window.close();
  });
}

export {
  HISTORY_KEY,
  OPTIMIZER_KEY,
  initializePopup,
  setupEventListeners,
  loadStoredData,
  startSending
};

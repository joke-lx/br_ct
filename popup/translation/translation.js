/**
 * 划词翻译设置页面
 * 管理翻译和OCR相关的设置
 */

// DOM 元素
let selectionPromptInput, selectionStreamToggle, selectionThinkingToggle;
let ocrPromptInput, ocrStreamToggle, ocrThinkingToggle, ocrSilentModeToggle;
let flowRateControl, flowRateSlider, flowRateValue, flowRateWarning;
let ocrShortcutInput, clearOcrShortcutBtn;
let favoritesShortcutInput, clearFavoritesShortcutBtn;
let autoTranslateToggle, showContextMenuToggle;
let todayCountEl, totalCountEl;

// 快捷键录制状态
let isRecordingOcrShortcut = false;
let isRecordingFavoritesShortcut = false;

// 流速档位配置
const FLOW_RATE_PRESETS = {
  1: { name: '很慢', outputInterval: 60, chunkSize: 8, warning: false },
  2: { name: '较慢', outputInterval: 45, chunkSize: 10, warning: false },
  3: { name: '中等', outputInterval: 35, chunkSize: 12, warning: false },
  4: { name: '较快', outputInterval: 25, chunkSize: 15, warning: true },
  5: { name: '很快', outputInterval: 15, chunkSize: 20, warning: true }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取 DOM 元素
  selectionPromptInput = document.getElementById('selectionPromptInput');
  selectionStreamToggle = document.getElementById('selectionStreamToggle');
  selectionThinkingToggle = document.getElementById('selectionThinkingToggle');
  ocrPromptInput = document.getElementById('ocrPromptInput');
  ocrStreamToggle = document.getElementById('ocrStreamToggle');
  ocrThinkingToggle = document.getElementById('ocrThinkingToggle');
  ocrSilentModeToggle = document.getElementById('ocrSilentModeToggle');
  flowRateControl = document.getElementById('flowRateControl');
  flowRateSlider = document.getElementById('flowRateSlider');
  flowRateValue = document.getElementById('flowRateValue');
  flowRateWarning = document.getElementById('flowRateWarning');
  ocrShortcutInput = document.getElementById('ocrShortcutInput');
  clearOcrShortcutBtn = document.getElementById('clearOcrShortcutBtn');
  favoritesShortcutInput = document.getElementById('favoritesShortcutInput');
  clearFavoritesShortcutBtn = document.getElementById('clearFavoritesShortcutBtn');
  autoTranslateToggle = document.getElementById('autoTranslate');
  showContextMenuToggle = document.getElementById('showContextMenu');
  todayCountEl = document.getElementById('todayCount');
  totalCountEl = document.getElementById('totalCount');

  // 加载设置
  loadSettings();
  loadStatistics();

  // 绑定事件
  bindEvents();
});

// 绑定事件
function bindEvents() {
  // 返回按钮
  document.getElementById('back-to-popup').addEventListener('click', () => {
    window.location.href = '../popup.html';
  });

  // 划词翻译设置
  selectionPromptInput.addEventListener('input', saveSelectionSettings);
  selectionStreamToggle.addEventListener('change', saveSelectionSettings);
  selectionThinkingToggle.addEventListener('change', saveSelectionSettings);

  // OCR 设置
  ocrPromptInput.addEventListener('input', saveOCRSettings);
  ocrStreamToggle.addEventListener('change', () => {
    saveOCRSettings();
    updateFlowRateControlVisibility();
  });
  ocrThinkingToggle.addEventListener('change', saveOCRSettings);
  ocrSilentModeToggle.addEventListener('change', saveOCRSettings);

  // 流速控制
  flowRateSlider.addEventListener('input', updateFlowRateDisplay);
  flowRateSlider.addEventListener('change', saveFlowRate);

  // 功能开关
  autoTranslateToggle.addEventListener('change', saveSettings);
  showContextMenuToggle.addEventListener('change', saveSettings);

  // 快捷键设置
  ocrShortcutInput.addEventListener('click', startOcrShortcutRecording);
  clearOcrShortcutBtn.addEventListener('click', clearOcrShortcut);
  favoritesShortcutInput.addEventListener('click', startFavoritesShortcutRecording);
  clearFavoritesShortcutBtn.addEventListener('click', clearFavoritesShortcut);

  // 打开收藏管理
  document.getElementById('openFavoritesBtn').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('modules/translation/favorites/favorites.html')
    });
  });
}

// 加载设置
function loadSettings() {
  chrome.storage.local.get(['translation.settings'], (result) => {
    const settings = result['translation.settings'] || {
      autoTranslate: false,
      showContextMenu: true,
      selectionPrompt: '请解释 %s',
      selectionStream: true,
      selectionThinking: false,
      ocrPrompt: '请识别图片中的所有文字内容',
      ocrStream: false,
      ocrThinking: false,
      flowRate: 3
    };

    // 应用设置
    autoTranslateToggle.checked = settings.autoTranslate;
    showContextMenuToggle.checked = settings.showContextMenu;
    selectionPromptInput.value = settings.selectionPrompt || '请解释 %s';
    selectionStreamToggle.checked = settings.selectionStream !== false;
    selectionThinkingToggle.checked = settings.selectionThinking || false;
    ocrPromptInput.value = settings.ocrPrompt || '请识别图片中的所有文字内容';
    ocrStreamToggle.checked = settings.ocrStream || false;
    ocrThinkingToggle.checked = settings.ocrThinking || false;
    ocrSilentModeToggle.checked = settings.ocrSilentMode || false;
    flowRateSlider.value = settings.flowRate || 3;

    updateFlowRateDisplay();
    updateFlowRateControlVisibility();

    // 加载快捷键
    loadOcrShortcut();
    loadFavoritesShortcut();
  });
}

// 保存基础设置
function saveSettings() {
  chrome.storage.local.get(['translation.settings'], (result) => {
    const settings = result['translation.settings'] || {};
    settings.autoTranslate = autoTranslateToggle.checked;
    settings.showContextMenu = showContextMenuToggle.checked;

    chrome.storage.local.set({ 'translation.settings': settings }, () => {
      console.log('[Translation] 设置已保存');
      notifySettingsChanged();
    });
  });
}

// 保存划词翻译设置
function saveSelectionSettings() {
  chrome.storage.local.get(['translation.settings'], (result) => {
    const settings = result['translation.settings'] || {};
    settings.selectionPrompt = selectionPromptInput.value;
    settings.selectionStream = selectionStreamToggle.checked;
    settings.selectionThinking = selectionThinkingToggle.checked;

    chrome.storage.local.set({ 'translation.settings': settings }, () => {
      console.log('[Translation] 划词翻译设置已保存');
    });
  });
}

// 保存 OCR 设置
function saveOCRSettings() {
  chrome.storage.local.get(['translation.settings'], (result) => {
    const settings = result['translation.settings'] || {};
    settings.ocrPrompt = ocrPromptInput.value;
    settings.ocrStream = ocrStreamToggle.checked;
    settings.ocrThinking = ocrThinkingToggle.checked;
    settings.ocrSilentMode = ocrSilentModeToggle.checked;

    chrome.storage.local.set({ 'translation.settings': settings }, () => {
      console.log('[Translation] OCR 设置已保存');
      notifySettingsChanged();
    });
  });
}

// 更新流速控制显示
function updateFlowRateDisplay() {
  const level = parseInt(flowRateSlider.value);
  const preset = FLOW_RATE_PRESETS[level];

  flowRateValue.textContent = preset.name;
  flowRateWarning.style.display = preset.warning ? 'block' : 'none';
}

// 更新流速控制可见性
function updateFlowRateControlVisibility() {
  const show = ocrStreamToggle.checked;
  flowRateControl.style.display = show ? 'block' : 'none';
}

// 保存流速设置
function saveFlowRate() {
  chrome.storage.local.get(['translation.settings'], (result) => {
    const settings = result['translation.settings'] || {};
    settings.flowRate = parseInt(flowRateSlider.value);

    chrome.storage.local.set({ 'translation.settings': settings }, () => {
      console.log('[Translation] 流速设置已保存');
    });
  });
}

// ==================== OCR 快捷键 ====================

// 开始录制 OCR 快捷键
function startOcrShortcutRecording() {
  if (isRecordingOcrShortcut) return;

  isRecordingOcrShortcut = true;
  ocrShortcutInput.classList.add('recording');
  ocrShortcutInput.value = '请按下快捷键组合...';
  ocrShortcutInput.disabled = true;

  // 监听键盘事件
  document.addEventListener('keydown', recordOcrShortcut);
  document.addEventListener('keyup', finishOcrShortcutRecording);
}

// 录制 OCR 快捷键
function recordOcrShortcut(e) {
  e.preventDefault();
  e.stopPropagation();

  // 获取按下的修饰键
  const modifiers = [];
  if (e.ctrlKey) modifiers.push('Ctrl');
  if (e.altKey) modifiers.push('Alt');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.metaKey) modifiers.push('Meta');

  // 获取主键（排除修饰键）
  const mainKey = e.key;

  // 验证快捷键是否有效
  if (modifiers.length === 0) {
    ocrShortcutInput.value = '请至少按下一个修饰键 (Ctrl/Alt/Shift/Meta)';
    return;
  }

  // 构建快捷键字符串
  const shortcutString = [...modifiers, mainKey].join('+');
  ocrShortcutInput.value = shortcutString;
}

// 完成 OCR 快捷键录制
function finishOcrShortcutRecording(e) {
  e.preventDefault();
  e.stopPropagation();

  isRecordingOcrShortcut = false;
  ocrShortcutInput.classList.remove('recording');
  ocrShortcutInput.disabled = false;

  // 移除监听器
  document.removeEventListener('keydown', recordOcrShortcut);
  document.removeEventListener('keyup', finishOcrShortcutRecording);

  // 解析快捷键
  const shortcutString = ocrShortcutInput.value;

  // 验证快捷键格式
  if (!shortcutString || shortcutString.includes('请按下')) {
    ocrShortcutInput.value = '';
    return;
  }

  // 保存快捷键
  const shortcut = parseShortcutString(shortcutString);
  saveOcrShortcut(shortcut);

  // 显示友好的格式
  ocrShortcutInput.value = formatShortcutDisplay(shortcutString);
}

// 解析快捷键字符串为对象
function parseShortcutString(shortcutString) {
  const parts = shortcutString.split('+');
  return {
    ctrlKey: parts.includes('Ctrl'),
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    metaKey: parts.includes('Meta'),
    key: parts[parts.length - 1] // 最后一个是主键
  };
}

// 格式化快捷键显示
function formatShortcutDisplay(shortcutString) {
  return shortcutString
    .replace('Control', 'Ctrl')
    .replace('Meta', 'Cmd');
}

// 保存 OCR 快捷键到存储
function saveOcrShortcut(shortcut) {
  chrome.storage.local.set({ 'translation.ocr.shortcut': shortcut });

  // 通知所有标签页更新快捷键监听
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'translation.ocr.updateShortcut',
        shortcut: shortcut
      }).catch(() => {
        // 忽略无法发送消息的标签页
      });
    });
  });

  console.log('[Translation] OCR 快捷键已保存:', shortcut);
}

// 加载 OCR 快捷键
function loadOcrShortcut() {
  chrome.storage.local.get(['translation.ocr.shortcut'], (result) => {
    if (result['translation.ocr.shortcut']) {
      const shortcut = result['translation.ocr.shortcut'];
      const parts = [];
      if (shortcut.ctrlKey) parts.push('Ctrl');
      if (shortcut.altKey) parts.push('Alt');
      if (shortcut.shiftKey) parts.push('Shift');
      if (shortcut.metaKey) parts.push('Meta');
      parts.push(shortcut.key);

      ocrShortcutInput.value = formatShortcutDisplay(parts.join('+'));
    } else {
      ocrShortcutInput.value = '';
    }
  });
}

// 清除 OCR 快捷键
function clearOcrShortcut() {
  chrome.storage.local.remove('translation.ocr.shortcut');
  ocrShortcutInput.value = '';

  // 通知所有标签页清除快捷键监听
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'translation.ocr.clearShortcut'
      }).catch(() => {
        // 忽略无法发送消息的标签页
      });
    });
  });

  console.log('[Translation] OCR 快捷键已清除');
}

// ==================== 收藏快捷键 ====================

// 开始录制收藏快捷键
function startFavoritesShortcutRecording() {
  if (isRecordingFavoritesShortcut) return;

  isRecordingFavoritesShortcut = true;
  favoritesShortcutInput.classList.add('recording');
  favoritesShortcutInput.value = '请按下快捷键组合...';
  favoritesShortcutInput.disabled = true;

  // 监听键盘事件
  document.addEventListener('keydown', recordFavoritesShortcut);
  document.addEventListener('keyup', finishFavoritesShortcutRecording);
}

// 录制收藏快捷键
function recordFavoritesShortcut(e) {
  e.preventDefault();
  e.stopPropagation();

  // 获取按下的修饰键
  const modifiers = [];
  if (e.ctrlKey) modifiers.push('Ctrl');
  if (e.altKey) modifiers.push('Alt');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.metaKey) modifiers.push('Meta');

  // 获取主键（排除修饰键）
  const mainKey = e.key;

  // 验证快捷键是否有效
  if (modifiers.length === 0) {
    favoritesShortcutInput.value = '请至少按下一个修饰键 (Ctrl/Alt/Shift/Meta)';
    return;
  }

  // 构建快捷键字符串
  const shortcutString = [...modifiers, mainKey].join('+');
  favoritesShortcutInput.value = shortcutString;
}

// 完成收藏快捷键录制
function finishFavoritesShortcutRecording(e) {
  e.preventDefault();
  e.stopPropagation();

  isRecordingFavoritesShortcut = false;
  favoritesShortcutInput.classList.remove('recording');
  favoritesShortcutInput.disabled = false;

  // 移除监听器
  document.removeEventListener('keydown', recordFavoritesShortcut);
  document.removeEventListener('keyup', finishFavoritesShortcutRecording);

  // 解析快捷键
  const shortcutString = favoritesShortcutInput.value;

  // 验证快捷键格式
  if (!shortcutString || shortcutString.includes('请按下')) {
    favoritesShortcutInput.value = '';
    return;
  }

  // 保存快捷键
  const shortcut = parseShortcutString(shortcutString);
  saveFavoritesShortcut(shortcut);

  // 显示友好的格式
  favoritesShortcutInput.value = formatShortcutDisplay(shortcutString);
}

// 保存收藏快捷键到存储
function saveFavoritesShortcut(shortcut) {
  chrome.storage.local.set({ 'translation.favoritesShortcut': shortcut });

  // 通知所有标签页更新快捷键监听
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'translation.updateFavoritesShortcut',
        shortcut: shortcut
      }).catch(() => {
        // 忽略无法发送消息的标签页
      });
    });
  });

  console.log('[Translation] 收藏快捷键已保存:', shortcut);
}

// 加载收藏快捷键
function loadFavoritesShortcut() {
  chrome.storage.local.get(['translation.favoritesShortcut'], (result) => {
    if (result['translation.favoritesShortcut']) {
      const shortcut = result['translation.favoritesShortcut'];
      const parts = [];
      if (shortcut.ctrlKey) parts.push('Ctrl');
      if (shortcut.altKey) parts.push('Alt');
      if (shortcut.shiftKey) parts.push('Shift');
      if (shortcut.metaKey) parts.push('Meta');
      parts.push(shortcut.key);

      favoritesShortcutInput.value = formatShortcutDisplay(parts.join('+'));
    } else {
      favoritesShortcutInput.value = '';
    }
  });
}

// 清除收藏快捷键
function clearFavoritesShortcut() {
  chrome.storage.local.remove('translation.favoritesShortcut');
  favoritesShortcutInput.value = '';

  // 通知所有标签页清除快捷键监听
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'translation.clearFavoritesShortcut'
      }).catch(() => {
        // 忽略无法发送消息的标签页
      });
    });
  });

  console.log('[Translation] 收藏快捷键已清除');
}

// 加载统计信息
function loadStatistics() {
  chrome.storage.local.get(['translation.todayCount', 'translation.totalCount'], (result) => {
    todayCountEl.textContent = result['translation.todayCount'] || 0;
    totalCountEl.textContent = result['translation.totalCount'] || 0;
  });
}

// 通知设置已更改
function notifySettingsChanged() {
  chrome.runtime.sendMessage({ action: 'translation.updateSettings' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[Translation] 通知设置更新失败:', chrome.runtime.lastError);
    }
  });
}

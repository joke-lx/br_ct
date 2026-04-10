/**
 * 快捷绑定设置页面
 * 管理 URL → 选择器 的快捷键绑定
 */

// Storage key
const STORAGE_KEY = 'binddom.config';

// DOM 元素
let binddomShortcutInput, clearBinddomShortcutBtn;
let bindingsList, emptyState, addBindingBtn;
let bindingModal, modalTitle;
let bindingUrlInput, bindingSelectorInput, bindingDescInput;
let pickElementBtn, saveBindingBtn, cancelBindingBtn, closeModalBtn;
let statusText;

// 状态
let isRecordingShortcut = false;
let isPickingElement = false;
let currentBindings = [];
let editingIndex = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  loadConfig();
  bindEvents();
});

// 获取 DOM 元素
function initElements() {
  binddomShortcutInput = document.getElementById('binddomShortcutInput');
  clearBinddomShortcutBtn = document.getElementById('clearBinddomShortcutBtn');
  bindingsList = document.getElementById('bindingsList');
  emptyState = document.getElementById('emptyState');
  addBindingBtn = document.getElementById('addBindingBtn');
  bindingModal = document.getElementById('bindingModal');
  modalTitle = document.getElementById('modalTitle');
  bindingUrlInput = document.getElementById('bindingUrlInput');
  bindingSelectorInput = document.getElementById('bindingSelectorInput');
  bindingDescInput = document.getElementById('bindingDescInput');
  pickElementBtn = document.getElementById('pickElementBtn');
  saveBindingBtn = document.getElementById('saveBindingBtn');
  cancelBindingBtn = document.getElementById('cancelBindingBtn');
  closeModalBtn = document.getElementById('closeModalBtn');
  statusText = document.getElementById('statusText');
}

// 绑定事件
function bindEvents() {
  // 返回
  document.getElementById('back-to-popup').addEventListener('click', () => {
    window.location.href = '../main/main.html';
  });

  // 快捷键设置
  binddomShortcutInput.addEventListener('click', startShortcutRecording);
  clearBinddomShortcutBtn.addEventListener('click', clearShortcut);

  // 添加绑定
  addBindingBtn.addEventListener('click', () => openModal());

  // 弹窗按钮
  closeModalBtn.addEventListener('click', closeModal);
  cancelBindingBtn.addEventListener('click', closeModal);
  saveBindingBtn.addEventListener('click', saveBinding);

  // 拾取元素
  pickElementBtn.addEventListener('click', startElementPicking);

  // 执行绑定
  document.getElementById('executeBindingBtn').addEventListener('click', executeBinding);

  // 点击空白关闭弹窗
  bindingModal.addEventListener('click', (e) => {
    if (e.target === bindingModal) closeModal();
  });

  // 监听来自 content script 的拾取结果
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'binddom.elementPicked') {
      handleElementPicked(request.selector);
    }
    if (request.action === 'binddom.triggerResult') {
      handleTriggerResult(request.success);
    }
  });
}

// ==================== 快捷键相关 ====================

function startShortcutRecording() {
  if (isRecordingShortcut) return;

  isRecordingShortcut = true;
  binddomShortcutInput.classList.add('recording');
  binddomShortcutInput.value = '请按下快捷键组合...';

  document.addEventListener('keydown', recordShortcut);
  document.addEventListener('keyup', finishShortcutRecording);
}

function recordShortcut(e) {
  e.preventDefault();
  e.stopPropagation();

  const modifiers = [];
  if (e.ctrlKey) modifiers.push('Ctrl');
  if (e.altKey) modifiers.push('Alt');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.metaKey) modifiers.push('Meta');

  const mainKey = e.key;

  if (modifiers.length === 0) {
    binddomShortcutInput.value = '请至少按下一个修饰键 (Ctrl/Alt/Shift/Meta)';
    return;
  }

  const shortcutString = [...modifiers, mainKey].join('+');
  binddomShortcutInput.value = shortcutString;
}

function finishShortcutRecording(e) {
  e.preventDefault();
  e.stopPropagation();

  isRecordingShortcut = false;
  binddomShortcutInput.classList.remove('recording');

  document.removeEventListener('keydown', recordShortcut);
  document.removeEventListener('keyup', finishShortcutRecording);

  const shortcutString = binddomShortcutInput.value;
  if (!shortcutString || shortcutString.includes('请按下')) {
    return;
  }

  // 保存快捷键
  const shortcut = parseShortcutString(shortcutString);
  saveShortcut(shortcut);

  statusText.textContent = '快捷键已设置';
  setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
}

function parseShortcutString(shortcutString) {
  const parts = shortcutString.split('+');
  return {
    ctrlKey: parts.includes('Ctrl'),
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    metaKey: parts.includes('Meta'),
    key: parts[parts.length - 1]
  };
}

function saveShortcut(shortcut) {
  chrome.storage.local.set({ 'binddom.shortcut': shortcut }, () => {
    console.log('[BindDom] 快捷键已保存:', shortcut);
    notifyAllTabs();
  });
}

function loadShortcut() {
  chrome.storage.local.get(['binddom.shortcut'], (result) => {
    if (result['binddom.shortcut']) {
      const shortcut = result['binddom.shortcut'];
      const parts = [];
      if (shortcut.ctrlKey) parts.push('Ctrl');
      if (shortcut.altKey) parts.push('Alt');
      if (shortcut.shiftKey) parts.push('Shift');
      if (shortcut.metaKey) parts.push('Meta');
      parts.push(shortcut.key);
      binddomShortcutInput.value = parts.join('+');
    }
  });
}

function clearShortcut() {
  chrome.storage.local.remove('binddom.shortcut');
  binddomShortcutInput.value = '';
  notifyAllTabs();
  statusText.textContent = '快捷键已清除';
  setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
}

// ==================== 绑定列表相关 ====================

function loadConfig() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    currentBindings = result[STORAGE_KEY] || [];
    renderBindings();
    loadShortcut();
  });
}

function saveConfig() {
  chrome.storage.local.set({ [STORAGE_KEY]: currentBindings }, () => {
    console.log('[BindDom] 配置已保存');
    notifyAllTabs();
  });
}

function renderBindings() {
  if (currentBindings.length === 0) {
    bindingsList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  bindingsList.innerHTML = currentBindings.map((binding, index) => `
    <div class="binding-item" data-index="${index}">
      <div class="binding-header">
        <div>
          <div class="binding-url">${escapeHtml(binding.url)}</div>
          ${binding.desc ? `<div class="binding-desc">${escapeHtml(binding.desc)}</div>` : ''}
        </div>
        <div class="binding-actions">
          <button class="binding-btn edit" title="编辑" data-action="edit">✏️</button>
          <button class="binding-btn delete" title="删除" data-action="delete">🗑️</button>
        </div>
      </div>
      <div class="binding-selector">${escapeHtml(binding.selector)}</div>
    </div>
  `).join('');

  // 绑定按钮事件
  bindingsList.querySelectorAll('.binding-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.binding-item');
      const index = parseInt(item.dataset.index);
      const action = e.target.closest('.binding-btn').dataset.action;

      if (action === 'edit') {
        editBinding(index);
      } else if (action === 'delete') {
        deleteBinding(index);
      }
    });
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openModal(binding = null, index = null) {
  editingIndex = index;
  modalTitle.textContent = binding ? '编辑绑定' : '添加绑定';
  bindingUrlInput.value = binding ? binding.url : '';
  bindingSelectorInput.value = binding ? binding.selector : '';
  bindingDescInput.value = binding ? binding.desc || '' : '';
  bindingModal.style.display = 'flex';
  saveBindingBtn.disabled = true;
}

function closeModal() {
  bindingModal.style.display = 'none';
  editingIndex = null;
  isPickingElement = false;
  document.body.classList.remove('pick-mode');
  pickElementBtn.textContent = '🎯 拾取元素';
}

function editBinding(index) {
  openModal(currentBindings[index], index);
}

function deleteBinding(index) {
  if (confirm('确定要删除这个绑定吗？')) {
    currentBindings.splice(index, 1);
    saveConfig();
    renderBindings();
    statusText.textContent = '绑定已删除';
    setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
  }
}

function saveBinding() {
  const url = bindingUrlInput.value.trim();
  const selector = bindingSelectorInput.value.trim();
  const desc = bindingDescInput.value.trim();

  if (!url) {
    alert('请输入目标 URL');
    return;
  }

  if (!selector) {
    alert('请选择元素');
    return;
  }

  const binding = { url, selector, desc };

  if (editingIndex !== null) {
    currentBindings[editingIndex] = binding;
    statusText.textContent = '绑定已更新';
  } else {
    currentBindings.push(binding);
    statusText.textContent = '绑定已添加';
  }

  saveConfig();
  renderBindings();
  closeModal();

  setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
}

// ==================== 元素拾取相关 ====================

function startElementPicking() {
  if (isPickingElement) {
    // 取消拾取
    isPickingElement = false;
    document.body.classList.remove('pick-mode');
    pickElementBtn.textContent = '🎯 拾取元素';
    statusText.textContent = '就绪';
    chrome.runtime.sendMessage({ action: 'binddom.cancelPick' });
    return;
  }

  isPickingElement = true;
  document.body.classList.add('pick-mode');
  pickElementBtn.textContent = '⏹ 取消拾取';
  statusText.textContent = '请在页面上点击要绑定的元素...';

  // 获取当前标签页并发送拾取指令
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'binddom.startPick' })
        .catch(err => {
          console.error('[BindDom] 无法发送拾取指令:', err);
          statusText.textContent = '无法在该页面拾取';
          isPickingElement = false;
          document.body.classList.remove('pick-mode');
          pickElementBtn.textContent = '🎯 拾取元素';
        });
    }
  });
}

function handleElementPicked(selector) {
  isPickingElement = false;
  document.body.classList.remove('pick-mode');
  pickElementBtn.textContent = '🎯 拾取元素';

  if (selector) {
    bindingSelectorInput.value = selector;
    saveBindingBtn.disabled = false;
    statusText.textContent = '元素已选择';
  } else {
    statusText.textContent = '未选择元素';
  }

  setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
}

// ==================== 通知相关 ====================

function notifyAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      // 通知更新配置
      chrome.tabs.sendMessage(tab.id, {
        action: 'binddom.configUpdated',
        config: currentBindings
      }).catch(() => {
        // 标签页可能没有注入脚本，尝试注入
        injectIntoTab(tab.id);
      });
    });
  });
}

function injectIntoTab(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['funcs/元素dom/binddom/binddom_wrapper.js']
  }).catch((err) => {
    console.log('[BindDom] 无法注入到标签页:', tabId, err.message);
  });
}

// 保存配置后，自动注入到所有标签页
function saveConfig() {
  chrome.storage.local.set({ [STORAGE_KEY]: currentBindings }, () => {
    console.log('[BindDom] 配置已保存');
    // 注入到所有标签页
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        injectIntoTab(tab.id);
      });
    });
  });
}

// 输入验证
bindingUrlInput.addEventListener('input', validateForm);
bindingSelectorInput.addEventListener('input', validateForm);

function validateForm() {
  const isValid = bindingUrlInput.value.trim() && bindingSelectorInput.value.trim();
  saveBindingBtn.disabled = !isValid;
}

// ==================== 执行绑定 ====================

function executeBinding() {
  statusText.textContent = '正在执行绑定...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      statusText.textContent = '未找到活动标签页';
      return;
    }

    const tabId = tabs[0].id;

    // 注入脚本
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['funcs/元素dom/binddom/binddom_wrapper.js']
    }, (results) => {
      if (chrome.runtime.lastError) {
        statusText.textContent = '注入失败: ' + chrome.runtime.lastError.message;
        setTimeout(() => { statusText.textContent = '就绪'; }, 3000);
        return;
      }

      // 脚本已注入，现在让它执行绑定点击
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          if (window.__binddom && window.__binddom.getInstance()) {
            const instance = window.__binddom.getInstance();
            instance.clicker.loadConfig().then(() => {
              instance.clicker.clickFirstMatch();
            });
          }
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          statusText.textContent = '执行失败';
          setTimeout(() => { statusText.textContent = '就绪'; }, 3000);
          return;
        }
        statusText.textContent = '绑定已执行';
        setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
      });
    });
  });
}

function handleTriggerResult(success) {
  if (success) {
    statusText.textContent = '✓ 绑定执行成功';
  } else {
    statusText.textContent = '✗ 未找到匹配绑定';
  }
  setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
}

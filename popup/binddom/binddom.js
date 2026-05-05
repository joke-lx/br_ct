/**
 * BindDom 设置页面 - 中控台
 */

// Storage keys
const CONFIG_KEY = 'binddom.bindings';

// DOM 元素
let bindingsList, emptyState, statusText;
let modal, urlInput, selectorInput, descInput, saveBtn;

// 状态
let currentBindings = [];
let editingIndex = null;
let isPicking = false;

// 待处理选择器状态（必须在使用前声明）
let pendingProcessed = false;
let lastPendingTimestamp = 0;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 重置状态，允许处理 pending 数据
  pendingProcessed = false;
  lastPendingTimestamp = 0;
  initElements();
  loadData();
  bindEvents();
  startPolling(); // 开始轮询检查 pending 数据
});

function initElements() {
  bindingsList = document.getElementById('bindingsList');
  emptyState = document.getElementById('emptyState');
  statusText = document.getElementById('statusText');
  modal = document.getElementById('bindingModal');
  urlInput = document.getElementById('bindingUrlInput');
  selectorInput = document.getElementById('bindingSelectorInput');
  descInput = document.getElementById('bindingDescInput');
  saveBtn = document.getElementById('saveBindingBtn');
}

function bindEvents() {
  // 返回按钮（可选）
  const backBtn = document.getElementById('back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '../main/main.html';
    });
  }

  // 手动添加
  const addBtnManual = document.getElementById('addBtnManual');
  if (addBtnManual) addBtnManual.addEventListener('click', () => openModal(false));

  // 拾取器添加 - 直接启动拾取器，popup 可以关闭
  const addBtnPicker = document.getElementById('addBtnPicker');
  if (addBtnPicker) {
    addBtnPicker.addEventListener('click', () => {
      startPick();
      window.close();
    });
  }

  // 弹窗按钮
  const closeModalBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (saveBtn) saveBtn.addEventListener('click', saveBinding);

  // 拾取元素 - 注入 picker.js
  const pickBtn = document.getElementById('pickBtn');
  if (pickBtn) pickBtn.addEventListener('click', togglePick);

  // 执行绑定 - 使用 background 处理
  const executeBtn = document.getElementById('executeBtn');
  if (executeBtn) executeBtn.addEventListener('click', executeOnCurrentPage);

  // 输入验证
  if (urlInput) urlInput.addEventListener('input', validateForm);
  if (selectorInput) selectorInput.addEventListener('input', validateForm);

  // 设置按钮
  const settingsLink = document.querySelector('.settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

function validateForm() {
  if (saveBtn && urlInput && selectorInput) {
    saveBtn.disabled = !urlInput.value.trim() || !selectorInput.value.trim();
  }
}

// ==================== 数据操作 ====================

function loadData() {
  chrome.storage.local.get(CONFIG_KEY, (r) => {
    currentBindings = r[CONFIG_KEY] || [];
    renderBindings();
  });
}

function saveData() {
  chrome.storage.local.set({ [CONFIG_KEY]: currentBindings }, () => {
    console.log('[BindDom] 配置已保存');
  });
}

function renderBindings() {
  if (currentBindings.length === 0) {
    if (bindingsList) bindingsList.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (bindingsList) {
    bindingsList.innerHTML = currentBindings.map((b, i) => `
    <div class="binding-item">
      <div class="binding-info">
        <div class="binding-url">${escapeHtml(b.url)}</div>
        ${b.desc ? `<div class="binding-desc">${escapeHtml(b.desc)}</div>` : ''}
      </div>
      <div class="binding-selector">${escapeHtml(b.selector)}</div>
      <div class="binding-actions">
        <button data-bindex="edit:${i}">✏️</button>
        <button data-bindex="delete:${i}">🗑️</button>
      </div>
    </div>
  `).join('');

    // 事件委托
    bindingsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bindex]');
      if (!btn) return;
      const [action, index] = btn.dataset.bindex.split(':');
      if (action === 'edit') editBinding(parseInt(index));
      if (action === 'delete') deleteBinding(parseInt(index));
    });
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ==================== 弹窗操作 ====================

function openModal(startPickerAfterOpen = false) {
  editingIndex = null;
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = '添加绑定';
  // 清空表单
  if (urlInput) urlInput.value = '';
  if (selectorInput) selectorInput.value = '';
  if (descInput) descInput.value = '';
  if (modal) modal.style.display = 'flex';
  if (saveBtn) saveBtn.disabled = true;

  // 如果需要，自动启动拾取器
  if (startPickerAfterOpen) {
    setTimeout(() => startPick(), 100);
  }
}

function closeModal() {
  if (modal) modal.style.display = 'none';
  editingIndex = null;
  if (isPicking) stopPick();
}

function saveBinding() {
  const url = urlInput.value.trim();
  const selector = selectorInput.value.trim();
  const desc = descInput.value.trim();

  if (!url || !selector) return;

  const binding = { url, selector, desc };

  if (editingIndex !== null) {
    currentBindings[editingIndex] = binding;
  } else {
    currentBindings.push(binding);
  }

  saveData();
  renderBindings();
  closeModal();
  if (statusText) {
    statusText.textContent = editingIndex !== null ? '✓ 已更新' : '✓ 已添加';
    setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
  }
}

function editBinding(i) {
  editingIndex = i;
  const binding = currentBindings[i];
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = '编辑绑定';
  if (urlInput) urlInput.value = binding.url;
  if (selectorInput) selectorInput.value = binding.selector;
  if (descInput) descInput.value = binding.desc || '';
  if (modal) modal.style.display = 'flex';
  if (saveBtn) saveBtn.disabled = true;
}

function deleteBinding(i) {
  if (confirm('确定删除？')) {
    currentBindings.splice(i, 1);
    saveData();
    renderBindings();
    if (statusText) {
      statusText.textContent = '✓ 已删除';
      setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
    }
  }
}

// ==================== 元素拾取（注入 picker.js） ====================

function togglePick() {
  if (isPicking) {
    stopPick();
  } else {
    startPick();
  }
}

function startPick() {
  isPicking = true;
  const pickBtn = document.getElementById('pickBtn');
  if (pickBtn) {
    pickBtn.textContent = '⏹ 取消拾取';
    pickBtn.classList.add('active');
  }
  if (statusText) statusText.textContent = '请在页面上点击元素...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      if (statusText) statusText.textContent = '未找到活动标签页';
      return;
    }

    console.log('[BindDom] 开始注入脚本到标签页:', tabs[0].id, 'URL:', tabs[0].url);

    // 检查 chrome.scripting 是否可用
    if (!chrome.scripting) {
      console.error('[BindDom] chrome.scripting 不可用');
      if (statusText) statusText.textContent = '错误: scripting API 不可用';
      return;
    }

    // 注入拾取器脚本
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['funcs/mods/binddom/div_Img_wrapper_binddom.js']
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('[BindDom] 注入失败:', chrome.runtime.lastError.message);
        if (statusText) statusText.textContent = '注入失败: ' + chrome.runtime.lastError.message;
        isPicking = false;
        const pickBtnLocal = document.getElementById('pickBtn');
        if (pickBtnLocal) {
          pickBtnLocal.textContent = '🎯 拾取元素';
          pickBtnLocal.classList.remove('active');
        }
      } else {
        console.log('[BindDom] 脚本注入成功:', results);
        if (statusText) statusText.textContent = '已启动，请在页面操作';
      }
    });
  });
}

function stopPick() {
  isPicking = false;
  const pickBtn = document.getElementById('pickBtn');
  if (pickBtn) {
    pickBtn.textContent = '🎯 拾取元素';
    pickBtn.classList.remove('active');
  }
  if (statusText) statusText.textContent = '就绪';
}

// 监听拾取结果 - 通过 storage 变化检测（暂时禁用，避免与轮询冲突）
// chrome.storage.onChanged.addListener((changes, area) => {
//   if (area !== 'local' || !changes['binddom.pending']) return;
//   const pending = changes['binddom.pending'].newValue;
//   console.log('[BindDom] Storage 变化检测到:', pending);
//   if (pending && pending.selector) {
//     handlePendingSelector(pending);
//   }
// });

// 也通过直接消息监听（暂时禁用，避免与轮询冲突）
// chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
//   if (req.action === 'binddom.elementPicked' && req.selector) {
//     handlePendingSelector({ selector: req.selector, url: req.url });
//     sendResponse({ status: 'received' });
//   }
// });

// 处理待处理的选择器
function handlePendingSelector(pending) {
  if (!pending || !pending.selector) {
    console.log('[BindDom] pending 无效:', pending);
    return;
  }

  // 如果是同一个 pending（相同时间戳），跳过
  if (pending.timestamp === lastPendingTimestamp && pendingProcessed) {
    console.log('[BindDom] 已处理过相同数据，跳过');
    return;
  }

  console.log('[BindDom] 处理选择器:', pending);

  // 确保元素已初始化（这些在 DOMContentLoaded 后才有值）
  if (!selectorInput || !saveBtn || !statusText) {
    console.error('[BindDom] 元素未初始化，等待...', { selectorInput, saveBtn, statusText });
    setTimeout(() => handlePendingSelector(pending), 100);
    return;
  }

  // 现在可以安全处理了
  pendingProcessed = true;
  lastPendingTimestamp = pending.timestamp;

  try {
    selectorInput.value = pending.selector;
    if (!urlInput.value.trim() && pending.url) {
      urlInput.value = pending.url;
    }
    // 使用 validateForm 确保按钮状态正确
    validateForm();
    statusText.textContent = '✓ 元素已选择，请确认URL后保存';
    console.log('[BindDom] UI 已更新');
    // 清除 pending
    chrome.storage.local.remove('binddom.pending');
  } catch (e) {
    console.error('[BindDom] 处理失败:', e);
    pendingProcessed = false;
    lastPendingTimestamp = 0;
  }
}

// 持续轮询检查 pending 数据（主要机制）
let pollingInterval = null;
function startPolling() {
  if (pollingInterval) return;
  console.log('[BindDom] 开始轮询 pending');
  pollingInterval = setInterval(() => {
    chrome.storage.local.get('binddom.pending', (result) => {
      const pending = result['binddom.pending'];
      if (pending && pending.selector) {
        // 通过 timestamp 判断是否是新的 pending
        if (pending.timestamp !== lastPendingTimestamp) {
          console.log('[BindDom] 检测到新数据，timestamp:', pending.timestamp, 'last:', lastPendingTimestamp);
          pendingProcessed = false; // 重置以便处理新数据
        }
        handlePendingSelector(pending);
      }
    });
  }, 500); // 每 500ms 检查一次
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// 页面隐藏时停止轮询，节省资源
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    startPolling();
  }
});

// ==================== 执行绑定 ====================

function executeOnCurrentPage() {
  if (statusText) statusText.textContent = '正在执行...';

  chrome.runtime.sendMessage({ action: 'binddom.executeClick' }, (response) => {
    if (statusText) {
      if (response && response.success) {
        statusText.textContent = '✓ 执行成功';
      } else {
        statusText.textContent = response?.message || '✗ 执行失败';
      }
      setTimeout(() => { statusText.textContent = '就绪'; }, 2000);
    }
  });
}

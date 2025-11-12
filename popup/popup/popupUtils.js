// popupUtils.js
const HISTORY_KEY = "messageHistory";
const OPTIMIZER_KEY = "selectedOptimizer";
const LAST_MESSAGE_KEY = "lastMessage";
const AUTO_SAVE_KEY = "autoSaveEnabled";
const MAX_HISTORY = 5;
const AUTO_SAVE_INTERVAL = 2000; // 2秒自动保存
const DEBOUNCE_DELAY = 500; // 防抖延迟500ms

// DOM 元素缓存
let elements = {};
let autoSaveTimer = null;
let lastSavedContent = "";
let isSaving = false;
let saveQueue = [];
let autoSaveEnabled = true;

/**
 * 复制文本到剪切板
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error("复制到剪切板失败:", fallbackErr);
      return false;
    }
  }
}

/**
 * 显示临时提示信息
 */
function showTempMessage(message, duration = 2000) {
  let messageEl = document.getElementById("temp-message");
  if (!messageEl) {
    messageEl = document.createElement("div");
    messageEl.id = "temp-message";
    messageEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-size: 14px;
      pointer-events: none;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(messageEl);
  }

  messageEl.textContent = message;
  messageEl.style.opacity = "1";
  messageEl.style.display = "block";

  setTimeout(() => {
    messageEl.style.opacity = "0";
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 300);
  }, duration);
}

/**
 * 更新保存状态提示
 */
function updateSaveStatus(status, message) {
  const statusEl = document.getElementById("save-status");
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `save-status show ${status}`;

  // 3秒后隐藏状态提示（错误状态除外）
  if (status !== 'error') {
    setTimeout(() => {
      statusEl.classList.remove('show');
    }, 3000);
  }
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 保存消息内容到存储
 */
async function saveMessageContent(content, force = false) {
  // 如果内容没有变化且不是强制保存，则跳过
  if (content === lastSavedContent && !force) {
    return true;
  }

  // 如果正在保存，将任务加入队列
  if (isSaving) {
    saveQueue.push(content);
    return false;
  }

  isSaving = true;
  updateSaveStatus('saving', '保存中...');

  try {
    await new Promise((resolve) => {
      chrome.storage.local.set({ [LAST_MESSAGE_KEY]: content }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存失败:', chrome.runtime.lastError);
          updateSaveStatus('error', '保存失败');
          resolve(false);
        } else {
          lastSavedContent = content;
          updateSaveStatus('saved', '已保存');
          resolve(true);
        }
      });
    });

    // 处理队列中的保存任务
    if (saveQueue.length > 0) {
      const nextContent = saveQueue[saveQueue.length - 1];
      saveQueue = [];
      return await saveMessageContent(nextContent, true);
    }

    return true;
  } catch (error) {
    console.error('保存消息内容失败:', error);
    updateSaveStatus('error', '保存失败');
    return false;
  } finally {
    isSaving = false;
  }
}

/**
 * 自动保存功能
 */
function setupAutoSave() {
  const debouncedSave = debounce((content) => {
    if (autoSaveEnabled && content.trim().length > 0) {
      saveMessageContent(content);
    }
  }, DEBOUNCE_DELAY);

  // 监听输入事件
  elements.messageInput.addEventListener('input', (e) => {
    debouncedSave(e.target.value);
  });

  // 监听失去焦点事件（立即保存）
  elements.messageInput.addEventListener('blur', (e) => {
    if (autoSaveEnabled) {
      saveMessageContent(e.target.value, true);
    }
  });

  // 设置定时保存（防止长时间输入不触发blur）
  autoSaveTimer = setInterval(() => {
    if (autoSaveEnabled && elements.messageInput.value.trim().length > 0) {
      saveMessageContent(elements.messageInput.value);
    }
  }, AUTO_SAVE_INTERVAL);
}

/**
 * 恢复自动保存内容
 */
function restoreAutoSaveContent() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LAST_MESSAGE_KEY, AUTO_SAVE_KEY], (result) => {
      if (result[LAST_MESSAGE_KEY]) {
        elements.messageInput.value = result[LAST_MESSAGE_KEY];
        lastSavedContent = result[LAST_MESSAGE_KEY];
      }

      if (result[AUTO_SAVE_KEY] !== undefined) {
        autoSaveEnabled = result[AUTO_SAVE_KEY];
      }

      resolve();
    });
  });
}

/**
 * 初始化弹窗，获取并缓存 DOM 元素
 */
function initializePopup() {
  elements = {
    platformCheckboxes: document.querySelectorAll(
        '.platform-icon-option input[type="checkbox"]'
    ),
    messageInput: document.getElementById("message-input"),
    sendButton: document.getElementById("send-button"),
    selectAllButton: document.getElementById("select-all"),
    historySelect: document.getElementById("history-select"),
    promptOptimizerSelect: document.getElementById("prompt-optimizer-select"),
  };

  // 自动聚焦输入框
  if (elements.messageInput) {
    setTimeout(() => {
      elements.messageInput.focus();
      const len = elements.messageInput.value.length;
      elements.messageInput.setSelectionRange(len, len);
    }, 100);
  }

  // 设置自动保存
  setupAutoSave();
}

/**
 * 加载存储的数据
 */
async function loadStoredData() {
  // 恢复自动保存的内容
  await restoreAutoSaveContent();

  // 恢复其他存储数据
  return new Promise((resolve) => {
    chrome.storage.sync.get(
        [
          "platformStates",
          HISTORY_KEY,
          OPTIMIZER_KEY,
          "lastPromptTemplate",
        ],
        (result) => {
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

          // 恢复提示词选择
          if (result.lastPromptTemplate) {
            const template = PROMPT_TEMPLATES[result.lastPromptTemplate];
            if (template) {
              const selectedValue =
                  elements.promptOptimizerSelect.querySelector(".selected-value");
              selectedValue.textContent = template.label;
              selectedValue.dataset.value = result.lastPromptTemplate;
              selectedValue.dataset.template = template.template;
            }
          }

          resolve();
        }
    );
  });
}

/**
 * 恢复平台选择状态
 */
function restorePlatformStates(platformStates) {
  elements.platformCheckboxes.forEach((cb) => {
    const iconWrapper = cb
        .closest(".platform-icon-option")
        .querySelector(".icon-wrapper");

    if (platformStates.hasOwnProperty(cb.dataset.platform)) {
      cb.checked = platformStates[cb.dataset.platform];
      if (iconWrapper) {
        iconWrapper.classList.toggle("checked", cb.checked);
      }
    }
  });
  updateSelectAllText();
}

/**
 * 设置所有事件监听器
 */
function setupEventListeners() {
  // 历史记录选择
  elements.historySelect.addEventListener("change", () => {
    if (elements.historySelect.value) {
      elements.messageInput.value = elements.historySelect.value;
      // 立即保存选中的历史消息
      saveMessageContent(elements.historySelect.value, true);
    }
  });

  // 优化器选择
  elements.promptOptimizerSelect.addEventListener("change", (e) => {
    const value = e.detail.value;
    chrome.storage.sync.set({ [OPTIMIZER_KEY]: value });
  });

  // 平台复选框变化
  elements.platformCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const iconWrapper = cb
          .closest(".platform-icon-option")
          .querySelector(".icon-wrapper");
      if (iconWrapper) {
        iconWrapper.classList.toggle("checked", cb.checked);
      }
      savePlatformStates();
      updateSelectAllText();
    });
  });

  // 全选/取消全选按钮
  elements.selectAllButton.addEventListener("click", toggleSelectAll);

  // 发送按钮
  elements.sendButton.addEventListener("click", startSending);

  // 页面可见性变化时保存（插件即将关闭）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveMessageContent(elements.messageInput.value, true);
    }
  });

  // 页面卸载前保存
  window.addEventListener('beforeunload', () => {
    saveMessageContent(elements.messageInput.value, true);
  });
}

/**
 * 更新全选按钮文本
 */
function updateSelectAllText() {
  const allChecked = Array.from(elements.platformCheckboxes).every(
      (checkbox) => checkbox.checked
  );
  elements.selectAllButton.textContent = allChecked ? "取消全选" : "全选";
}

/**
 * 切换全选/取消全选状态
 */
function toggleSelectAll() {
  const allChecked = Array.from(elements.platformCheckboxes).every(
      (checkbox) => checkbox.checked
  );

  elements.platformCheckboxes.forEach((checkbox) => {
    checkbox.checked = !allChecked;
    const iconWrapper = checkbox
        .closest(".platform-icon-option")
        .querySelector(".icon-wrapper");
    if (iconWrapper) {
      iconWrapper.classList.toggle("checked", checkbox.checked);
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
  history.forEach((msg) => {
    const opt = document.createElement("option");
    opt.value = msg;
    opt.textContent = msg.length > 40 ? msg.slice(0, 40) + "..." : msg;
    historySelect.appendChild(opt);
  });
}

/**
 * 添加消息到历史
 */
function addToHistory(message) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(HISTORY_KEY, (result) => {
      let history = result[HISTORY_KEY] || [];
      history = history.filter((item) => item !== message);
      history.unshift(message);
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      chrome.storage.sync.set({ [HISTORY_KEY]: history }, () => {
        populateHistory(elements.historySelect, history);
        resolve();
      });
    });
  });
}

/**
 * 保存平台勾选状态
 */
function savePlatformStates() {
  const checkedStates = {};
  elements.platformCheckboxes.forEach((cb) => {
    checkedStates[cb.dataset.platform] = cb.checked;
  });
  chrome.storage.sync.set({ platformStates: checkedStates });
}

/**
 * 发送消息逻辑
 */
async function startSending() {
  // 立即保存当前内容
  await saveMessageContent(elements.messageInput.value, true);

  const originalMessage = elements.messageInput.value.trim();
  if (!originalMessage) {
    console.error("请输入消息内容");
    showTempMessage("请输入消息内容");
    return;
  }

  // 从selectedValue中直接获取当前选中的模板
  const selectedValue =
      elements.promptOptimizerSelect.querySelector(".selected-value");
  const templateKey = selectedValue.dataset.value;
  const templateContent = selectedValue.dataset.template;

  let finalMessage = originalMessage;

  if (templateKey && templateContent) {
    finalMessage = templateContent.includes("%s")
        ? templateContent.replace("%s", originalMessage)
        : originalMessage + " " + templateContent;
  }

  const selectedPlatforms = Array.from(elements.platformCheckboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.dataset.platform);

  if (selectedPlatforms.length === 0) {
    console.error("请至少选择一个平台");
    showTempMessage("请至少选择一个平台");
    return;
  }

  // 检查文本长度，如果超过400则复制到剪切板
  if (finalMessage.length > 400) {
    elements.sendButton.disabled = true;
    elements.sendButton.textContent = "复制中...";

    const copySuccess = await copyToClipboard(finalMessage);

    if (copySuccess) {
      showTempMessage(`内容已复制到剪切板（${finalMessage.length}字符）`);
    } else {
      showTempMessage("复制失败，但将继续发送");
    }

    // 短暂延迟让用户看到提示
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  elements.sendButton.disabled = true;
  elements.sendButton.textContent = "发送中...";

  // 确保历史消息保存完成后再发送任务
  Promise.all([
    Promise.resolve(savePlatformStates()),
    addToHistory(originalMessage),
  ]).then(() => {
    const actionsQueue = selectedPlatforms.map((platform) => ({
      platform,
      message: finalMessage,
    }));

    chrome.runtime.sendMessage(
        { action: "processTaskQueue", queue: actionsQueue },
        () => {
          // 发送完成后清空输入框但保留自动保存记录
          elements.messageInput.value = '';
          lastSavedContent = '';
          chrome.storage.local.remove(LAST_MESSAGE_KEY);
          window.close();
        }
    );
  });
}

/**
 * 清理资源
 */
function cleanup() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

export {
  HISTORY_KEY,
  OPTIMIZER_KEY,
  initializePopup,
  setupEventListeners,
  loadStoredData,
  startSending,
  copyToClipboard,
  showTempMessage,
  cleanup
};

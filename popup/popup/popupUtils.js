import { populateOptimizer } from "../promots/promptsUI.js";

// popupUtils.js
const HISTORY_KEY = "messageHistory";
const OPTIMIZER_KEY = "selectedOptimizer";
const MAX_HISTORY = 5;

// DOM 元素缓存 , 先获得dom 然后绑定关系
let elements = {};

// 保存相关变量
let saveTimeout;
let lastSavedContent = '';
let isSaving = false;

/**
 * 复制文本到剪切板
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // 如果现代API失败，使用传统的execCommand方法作为备选
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
  // 创建提示元素
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

  // 自动隐藏
  setTimeout(() => {
    messageEl.style.opacity = "0";
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 300);
  }, duration);
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

  // 初始化优化器下拉框
  populateOptimizer(elements.promptOptimizerSelect);
}

/**
 * 保存消息内容到本地存储（优化版本）
 */
async function saveMessageContent(content) {
  // 避免重复保存相同内容
  if (content === lastSavedContent) {
    return;
  }

  // 如果正在保存，等待完成
  if (isSaving) {
    return new Promise((resolve) => {
      const checkSaving = setInterval(() => {
        if (!isSaving) {
          clearInterval(checkSaving);
          saveMessageContent(content).then(resolve);
        }
      }, 50);
    });
  }

  isSaving = true;

  try {
    await chrome.storage.sync.set({ lastMessage: content });
    lastSavedContent = content;
    console.log("消息内容已保存到本地存储，长度:", content.length);
  } catch (error) {
    console.error("保存消息内容失败:", error);
  } finally {
    isSaving = false;
  }
}

/**
 * 加载存储的数据
 */
function loadStoredData() {
  chrome.storage.sync.get(
    [
      "lastMessage",
      "platformStates",
      HISTORY_KEY,
      OPTIMIZER_KEY,
      "lastPromptTemplate",
    ],
    (result) => {
      // 恢复最后输入的消息
      if (result.lastMessage) {
        elements.messageInput.value = result.lastMessage;
        lastSavedContent = result.lastMessage;
        console.log("已恢复历史输入内容，长度:", result.lastMessage.length);
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
    }
  );
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
  // 输入框内容变化时实时保存（优化防抖机制）
  elements.messageInput.addEventListener("input", () => {
    const currentContent = elements.messageInput.value;

    // 清除之前的定时器
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // 根据文本长度动态调整保存延迟
    const delay = currentContent.length > 1000 ? 300 : 500;

    // 设置新的定时器，优化防抖延迟
    saveTimeout = setTimeout(async () => {
      await saveMessageContent(currentContent);
    }, delay);
  });

  // 监听输入框失去焦点事件，立即保存
  elements.messageInput.addEventListener("blur", async () => {
    // 立即清除定时器并保存
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    await saveMessageContent(elements.messageInput.value);
  });

  // 监听输入框获得焦点事件，确保内容同步
  elements.messageInput.addEventListener("focus", async () => {
    const result = await chrome.storage.sync.get("lastMessage");
    if (result.lastMessage && result.lastMessage !== elements.messageInput.value) {
      elements.messageInput.value = result.lastMessage;
      lastSavedContent = result.lastMessage;
    }
  });

  // 监听键盘快捷键（Ctrl+S 手动保存）
  elements.messageInput.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      await saveMessageContent(elements.messageInput.value);
      showTempMessage("内容已手动保存");
    }
  });

  // 监听页面关闭前保存
  window.addEventListener("beforeunload", async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    await saveMessageContent(elements.messageInput.value);
  });

  // 历史记录选择
  elements.historySelect.addEventListener("change", () => {
    if (elements.historySelect.value) {
      elements.messageInput.value = elements.historySelect.value;
      elements.messageInput.dispatchEvent(new Event("input"));
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
  // 确保最新的输入被保存
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await saveMessageContent(elements.messageInput.value);

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
        window.close();
      }
    );
  });
}

export {
  initializePopup,
  setupEventListeners,
  loadStoredData,
};
// import {
//   initializePopup,
//   setupEventListeners,
//   loadStoredData,
// } from "./popupUtils.js";
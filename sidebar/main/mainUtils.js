// mainUtils.js - 核心popup功能模块
import { populateOptimizer, initAliasShortcut } from "../../popup/main/prompts/promptsUI.js";
import { PROMPT_TEMPLATES } from "../../popup/main/prompts/prompts.js";
import {
  STORAGE_KEYS,
  saveMessageContent,
  savePlatformStates,
  saveOptimizerSetting,
  loadStoredData as loadData,
  addToHistory
} from "../../popup/main/modules/storage.js";
import {
  loadPlatformVisibilitySettings,
  applyPlatformVisibilitySettings,
  getVisiblePlatformCheckboxes,
  areAllVisiblePlatformsChecked,
  setupPlatformVisibilityMessageListener
} from "../../popup/main/modules/platformVisibility.js";
import {
  copyToClipboard,
  showTempMessage,
  populateHistory as populateHistoryUI,
  updateSelectAllText as updateSelectAllTextUI,
  togglePlatformCheckbox,
  setButtonLoadingState,
  resetButtonState,
  focusInputAndSetCursor,
  validateMessageInput,
  validatePlatformSelection
} from "../../popup/main/modules/uiHelpers.js";

// DOM 元素缓存
let elements = {};

// 保存相关变量
let saveTimeout;
let lastSavedContent = "";
let isSaving = false;

// 提取页面文本相关变量
let extractButton;
let extractResult;
let extractTitle;
let extractUrl;
let extractContent;
let closeResult;

/**
 * 防抖保存消息内容
 */
async function debouncedSaveMessage(content) {
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
          debouncedSaveMessage(content).then(resolve);
        }
      }, 50);
    });
  }

  isSaving = true;

  try {
    await saveMessageContent(content);
    lastSavedContent = content;
  } catch (error) {
    console.error("保存消息内容失败:", error);
  } finally {
    isSaving = false;
  }
}

/**
 * 初始化弹窗，获取并缓存 DOM 元素
 */
export async function initializePopup() {
  elements = {
    platformCheckboxes: document.querySelectorAll(
      '.platform-icon-option input[type="checkbox"]'
    ),
    messageInput: document.getElementById("message-input"),
    sendButton: document.getElementById("send-button"),
    closeTabsButton: document.getElementById("close-tabs-button"),
    selectAllButton: document.getElementById("select-all"),
    historySelect: document.getElementById("history-select"),
    promptOptimizerSelect: document.getElementById("prompt-optimizer-select"),
    openOptionsButton: document.getElementById("open-options"),
  };

  // 提取页面文本相关元素
  extractButton = document.getElementById("extract-text-button");
  extractResult = document.getElementById("extract-result");
  extractTitle = document.getElementById("extract-title");
  extractUrl = document.getElementById("extract-url");
  extractContent = document.getElementById("extract-content");
  closeResult = document.getElementById("close-result");

  // 自动聚焦输入框
  focusInputAndSetCursor(elements.messageInput);

  // 初始化 /alias 快捷输入
  initAliasShortcut(elements.messageInput, PROMPT_TEMPLATES, elements.promptOptimizerSelect);

  // 初始化优化器下拉框
  populateOptimizer(elements.promptOptimizerSelect, PROMPT_TEMPLATES);

  // 加载并应用平台可见性设置
  await loadPlatformVisibilitySettings();
}

/**
 * 加载存储的数据
 */
export async function loadStoredData() {
  try {
    const result = await loadData();

    // 恢复最后输入的消息
    if (result[STORAGE_KEYS.LAST_MESSAGE]) {
      elements.messageInput.value = result[STORAGE_KEYS.LAST_MESSAGE];
      lastSavedContent = result[STORAGE_KEYS.LAST_MESSAGE];
      console.log("已恢复历史输入内容，长度:", result[STORAGE_KEYS.LAST_MESSAGE].length);
    }

    // 恢复平台选择状态
    if (result[STORAGE_KEYS.PLATFORM_STATES]) {
      restorePlatformStates(result[STORAGE_KEYS.PLATFORM_STATES]);
    }

    // 恢复历史记录
    if (result[STORAGE_KEYS.HISTORY]) {
      populateHistoryUI(elements.historySelect, result[STORAGE_KEYS.HISTORY]);
    }

    // 恢复优化器选择
    if (result[STORAGE_KEYS.OPTIMIZER]) {
      elements.promptOptimizerSelect.value = result[STORAGE_KEYS.OPTIMIZER];
    }

    // 恢复提示词选择
    if (result[STORAGE_KEYS.LAST_PROMPT_TEMPLATE]) {
      const template = PROMPT_TEMPLATES[result[STORAGE_KEYS.LAST_PROMPT_TEMPLATE]];
      if (template) {
        const selectedValue =
          elements.promptOptimizerSelect.querySelector(".selected-value");
        selectedValue.textContent = template.label;
        selectedValue.dataset.value = result[STORAGE_KEYS.LAST_PROMPT_TEMPLATE];
        selectedValue.dataset.template = template.template;
      }
    }
  } catch (error) {
    console.error("加载存储数据失败:", error);
  }
}

/**
 * 恢复平台选择状态
 */
function restorePlatformStates(platformStates) {
  elements.platformCheckboxes.forEach((cb) => {
    if (platformStates.hasOwnProperty(cb.dataset.platform)) {
      togglePlatformCheckbox(cb, platformStates[cb.dataset.platform]);
    }
  });
  updateSelectAllButton();
}

/**
 * 设置所有事件监听器
 */
export function setupEventListeners() {
  // 监听来自options页面的平台可见性更新消息
  setupPlatformVisibilityMessageListener((settings) => {
    showTempMessage('平台显示设置已更新');
    updateSelectAllButton();
  });

  // 输入框内容变化时实时保存
  elements.messageInput.addEventListener("input", () => {
    const currentContent = elements.messageInput.value;

    // 清除之前的定时器
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // 根据文本长度动态调整保存延迟
    const delay = currentContent.length > 1000 ? 300 : 500;

    // 设置新的定时器
    saveTimeout = setTimeout(async () => {
      await debouncedSaveMessage(currentContent);
    }, delay);
  });

  // 监听输入框失去焦点事件，立即保存
  elements.messageInput.addEventListener("blur", async () => {
    // 立即清除定时器并保存
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    await debouncedSaveMessage(elements.messageInput.value);
  });

  // 监听输入框获得焦点事件，确保内容同步
  elements.messageInput.addEventListener("focus", async () => {
    try {
      const result = await loadData(STORAGE_KEYS.LAST_MESSAGE);
      if (
        result[STORAGE_KEYS.LAST_MESSAGE] &&
        result[STORAGE_KEYS.LAST_MESSAGE] !== elements.messageInput.value
      ) {
        elements.messageInput.value = result[STORAGE_KEYS.LAST_MESSAGE];
        lastSavedContent = result[STORAGE_KEYS.LAST_MESSAGE];
      }
    } catch (error) {
      console.error("同步消息内容失败:", error);
    }
  });

  // 监听键盘快捷键（Ctrl+S 手动保存）
  elements.messageInput.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      await debouncedSaveMessage(elements.messageInput.value);
      showTempMessage("内容已手动保存");
    }
  });

  // 监听页面关闭前保存
  window.addEventListener("beforeunload", async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    await debouncedSaveMessage(elements.messageInput.value);
  });

  // 历史记录选择
  elements.historySelect.addEventListener("change", () => {
    if (elements.historySelect.value) {
      elements.messageInput.value = elements.historySelect.value;
      elements.messageInput.dispatchEvent(new Event("input"));
    }
  });

  // 优化器选择
  elements.promptOptimizerSelect.addEventListener("change", async (e) => {
    const value = e.detail.value;
    try {
      await saveOptimizerSetting(value);
    } catch (error) {
      console.error("保存优化器设置失败:", error);
    }
  });

  // 平台复选框变化
  elements.platformCheckboxes.forEach((cb) => {
    cb.addEventListener("change", async () => {
      togglePlatformCheckbox(cb, cb.checked);
      try {
        await savePlatformStates(elements.platformCheckboxes);
      } catch (error) {
        console.error("保存平台状态失败:", error);
      }
      updateSelectAllButton();

      // 选择 ChatGPT 平台时，提前展示回复对话框（即使还没有收到回复）
      if (cb.dataset.platform === "chatgpt" && cb.checked) {
        showResponseContainer();
      }
    });
  });

  // 全选/取消全选按钮
  elements.selectAllButton.addEventListener("click", toggleSelectAll);

  // 发送按钮
  elements.sendButton.addEventListener("click", startSending);

  // 关闭AI标签页按钮
  elements.closeTabsButton.addEventListener("click", closeAllAITabs);

  // 提取页面文本按钮
  if (extractButton) {
    extractButton.addEventListener("click", extractPageText);
  }

  // 关闭提取结果按钮
  if (closeResult) {
    closeResult.addEventListener("click", () => {
      if (extractResult) {
        extractResult.style.display = "none";
      }
    });
  }

  // 打开设置页面按钮
  elements.openOptionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

/**
 * 更新全选按钮
 */
function updateSelectAllButton() {
  const buttonText = updateSelectAllTextUI(elements.platformCheckboxes);
  elements.selectAllButton.textContent = buttonText;
}

/**
 * 切换全选/取消全选状态
 */
async function toggleSelectAll() {
  const visibleCheckboxes = getVisiblePlatformCheckboxes(elements.platformCheckboxes);

  if (visibleCheckboxes.length === 0) {
    return;
  }

  const allChecked = areAllVisiblePlatformsChecked(visibleCheckboxes);

  // 只切换可见的复选框
  visibleCheckboxes.forEach((checkbox) => {
    togglePlatformCheckbox(checkbox, !allChecked);
  });

  updateSelectAllButton();

  try {
    await savePlatformStates(elements.platformCheckboxes);
  } catch (error) {
    console.error("保存平台状态失败:", error);
  }
}

/**
 * 关闭所有AI标签页
 */
function closeAllAITabs() {
  setButtonLoadingState(elements.closeTabsButton, "关闭中...");
  elements.closeTabsButton.style.cursor = 'not-allowed';

  chrome.runtime.sendMessage({ action: "closeAllAITabs" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("关闭AI标签页时出错:", chrome.runtime.lastError.message);
      showTempMessage("关闭标签页失败");
    } else {
      showTempMessage("正在关闭AI标签页");
    }

    // 短暂延迟后重置按钮状态
    setTimeout(() => {
      resetButtonState(elements.closeTabsButton, "关闭AI标签页");
      elements.closeTabsButton.style.cursor = 'pointer';
    }, 1500);
  });
}

/**
 * 提取页面文本
 */
async function extractPageText() {
  if (!extractButton) return;

  const originalText = extractButton.textContent;
  extractButton.textContent = "提取中...";
  extractButton.disabled = true;

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "extractPageText" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response && response.status === "success" && response.result) {
      const data = response.result;
      if (data.extracted) {
        // 显示提取结果
        if (extractResult) extractResult.style.display = "block";
        if (extractTitle) extractTitle.textContent = data.title || "未获取到标题";
        if (extractUrl) extractUrl.textContent = data.url || "";
        if (extractContent) extractContent.textContent = data.text || "未获取到内容";

        showTempMessage(`已提取 ${data.text.length} 字符`, 2000);
      } else {
        showTempMessage("提取失败，请刷新页面后重试");
      }
    } else {
      showTempMessage(response?.message || "提取失败");
    }
  } catch (error) {
    console.error("提取页面文本失败:", error);
    showTempMessage("提取失败: " + (error.message || "未知错误"));
  } finally {
    extractButton.textContent = originalText;
    extractButton.disabled = false;
  }
}

/**
 * 发送消息逻辑（优化版：支持并发并显示进度）
 */
async function startSending() {
    // 确保最新的输入被保存
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    await debouncedSaveMessage(elements.messageInput.value);

    const originalMessage = validateMessageInput(elements.messageInput.value);
    if (!originalMessage) {
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

    // 只获取可见且被勾选的平台
    const selectedPlatforms = Array.from(elements.platformCheckboxes)
        .filter((checkbox) => {
            const option = checkbox.closest('.platform-icon-option');
            return option && option.style.display !== 'none' && checkbox.checked;
        })
        .map((checkbox) => checkbox.dataset.platform);

    if (!validatePlatformSelection(selectedPlatforms)) {
        return;
    }

    // 检查文本长度，如果超过400则复制到剪切板
    if (finalMessage.length > 400) {
        setButtonLoadingState(elements.sendButton, "复制中...");

        const copySuccess = await copyToClipboard(finalMessage);

        if (copySuccess) {
            showTempMessage(`内容已复制到剪切板（${finalMessage.length}字符）`);
        } else {
            showTempMessage("复制失败，但将继续发送");
        }

        // 短暂延迟让用户看到提示
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 显示初始进度
    setButtonLoadingState(
        elements.sendButton,
        `处理中 (0/${selectedPlatforms.length})`
    );

    try {
        // 1. 并行保存数据
        await Promise.all([
            savePlatformStates(elements.platformCheckboxes),
            addToHistory(originalMessage)
        ]);

        // 2. 构造任务队列
        const actionsQueue = selectedPlatforms.map((platform) => ({
            platform,
            message: finalMessage,
        }));

        // 3. 发送任务到 background（使用 Promise 包装）
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    action: "processTaskQueue",
                    queue: actionsQueue,
                    config: {
                        maxConcurrent: 3,      // 最多同时处理3个平台
                        batchDelay: 300,       // 批次间延迟300ms
                        tabLoadTimeout: 8000,  // 页面加载超时8秒
                        scriptTimeout: 5000    // 脚本执行超时5秒
                    }
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                }
            );
        });

        // 4. 处理响应结果
        console.log("任务处理完成:", response);

        if (response && response.status === "completed") {
            // 显示处理结果
            const successMsg = `处理完成: 成功 ${response.success}/${response.total}`;
            setButtonLoadingState(elements.sendButton, successMsg);
            showTempMessage(successMsg, 2000);

            // 如果有失败的任务，显示详细信息
            if (response.failed > 0) {
                const failedPlatforms = response.results
                    .filter(r => r.status === 'rejected')
                    .map(r => {
                        const match = r.reason?.message?.match(/^(\w+):/);
                        return match ? match[1] : '未知';
                    })
                    .join(', ');

                console.warn("失败的平台:", failedPlatforms);
                setTimeout(() => {
                    showTempMessage(`失败: ${failedPlatforms}`, 3000);
                }, 2000);
            }
        } else if (response && response.status === "error") {
            throw new Error(response.error || "处理失败");
        } else {
            showTempMessage("发送完成");
        }

        // 5. Sidebar 模式下重置按钮状态（popup依赖window.close自动重置，sidebar需要手动重置）
        await new Promise((resolve) => setTimeout(resolve, 1500));
        resetButtonState(elements.sendButton, "发送消息");

    } catch (error) {
        console.error("发送消息失败:", error);
        showTempMessage("发送失败，请重试");

        // 恢复按钮状态
        resetButtonState(elements.sendButton, "发送消息");
    }
}

// ==================== ChatGPT 回复展示 ====================

// ChatGPT 回复相关变量
let responseContainer;
let responseContent;
let responseStatus;
let statusIndicator;
let statusText;
let responseToggle;
let responseCopy;
let responseClose;

// ChatGPT copy capture preview
let responseCapture;
let responseCaptureValue;

// Task 4: keep last copy capture per conversation, so copy prefers captured HTML.
const lastCopyCaptureByConversation = new Map();

const DEFAULT_CONVERSATION_ID = "__default__";
const threadStateByConversation = new Map();

let activeConversationId = DEFAULT_CONVERSATION_ID;
let isCollapsed = false;

/**
 * 获取会话键
 */
function getConversationKey(conversationId) {
  return conversationId || DEFAULT_CONVERSATION_ID;
}

/**
 * 获取或创建会话线程状态
 */
function getOrCreateConversationState(conversationId = activeConversationId) {
  const conversationKey = getConversationKey(conversationId);

  if (!threadStateByConversation.has(conversationKey)) {
    threadStateByConversation.set(conversationKey, {
      messages: [],
      messageIndex: new Map(),
    });
  }

  return threadStateByConversation.get(conversationKey);
}

/**
 * 获取当前活动会话的消息列表
 */
function getActiveThreadMessages() {
  return getOrCreateConversationState(activeConversationId).messages;
}

/**
 * 清空线程状态
 */
function clearThreadState() {
  threadStateByConversation.clear();
  activeConversationId = DEFAULT_CONVERSATION_ID;
}

/**
 * 渲染占位符
 */
function renderResponsePlaceholder() {
  if (!responseContent) return;

  responseContent.innerHTML = '<div class="response-placeholder">暂无回复内容</div>';
  responseContent.classList.remove("streaming");
}

/**
 * 确保线程根节点存在
 */
function ensureThreadRoot() {
  if (!responseContent) return null;

  let root = responseContent.querySelector("#chatgpt-thread");
  if (!root) {
    responseContent.innerHTML = "";
    root = document.createElement("div");
    root.id = "chatgpt-thread";
    root.className = "chatgpt-thread chatgpt-thread--enhanced";
    responseContent.appendChild(root);
  }

  if (root.dataset.conversationId !== activeConversationId) {
    root.dataset.conversationId = activeConversationId;
    root.innerHTML = "";
  }

  return root;
}

/**
 * 格式化时间
 */
function formatTime(ts) {
  const date = new Date(ts || Date.now());
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * 判断元素是否接近底部
 */
function isNearBottom(el, thresholdPx = 40) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

/**
 * 根据状态自动滚动
 */
function maybeAutoScroll(shouldAutoScroll) {
  if (!responseContent || !shouldAutoScroll || responseContent.classList.contains("collapsed")) {
    return;
  }

  responseContent.scrollTop = responseContent.scrollHeight;
}

/**
 * 创建线程消息卡片
 */
function createThreadMessageElement(message, index) {
  const el = document.createElement("div");
  el.className = "chatgpt-msg";
  el.dataset.messageId = message.messageId;
  el.dataset.state = message.isComplete ? "completed" : "generating";
  el.dataset.collapsed = message.collapsed ? "true" : "false";

  el.innerHTML = `
    <div class="chatgpt-msg-head">
      <span class="chatgpt-msg-title">Assistant #${index + 1}</span>
      <span class="chatgpt-msg-time">${formatTime(message.timestamp)}</span>
      <div class="chatgpt-msg-actions">
        <button type="button" class="chatgpt-msg-copy" title="复制本条">复制</button>
        <button type="button" class="chatgpt-msg-toggle" title="折叠/展开">${message.collapsed ? "▸" : "▾"}</button>
      </div>
    </div>
    <pre class="chatgpt-msg-body"></pre>
  `;

  el.querySelector(".chatgpt-msg-body").textContent = message.content || "";

  el.querySelector(".chatgpt-msg-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      showTempMessage("已复制本条");
    } catch (error) {
      console.error("复制单条回复失败:", error);
      showTempMessage("复制失败");
    }
  });

  el.querySelector(".chatgpt-msg-toggle").addEventListener("click", () => {
    message.collapsed = !message.collapsed;
    el.dataset.collapsed = message.collapsed ? "true" : "false";
    el.querySelector(".chatgpt-msg-toggle").textContent = message.collapsed ? "▸" : "▾";
  });

  return el;
}

/**
 * 渲染当前活动会话的完整线程
 */
function renderActiveConversationThread(shouldAutoScroll = false) {
  const root = ensureThreadRoot();
  if (!root) return;

  root.innerHTML = "";
  getActiveThreadMessages().forEach((message, index) => {
    root.appendChild(createThreadMessageElement(message, index));
  });

  maybeAutoScroll(shouldAutoScroll);
}

/**
 * 渲染新增消息卡片
 */
function renderThreadMessage(index, shouldAutoScroll = false) {
  const root = ensureThreadRoot();
  if (!root) return;

  const message = getActiveThreadMessages()[index];
  if (!message) return;

  root.appendChild(createThreadMessageElement(message, index));
  maybeAutoScroll(shouldAutoScroll);
}

/**
 * 更新已有消息卡片
 */
function patchThreadMessage(index, shouldAutoScroll = false) {
  const root = ensureThreadRoot();
  if (!root) return;

  const message = getActiveThreadMessages()[index];
  if (!message) return;

  const el = Array.from(root.querySelectorAll(".chatgpt-msg")).find(
    (node) => node.dataset.messageId === message.messageId
  );

  if (!el) {
    renderActiveConversationThread(shouldAutoScroll);
    return;
  }

  el.dataset.state = message.isComplete ? "completed" : "generating";
  el.dataset.collapsed = message.collapsed ? "true" : "false";

  const body = el.querySelector(".chatgpt-msg-body");
  const bodyWasNearBottom = isNearBottom(body);
  body.textContent = message.content || "";
  if (bodyWasNearBottom) {
    body.scrollTop = body.scrollHeight;
  }

  const timeEl = el.querySelector(".chatgpt-msg-time");
  if (timeEl) {
    timeEl.textContent = formatTime(message.timestamp);
  }

  const toggleButton = el.querySelector(".chatgpt-msg-toggle");
  if (toggleButton) {
    toggleButton.textContent = message.collapsed ? "▸" : "▾";
  }

  maybeAutoScroll(shouldAutoScroll);
}

/**
 * 新增或更新线程消息
 */
function upsertThreadMessage({ conversationId, messageId, content, isComplete, timestamp }) {
  if (!messageId) return;

  const conversationKey = getConversationKey(conversationId);
  const shouldAutoScroll = isNearBottom(responseContent);
  const isConversationSwitch = activeConversationId !== conversationKey;
  const normalizedContent = typeof content === "string" ? content : String(content ?? "");

  activeConversationId = conversationKey;
  const threadState = getOrCreateConversationState(conversationKey);
  const existingIndex = threadState.messageIndex.get(messageId);

  if (existingIndex == null) {
    threadState.messageIndex.set(messageId, threadState.messages.length);
    threadState.messages.push({
      messageId,
      content: normalizedContent,
      isComplete: !!isComplete,
      timestamp: timestamp || Date.now(),
      collapsed: false,
    });

    if (isConversationSwitch) {
      renderActiveConversationThread(shouldAutoScroll);
    } else {
      renderThreadMessage(threadState.messages.length - 1, shouldAutoScroll);
    }

    return;
  }

  const message = threadState.messages[existingIndex];
  message.content = normalizedContent;
  message.isComplete = !!isComplete;
  message.timestamp = timestamp || message.timestamp || Date.now();

  if (isConversationSwitch) {
    renderActiveConversationThread(shouldAutoScroll);
  } else {
    patchThreadMessage(existingIndex, shouldAutoScroll);
  }
}

/**
 * 初始化 ChatGPT 回复展示
 */
export function initializeChatGPTResponse() {
  // 获取 DOM 元素
  responseContainer = document.getElementById("chatgpt-response-container");
  responseContent = document.getElementById("response-content");
  responseStatus = document.getElementById("response-status");
  statusIndicator = responseStatus?.querySelector(".status-indicator");
  statusText = responseStatus?.querySelector(".status-text");
  responseCapture = document.getElementById("response-capture");
  responseCaptureValue = document.getElementById("response-capture-value");
  responseToggle = document.getElementById("response-toggle");
  responseCopy = document.getElementById("response-copy");
  responseClose = document.getElementById("response-close");

  if (!responseContainer || !responseContent) {
    console.warn("ChatGPT 回复展示区元素未找到");
    return;
  }

  // 设置控制按钮事件
  if (responseToggle) {
    responseToggle.addEventListener("click", toggleResponseCollapse);
  }
  if (responseCopy) {
    responseCopy.addEventListener("click", copyResponseContent);
  }
  if (responseClose) {
    responseClose.addEventListener("click", closeResponseContainer);
  }

  // 监听来自 content script 的回复 / copy capture
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "chatgptResponse") {
      console.log("[Sidebar] chatgptResponse received", request.data);
      handleChatGPTResponse(request.data);
    }

    if (request.action === "chatgptCopyCapture") {
      console.log("[Sidebar] chatgptCopyCapture received", request.data);
      renderCapturedHtmlToSidebar(request.data);
    }

    return false;
  });

  console.log("ChatGPT 回复展示模块已初始化");
}

/**
 * 处理 ChatGPT 回复
 */
function handleChatGPTResponse(data) {
  const { content, messageId, isComplete, timestamp, conversationId } = data || {};

  if (responseContainer) {
    responseContainer.style.display = "flex";
  }

  updateResponseStatus(isComplete);

  upsertThreadMessage({
    conversationId: conversationId || DEFAULT_CONVERSATION_ID,
    messageId: messageId || `unknown-${Date.now()}`,
    content,
    isComplete,
    timestamp,
  });
}

/**
 * 处理 ChatGPT copy capture
 */
function renderCapturedHtmlToSidebar(data) {
  if (!responseContent) return;

  const html = typeof data?.html === "string" ? data.html : "";
  const text = typeof data?.text === "string" ? data.text : "";
  const htmlMissing = !!data?.htmlMissing || !html;
  const source = data?.source || "unknown";
  const conversationKey = getConversationKey(data?.conversationId);
  lastCopyCaptureByConversation.set(conversationKey, data);

  responseContent.innerHTML = "";
  const root = document.createElement("div");
  root.className = "chatgpt-rendered-html";
  root.dataset.source = source;
  if (html) {
    root.innerHTML = html;
  } else if (text) {
    root.innerHTML = renderMarkdownText(text);
  } else {
    root.innerHTML = "";
  }
  responseContent.appendChild(root);

  if (responseCapture) {
    responseCapture.style.display = "flex";
    responseCapture.classList.toggle("response-capture--missing-html", htmlMissing);
  }

  if (responseCaptureValue) {
    const rawPreview = (html || text || "").replace(/\s+/g, " ").trim();
    responseCaptureValue.textContent = rawPreview ? rawPreview.slice(0, 140) : "尚未捕获";
  }
}

function renderMarkdownText(markdown) {
  const text = String(markdown || "");

  // Prefer marked (already shipped in repo) but block raw HTML for safety.
  if (window.marked?.parse) {
    const renderer = new window.marked.Renderer();
    renderer.html = () => "";

    try {
      return window.marked.parse(text, {
        gfm: true,
        breaks: true,
        renderer,
        mangle: false,
        headerIds: false
      });
    } catch (err) {
      console.warn("[Sidebar] marked.parse failed, falling back to plain text:", err);
    }
  }

  return escapeHtml(text).replace(/\n/g, "<br>");
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


/**
 * 更新回复状态
 */
function updateResponseStatus(isComplete) {
  if (!statusIndicator || !statusText) return;

  statusIndicator.classList.remove("generating", "completed", "error");

  if (isComplete) {
    statusIndicator.classList.add("completed");
    statusText.textContent = "回复完成";
  } else {
    statusIndicator.classList.add("generating");
    statusText.textContent = "正在生成...";
  }

  if (responseContent) {
    responseContent.classList.toggle("streaming", !isComplete);
  }
}

/**
 * 切换折叠/展开状态
 */
function toggleResponseCollapse() {
  if (!responseContent) return;

  isCollapsed = !isCollapsed;

  if (isCollapsed) {
    responseContent.classList.add("collapsed");
    if (responseToggle) {
      responseToggle.textContent = "+";
    }
  } else {
    responseContent.classList.remove("collapsed");
    if (responseToggle) {
      responseToggle.textContent = "−";
    }
  }
}

/**
 * 复制回复内容
 */
async function copyResponseContent() {
  const messages = getActiveThreadMessages();
  if (!messages.length) {
    showTempMessage("没有可复制的内容");
    return;
  }

  const allText = messages
    .map((message, index) => `Assistant #${index + 1}\n${message.content || ""}`)
    .join("\n\n");

  try {
    const capture = lastCopyCaptureByConversation.get(activeConversationId);
    const preferred = typeof capture?.html === "string" && capture.html.trim() ? capture.html : null;

    await navigator.clipboard.writeText(preferred || allText);
    showTempMessage("已复制到剪切板");

    if (responseCopy) {
      const originalText = responseCopy.textContent;
      responseCopy.textContent = "✓";
      setTimeout(() => {
        responseCopy.textContent = originalText;
      }, 1500);
    }
  } catch (error) {
    console.error("复制失败:", error);
    showTempMessage("复制失败");
  }
}

/**
 * 关闭回复容器
 */
function closeResponseContainer() {
  if (responseContainer) {
    responseContainer.style.display = "none";
  }

  clearThreadState();
  renderResponsePlaceholder();
}

/**
 * 显示回复容器（供外部调用）
 */
export function showResponseContainer() {
  if (responseContainer) {
    responseContainer.style.display = "flex";
  }
}

/**
 * 隐藏回复容器（供外部调用）
 */
export function hideResponseContainer() {
  if (responseContainer) {
    responseContainer.style.display = "none";
  }
}

/**
 * 重置回复展示状态
 */
export function resetResponseDisplay() {
  closeResponseContainer();
  if (statusIndicator) {
    statusIndicator.classList.remove("generating", "completed", "error");
  }
  if (statusText) {
    statusText.textContent = "等待回复...";
  }
}
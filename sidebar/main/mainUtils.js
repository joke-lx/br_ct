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

import { renderMarkdownSafe } from "./markdownRender.js";
import { PLATFORM_CONFIG } from "../../config/platformConfig.js";

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
let currentView = "compose";
let hasUnreadReplies = false;

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
    composePage: document.getElementById("page-compose"),
    replyPage: document.getElementById("page-reply"),
    composeTab: document.getElementById("tab-compose"),
    replyTab: document.getElementById("tab-reply"),
    replyBadge: document.getElementById("reply-badge"),
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
  switchMainView("compose");
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

function switchMainView(view) {
  currentView = view === "reply" ? "reply" : "compose";

  elements.composePage?.classList.toggle("active", currentView === "compose");
  elements.replyPage?.classList.toggle("active", currentView === "reply");
  elements.composeTab?.classList.toggle("active", currentView === "compose");
  elements.replyTab?.classList.toggle("active", currentView === "reply");

  if (currentView === "reply") {
    setReplyAttention(false);
    renderCurrentPlatform();
  } else {
    focusInputAndSetCursor(elements.messageInput);
  }
}

function setReplyAttention(hasAttention) {
  hasUnreadReplies = !!hasAttention;

  if (elements.replyBadge) {
    elements.replyBadge.hidden = !hasUnreadReplies;
  }

  elements.replyTab?.classList.toggle(
    "has-attention",
    hasUnreadReplies && currentView !== "reply"
  );
}

function notifyReplyArrival() {
  if (currentView === "reply") {
    setReplyAttention(false);
    return;
  }

  setReplyAttention(true);
}

/**
 * 设置所有事件监听器
 */
export function setupEventListeners() {
  elements.composeTab?.addEventListener("click", () => switchMainView("compose"));
  elements.replyTab?.addEventListener("click", () => switchMainView("reply"));
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

      // 勾选平台时自动切换到该平台
      if (cb.checked) {
        const platforms = getCheckedPlatforms();
        activePlatformId = platforms[0];
        renderCurrentPlatform();
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
  elements.openOptionsButton?.addEventListener("click", () => {
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
                    source: "sidebar",
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

// ==================== 多平台回复展示 ====================

// DOM 元素
let responseContainer;
let responseContent;
let responseStatus;
let statusIndicator;
let statusText;
let responseToggle;
let responseCopy;
let responseClose;
let navPrev;
let navNext;
let responseTitle;

// copy capture preview
let responseCapture;
let responseCaptureValue;

const DEFAULT_CONVERSATION_ID = "__default__";

// 每个平台的 copy capture
const lastCopyCaptureByConversation = new Map();

// 平台回复数据: platform -> { conversationStates: Map<convId, { messages, messageIndex }>, activeConvId }
const platformStates = new Map();
let activePlatformId = null;
let isCollapsed = false;

function getPlatformState(platformId) {
  if (!platformStates.has(platformId)) {
    platformStates.set(platformId, {
      conversationStates: new Map(),
      activeConvId: DEFAULT_CONVERSATION_ID,
    });
  }
  return platformStates.get(platformId);
}

function getConvState(platformId, conversationId) {
  const ps = getPlatformState(platformId);
  const key = conversationId || DEFAULT_CONVERSATION_ID;
  if (!ps.conversationStates.has(key)) {
    ps.conversationStates.set(key, { messages: [], messageIndex: new Map() });
  }
  return ps.conversationStates.get(key);
}

/**
 * 获取已勾选的平台列表（按 DOM 顺序）
 */
function getCheckedPlatforms() {
  return Array.from(document.querySelectorAll('.platform-icon-option input[type="checkbox"]:checked'))
    .map(cb => cb.dataset.platform);
}

/**
 * 切换到指定方向的下一个/上一个平台
 */
function switchPlatform(direction) {
  const platforms = getCheckedPlatforms();
  if (!platforms.length) return;

  if (!activePlatformId || !platforms.includes(activePlatformId)) {
    activePlatformId = platforms[0];
  } else {
    const idx = platforms.indexOf(activePlatformId);
    const nextIdx = (idx + direction + platforms.length) % platforms.length;
    activePlatformId = platforms[nextIdx];
  }

  renderCurrentPlatform();
}

/**
 * 渲染当前平台
 */
function renderCurrentPlatform() {
  if (!responseContainer) {
    return;
  }

  if (!activePlatformId) {
    if (responseTitle) {
      responseTitle.textContent = "回复";
      responseTitle.style.color = "";
    }
    if (responseContent) {
      responseContent.innerHTML = '<div class="response-placeholder">暂无回复内容</div>';
      responseContent.classList.remove("streaming");
    }
    if (responseStatus) {
      responseStatus.style.display = "flex";
      updateResponseStatus(true);
    }
    if (responseCapture) {
      responseCapture.style.display = "none";
    }
    return;
  }

  const config = PLATFORM_CONFIG[activePlatformId];
  const platformName = config?.name || activePlatformId;
  const platformColor = config?.color || "#666";
  const platformIcon = config?.icon || activePlatformId[0]?.toUpperCase() || "?";

  if (responseTitle) {
    responseTitle.textContent = `${platformIcon} ${platformName}`;
    responseTitle.style.color = platformColor;
  }

  const ps = getPlatformState(activePlatformId);
  const convState = ps.conversationStates.get(ps.activeConvId);
  const captureKey = `${activePlatformId}::${ps.activeConvId}`;
  const captureData = lastCopyCaptureByConversation.get(captureKey);

  // 优先渲染捕获数据（含完整 HTML，渲染效果更好）
  if (captureData && (captureData.html || captureData.text)) {
    renderPlatformCapture(captureData);
    if (responseStatus) responseStatus.style.display = "none";
    return;
  }

  const hasMessages = convState && convState.messages.length > 0;

  if (hasMessages) {
    renderPlatformMessages(convState);
    if (responseStatus) responseStatus.style.display = "flex";
    if (responseCapture) responseCapture.style.display = "none";
    return;
  }

  // 无数据
  if (responseContent) {
    responseContent.innerHTML = '<div class="response-placeholder">暂无回复内容</div>';
    responseContent.classList.remove("streaming");
  }
  if (responseStatus) {
    responseStatus.style.display = "flex";
    updateResponseStatus(true);
  }
  if (responseCapture) responseCapture.style.display = "none";
}

/**
 * 渲染平台消息线程 - Notion 风格气泡
 */
function renderPlatformMessages(convState) {
  if (!responseContent) return;

  responseContent.innerHTML = "";

  const root = document.createElement("div");
  root.className = "notion-chat";

  convState.messages.forEach((message, index) => {
    const config = PLATFORM_CONFIG[activePlatformId];
    const platformName = config?.name || activePlatformId;
    const platformColor = config?.color || "#666";
    const platformIcon = config?.shortIcon || config?.icon || activePlatformId[0]?.toUpperCase() || "?";

    const msgRow = document.createElement("div");
    msgRow.className = "notion-chat-message notion-chat-message--ai";

    const avatar = document.createElement("div");
    avatar.className = "notion-chat-avatar";
    avatar.style.background = platformColor;
    avatar.textContent = platformIcon;

    const bubble = document.createElement("div");
    bubble.className = "notion-chat-bubble";

    const header = document.createElement("div");
    header.className = "notion-chat-bubble-header";

    const nameEl = document.createElement("span");
    nameEl.className = "notion-chat-bubble-name";
    nameEl.style.color = platformColor;
    nameEl.textContent = platformName;

    const timeEl = document.createElement("span");
    timeEl.className = "notion-chat-bubble-time";
    timeEl.textContent = formatTime(message.timestamp);

    const actions = document.createElement("div");
    actions.className = "notion-chat-bubble-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "notion-chat-btn";
    copyBtn.title = "复制本条";
    copyBtn.textContent = "复制";
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(message.content || "");
        const orig = copyBtn.textContent;
        copyBtn.textContent = "✓";
        setTimeout(() => { copyBtn.textContent = orig; }, 1200);
      } catch (error) {
        console.error("复制失败:", error);
      }
    });

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "notion-chat-btn";
    toggleBtn.title = message.collapsed ? "展开" : "折叠";
    toggleBtn.textContent = message.collapsed ? "▸" : "▾";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      message.collapsed = !message.collapsed;
      contentEl.style.display = message.collapsed ? "none" : "block";
      toggleBtn.textContent = message.collapsed ? "▸" : "▾";
      toggleBtn.title = message.collapsed ? "展开" : "折叠";
    });

    actions.appendChild(copyBtn);
    actions.appendChild(toggleBtn);

    header.appendChild(nameEl);
    header.appendChild(timeEl);
    header.appendChild(actions);

    const contentEl = document.createElement("div");
    contentEl.className = "notion-chat-bubble-content";
    contentEl.style.display = message.collapsed ? "none" : "block";
    contentEl.innerHTML = renderMarkdownSafe(message.content || "");

    bubble.appendChild(header);
    bubble.appendChild(contentEl);

    msgRow.appendChild(avatar);
    msgRow.appendChild(bubble);
    root.appendChild(msgRow);
  });

  responseContent.appendChild(root);
}

/**
 * 渲染平台 copy capture
 */
/**
 * 检查 html 是否为"裸容器"——剔除标签后内容和 text 基本一致。
 * 这种 HTML 来自 copy.event 的 Selection fallback，不适合直接 innerHTML，
 * 应改用 markdown 渲染。
 * 如果剥离标签后和 text 有明显差异（含语义标签如 table/ol/ul/img 等），
 * 则为真正的富 HTML，可直接使用。
 */
function isBareHtmlContainer(html, text) {
  if (!html) return true;
  var stripped = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  var normalizedText = (text || '').replace(/\s+/g, ' ').trim();
  // 最强信号：剥掉标签后和 text 一样 → 裸容器
  if (stripped === normalizedText) return true;
  // 有差异，且含语义标签 → 真正的富 HTML
  if (/<(table|ol|ul|img|h[1-6]|blockquote|iframe)\b/i.test(html)) return false;
  // 有差异但无语义标签 → 仍是裸容器（如加了无关属性/包装）
  return true;
}

function renderPlatformCapture(data) {
  if (!responseContent) return;

  const html = typeof data?.html === "string" ? data.html : "";
  const text = typeof data?.text === "string" ? data.text : "";
  const htmlMissing = !!data?.htmlMissing || !html;
  const source = data?.source || "unknown";

  responseContent.innerHTML = "";

  const config = PLATFORM_CONFIG[activePlatformId];
  const platformName = config?.name || activePlatformId;
  const platformColor = config?.color || "#666";
  const platformIcon = config?.shortIcon || config?.icon || activePlatformId?.[0]?.toUpperCase() || "?";

  const root = document.createElement("div");
  root.className = "notion-chat";

  const msgRow = document.createElement("div");
  msgRow.className = "notion-chat-message notion-chat-message--ai";

  const avatar = document.createElement("div");
  avatar.className = "notion-chat-avatar";
  avatar.style.background = platformColor;
  avatar.textContent = platformIcon;

  const bubble = document.createElement("div");
  bubble.className = "notion-chat-bubble";

  const header = document.createElement("div");
  header.className = "notion-chat-bubble-header";

  const nameEl = document.createElement("span");
  nameEl.className = "notion-chat-bubble-name";
  nameEl.style.color = platformColor;
  nameEl.textContent = platformName;

  header.appendChild(nameEl);
  bubble.appendChild(header);

  const contentEl = document.createElement("div");
  contentEl.className = "notion-chat-bubble-content";

  if (html && !isBareHtmlContainer(html, text)) {
    contentEl.innerHTML = html;
  } else if (text) {
    contentEl.innerHTML = renderMarkdownText(text);
  }

  bubble.appendChild(contentEl);
  msgRow.appendChild(avatar);
  msgRow.appendChild(bubble);
  root.appendChild(msgRow);
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
 * 切换折叠/展开
 */
function toggleResponseCollapse() {
  if (!responseContent) return;

  isCollapsed = !isCollapsed;

  if (isCollapsed) {
    responseContent.classList.add("collapsed");
    if (responseToggle) responseToggle.textContent = "+";
  } else {
    responseContent.classList.remove("collapsed");
    if (responseToggle) responseToggle.textContent = "−";
  }
}

/**
 * 复制当前平台所有回复
 */
async function copyResponseContent() {
  const ps = getPlatformState(activePlatformId || "");
  const convState = ps.conversationStates.get(ps.activeConvId);
  const messages = convState?.messages || [];

  if (!messages.length) {
    showTempMessage("没有可复制的内容");
    return;
  }

  const allText = messages
    .map((msg, i) => `Assistant #${i + 1}\n${msg.content || ""}`)
    .join("\n\n");

  try {
    const captureKey = `${activePlatformId}::${ps.activeConvId}`;
    const capture = lastCopyCaptureByConversation.get(captureKey);
    const preferredText = typeof capture?.text === "string" && capture.text.trim() ? capture.text : null;

    await navigator.clipboard.writeText(preferredText || allText);
    showTempMessage("已复制到剪切板");

    if (responseCopy) {
      const orig = responseCopy.textContent;
      responseCopy.textContent = "✓";
      setTimeout(() => { responseCopy.textContent = orig; }, 1500);
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
  platformStates.clear();
  lastCopyCaptureByConversation.clear();
  activePlatformId = null;
  setReplyAttention(false);
  if (responseCapture) responseCapture.style.display = "none";
  if (responseStatus) responseStatus.style.display = "flex";
  if (responseTitle) {
    responseTitle.textContent = "回复";
    responseTitle.style.color = "";
  }
  if (responseContent) {
    responseContent.innerHTML = '<div class="response-placeholder">暂无回复内容</div>';
    responseContent.classList.remove("streaming");
  }
}

/**
 * 显示回复容器
 */
export function showResponseContainer() {
  switchMainView("reply");
}

/**
 * 隐藏回复容器
 */
export function hideResponseContainer() {
  switchMainView("compose");
}

/**
 * 重置回复展示
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

/**
 * 处理平台回复（流式）
 */
function handlePlatformResponse(platformId, data) {
  const { content, messageId, isComplete, timestamp, conversationId } = data || {};
  if (!messageId) return;

  const ps = getPlatformState(platformId);
  const key = conversationId || DEFAULT_CONVERSATION_ID;

  // 自动切换到收到回复的平台
  if (!activePlatformId || activePlatformId === platformId) {
    activePlatformId = platformId;
  }

  // 直接使用 upsert 逻辑（保持与原来相同的流式更新行为）
  ps.activeConvId = key;
  const convState = getConvState(platformId, key);
  const existingIndex = convState.messageIndex.get(messageId);
  const shouldAutoScroll = responseContent ? isNearBottom(responseContent) : true;

  const normalizedContent = typeof content === "string" ? content : String(content ?? "");

  if (existingIndex == null) {
    // 新消息开始，清除旧捕获数据和历史消息
    const captureKey = `${platformId}::${key}`;
    lastCopyCaptureByConversation.delete(captureKey);

    convState.messages.length = 0;
    convState.messageIndex.clear();
    convState.messageIndex.set(messageId, 0);
    convState.messages.push({
      messageId,
      content: normalizedContent,
      isComplete: !!isComplete,
      timestamp: timestamp || Date.now(),
      collapsed: false,
    });
  } else {
    const msg = convState.messages[existingIndex];
    msg.content = normalizedContent;
    msg.isComplete = !!isComplete;
    msg.timestamp = timestamp || msg.timestamp || Date.now();
  }

  // 如果是当前活动平台，更新界面
  if (activePlatformId === platformId) {
    updateResponseStatus(isComplete);
    renderCurrentPlatform();
  }

  notifyReplyArrival();
}

/**
 * 处理平台 copy capture
 */
function handlePlatformCapture(platformId, data) {
  if (!data) return;

  const ps = getPlatformState(platformId);
  const key = data.conversationId || DEFAULT_CONVERSATION_ID;
  ps.activeConvId = key;
  const captureKey = `${platformId}::${key}`;
  lastCopyCaptureByConversation.set(captureKey, data);

  // 自动切换到收到捕获的平台
  activePlatformId = platformId;

  renderCurrentPlatform();
  notifyReplyArrival();
}

/**
 * 初始化多平台回复展示
 */
export function initializeResponseDisplay() {
  responseContainer = document.getElementById("response-container");
  responseContent = document.getElementById("response-content");
  responseStatus = document.getElementById("response-status");
  statusIndicator = responseStatus?.querySelector(".status-indicator");
  statusText = responseStatus?.querySelector(".status-text");
  responseCapture = document.getElementById("response-capture");
  responseCaptureValue = document.getElementById("response-capture-value");
  responseToggle = document.getElementById("response-toggle");
  responseCopy = document.getElementById("response-copy");
  responseClose = document.getElementById("response-close");
  navPrev = document.getElementById("nav-prev");
  navNext = document.getElementById("nav-next");
  responseTitle = document.getElementById("response-title");

  if (!responseContainer || !responseContent) {
    console.warn("回复展示区元素未找到");
    return;
  }

  // 控制按钮
  if (responseToggle) responseToggle.addEventListener("click", toggleResponseCollapse);
  if (responseCopy) responseCopy.addEventListener("click", copyResponseContent);
  if (responseClose) responseClose.addEventListener("click", closeResponseContainer);

  // 导航按钮
  if (navPrev) navPrev.addEventListener("click", () => switchPlatform(-1));
  if (navNext) navNext.addEventListener("click", () => switchPlatform(1));

  // 监听回复和 copy capture
  chrome.runtime.onMessage.addListener((request) => {
    // 通用流式回复: ${platform}Response
    const responseMatch = request.action?.match(/^(\w+)Response$/);
    if (responseMatch) {
      const platformId = responseMatch[1];
      console.log(`[Sidebar] ${platformId}Response received`, request.data);
      handlePlatformResponse(platformId, request.data);
    }

    // 通用 copy capture: ${platform}CopyCapture
    const captureMatch = request.action?.match(/^(\w+)CopyCapture$/);
    if (captureMatch) {
      const platformId = captureMatch[1];
      console.log(`[Sidebar] ${platformId}CopyCapture received`, request.data);
      handlePlatformCapture(platformId, request.data);
    }

    return false;
  });

  // 平台复选框变化时更新导航
  const checkboxes = document.querySelectorAll('.platform-icon-option input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      const platforms = getCheckedPlatforms();
      if (!platforms.length) {
        activePlatformId = null;
        renderCurrentPlatform();
      } else if (!activePlatformId || !platforms.includes(activePlatformId)) {
        activePlatformId = platforms[0];
        renderCurrentPlatform();
      }
    });
  });

  renderCurrentPlatform();
  console.log("多平台回复展示模块已初始化");
}

/**
 * 初始化 ChatGPT 回复展示（兼容旧入口，内部调用新版）
 */
export function initializeChatGPTResponse() {
  initializeResponseDisplay();
}

/**
 * 复制全部（向后兼容）
 */
function renderCapturedHtmlToSidebar(data) {
  handlePlatformCapture("chatgpt", data);
}

function renderMarkdownText(markdown) {
  const text = String(markdown || "");

  // 将 tab 分隔的表格数据转换为 pipe 分隔的 markdown 表格
  const md = convertTableTabsToPipes(text);

  if (window.marked?.parse) {
    const renderer = new window.marked.Renderer();
    renderer.html = () => "";

    try {
      return window.marked.parse(md, {
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

  return escapeHtml(md).replace(/\n/g, "<br>");
}

/**
 * 检测文本是否包含 tab 分隔的表格数据，如果是则转换为 pipe 分隔的 markdown 表格。
 * 浏览器对 HTML 表格执行 sel.toString() 时，列之间用 tab 分隔，行之间用换行分隔。
 * marked 不识别 tab 分隔的表格，需要转为管道格式。
 */
function convertTableTabsToPipes(text) {
  if (!text || text.indexOf("\t") === -1) return text;

  var lines = text.split("\n").filter(function(l) { return l.trim(); });
  if (lines.length < 2) return text;

  // 检查每行是否有相同数量的 tab 分隔列
  var tabCounts = lines.map(function(l) {
    return l.split("\t").length;
  });
  var firstCount = tabCounts[0];
  if (firstCount < 2) return text;
  var consistent = tabCounts.every(function(c) { return c === firstCount; });
  if (!consistent) return text;

  // 转换为 pipe 表格：每行用 | 包裹
  var pipeLines = lines.map(function(l) {
    return "| " + l.split("\t").map(function(c) { return c.trim(); }).join(" | ") + " |";
  });

  // 插入分隔行（在表头后）
  var separator = "| " + Array(firstCount).fill("---").join(" | ") + " |";
  pipeLines.splice(1, 0, separator);

  return pipeLines.join("\n");
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(ts) {
  const date = new Date(ts || Date.now());
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isNearBottom(el, thresholdPx = 40) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

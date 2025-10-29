import { populateOptimizer } from "../promots/promptsUI.js";
const OPTIMIZER_KEY = "selectedOptimizer";
const MAX_HISTORY = 5;
let elements = {};
let dynamicInputs = []; // 存储动态输入框
let historyPanel = null; // 历史记录面板

/** 初始化弹窗 */
function initializePopup() {
  elements = {
    
    platformCheckboxes: document.querySelectorAll(
      '.platform-icon-option input[type="checkbox"]'
    ),
    sendButton: document.getElementById("send-button"),
    selectAllButton: document.getElementById("select-all"),
    promptOptimizerSelect: document.getElementById("prompt-optimizer-select"),
    dynamicInputsContainer: document.getElementById("dynamic-inputs"),
    historyPanel: document.getElementById("history-panel"),
    historyList: document.getElementById("history-list"),
    closeHistoryBtn: document.getElementById("close-history-btn"),
    toggleHistoryBtn: document.getElementById("toggle-history-btn"),
    historyOverlay: document.getElementById("history-overlay"),
  };

  populateOptimizer(elements.promptOptimizerSelect);
  setupOptimizerInputSync();
  loadStoredData();

  // 初始化历史面板
  elements.historyPanel.style.display = "none";
  elements.historyOverlay.style.display = "none";
}

/** 监听优化器选择变化，生成对应输入框 */
function setupOptimizerInputSync() {
  const selectedValue =
    elements.promptOptimizerSelect.querySelector(".selected-value");
  elements.promptOptimizerSelect.addEventListener("change", (e) => {
    const key = e.detail.value;
    const template = PROMPT_TEMPLATES[key];
    selectedValue.dataset.value = key;
    selectedValue.dataset.template = template?.template || "";
    renderDynamicInputs(template?.template || "");
    chrome.storage.sync.set({ [OPTIMIZER_KEY]: key });
  });
}

/** 渲染动态输入框 */
function renderDynamicInputs(template) {
  const matches = Array.from(template.matchAll(/%s\d*/g));
  const placeholders = matches.map((m) => m[0]);
  elements.dynamicInputsContainer.innerHTML = "";
  dynamicInputs = [];

  if (placeholders.length === 0) {
    const textarea = createInputBox("主输入（对应 %s）");
    elements.dynamicInputsContainer.appendChild(textarea);
    dynamicInputs.push(textarea);
  } else {
    placeholders.forEach((ph, i) => {
      const textarea = createInputBox(`输入${i + 1}（对应 ${ph}）`);
      elements.dynamicInputsContainer.appendChild(textarea);
      dynamicInputs.push(textarea);
    });
  }
}

function createInputBox(placeholder) {
  const textarea = document.createElement("textarea");
  textarea.className = "message-input popup-input";
  textarea.placeholder = placeholder;
  textarea.rows = 1; // 初始最小行

  // 确保初始样式匹配 CSS 中的 max-height 设置
  textarea.style.overflowY = "hidden";
  textarea.style.maxHeight = "200px"; // 与 CSS 保持一致的默认最大高度，若 CSS 修改请同步调整

  // 自动高度调整：当内容高度超过 maxHeight 时，切换为显示滚动条
  const adjustHeight = () => {
    textarea.style.height = "auto"; // 先重置以获取 scrollHeight
    const newHeight = textarea.scrollHeight;
    const maxH = parseInt(getComputedStyle(textarea).maxHeight) || 200;

    if (newHeight >= maxH) {
      textarea.style.height = maxH + "px";
      textarea.style.overflowY = "auto"; // 达到最大高度，允许滚动
    } else {
      textarea.style.height = newHeight + "px";
      textarea.style.overflowY = "hidden"; // 未达到最大高度，隐藏滚动条
    }
  };

  textarea.addEventListener("input", adjustHeight);
  // 页面加载后自动调整一次（如果有默认内容）
  setTimeout(adjustHeight, 0);

  return textarea;
}

/** 加载存储数据（优化器选择 + 平台状态 + 历史消息） */
function loadStoredData() {
  chrome.storage.sync.get(
    [OPTIMIZER_KEY, "platformStates", "blockHistory"],
    (result) => {
      loadOptimizer(result[OPTIMIZER_KEY]);
      restorePlatformStates(result.platformStates);
      populateBlockHistory(result.blockHistory || {});
    }
  );
}

/** 加载优化器 */
function loadOptimizer(key) {
  if (!key) return;
  const selectedValue =
    elements.promptOptimizerSelect.querySelector(".selected-value");
  const template = PROMPT_TEMPLATES[key];
  if (template) {
    selectedValue.dataset.value = key;
    selectedValue.dataset.template = template.template;
    renderDynamicInputs(template.template);
  }
}

/** 恢复平台状态 */
function restorePlatformStates(platformStates = {}) {
  elements.platformCheckboxes.forEach((cb) => {
    const iconWrapper = cb
      .closest(".platform-icon-option")
      ?.querySelector(".icon-wrapper");
    if (platformStates.hasOwnProperty(cb.dataset.platform)) {
      cb.checked = platformStates[cb.dataset.platform];
      if (iconWrapper) iconWrapper.classList.toggle("checked", cb.checked);
    }
  });
  updateSelectAllText();
}

/** 更新全选按钮文本 */
function updateSelectAllText() {
  const allChecked = Array.from(elements.platformCheckboxes).every(
    (cb) => cb.checked
  );
  elements.selectAllButton.textContent = allChecked ? "取消全选" : "全选";
}

/** 全选/取消全选 */
function toggleSelectAll() {
  const allChecked = Array.from(elements.platformCheckboxes).every(
    (cb) => cb.checked
  );
  elements.platformCheckboxes.forEach((cb) => {
    cb.checked = !allChecked;
    const iconWrapper = cb
      .closest(".platform-icon-option")
      ?.querySelector(".icon-wrapper");
    if (iconWrapper) iconWrapper.classList.toggle("checked", cb.checked);
  });
  updateSelectAllText();
  savePlatformStates();
}

/** 保存平台勾选状态 */
function savePlatformStates() {
  const states = {};
  elements.platformCheckboxes.forEach(
    (cb) => (states[cb.dataset.platform] = cb.checked)
  );
  chrome.storage.sync.set({ platformStates: states });
}

/** 渲染每个输入块的历史记录 */
function populateBlockHistory(blockHistory) {
  elements.historyList.innerHTML = "";

  // 将历史记录按时间排序（最新在前）
  const allHistory = [];
  Object.entries(blockHistory).forEach(([blockIndex, entries]) => {
    entries.forEach((content, index) => {
      allHistory.push({
        blockIndex,
        content,
        timestamp: new Date().getTime() - index, // 模拟时间戳，最新记录在前
      });
    });
  });

  // 按时间倒序排序
  allHistory.sort((a, b) => b.timestamp - a.timestamp);

  // 只显示最新的MAX_HISTORY条记录
  const recentHistory = allHistory.slice(0, MAX_HISTORY);

  recentHistory.forEach((historyItem) => {
    const historyItemEl = document.createElement("div");
    historyItemEl.className = "history-item";

    // 创建历史记录内容
    const content = document.createElement("div");
    content.className = "history-content";
    content.textContent = `[块${parseInt(historyItem.blockIndex) + 1}] ${
      historyItem.content.length > 40
        ? historyItem.content.slice(0, 40) + "..."
        : historyItem.content
    }`;
    content.title = historyItem.content; // 鼠标悬停显示完整内容

    // 创建复制按钮
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "复制";
    copyBtn.onclick = () => {
      navigator.clipboard
        .writeText(historyItem.content)
        .then(() => {
          copyBtn.textContent = "已复制!";
          setTimeout(() => {
            copyBtn.textContent = "复制";
            // 复制后自动关闭历史框
            toggleHistoryPanel();
          }, 800);
        })
        .catch((err) => {
          console.error("复制失败:", err);
          copyBtn.textContent = "失败";
          setTimeout(() => {
            copyBtn.textContent = "复制";
          }, 1500);
        });
    };

    historyItemEl.appendChild(content);
    historyItemEl.appendChild(copyBtn);
    elements.historyList.appendChild(historyItemEl);
  });
}

/** 添加历史记录 - 只保存内容 */
function addToBlockHistory() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("blockHistory", (result) => {
      const blockHistory = result.blockHistory || {};

      // 只保存每个输入块的纯文本内容
      dynamicInputs.forEach((input, index) => {
        const content = input.value.trim();
        if (content) {
          const blockKey = `block${index}`;
          if (!blockHistory[blockKey]) {
            blockHistory[blockKey] = [];
          }

          // 移除重复内容
          blockHistory[blockKey] = blockHistory[blockKey].filter(
            (item) => item !== content
          );

          // 添加新内容到开头
          blockHistory[blockKey].unshift(content);

          // 限制历史记录数量
          if (blockHistory[blockKey].length > MAX_HISTORY) {
            blockHistory[blockKey] = blockHistory[blockKey].slice(
              0,
              MAX_HISTORY
            );
          }
        }
      });

      chrome.storage.sync.set({ blockHistory }, () => {
        populateBlockHistory(blockHistory);
        resolve();
      });
    });
  });
}

function startSending() {
  const selectedValue =
    elements.promptOptimizerSelect.querySelector(".selected-value");
  const templateContent = selectedValue.dataset.template || "%s";
  let message = templateContent;

  // 依次替换模板中所有占位符
  const placeholders = Array.from(message.matchAll(/%s\d*/g)).map((m) => m[0]);
  placeholders.forEach((ph, i) => {
    const inputValue = dynamicInputs[i]?.value.trim() || ph;
    message = message.replace(ph, inputValue);
  });

  const selectedPlatforms = Array.from(elements.platformCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.platform);

  if (selectedPlatforms.length === 0) {
    console.error("请至少选择一个平台");
    return;
  }

  elements.sendButton.disabled = true;
  elements.sendButton.textContent = "发送中...";

  // 保存所有输入块内容到历史记录
  addToBlockHistory().then(() => {
    const actionsQueue = selectedPlatforms.map((platform) => ({
      platform,
      message,
    }));

    chrome.runtime.sendMessage(
      { action: "processTaskQueue", queue: actionsQueue },
      () => window.close()
    );
  });
}

/** 切换历史面板显示状态 */
function toggleHistoryPanel() {
  if (elements.historyPanel.style.display === "none") {
    elements.historyPanel.style.display = "block";
    elements.historyOverlay.style.display = "block";
    elements.toggleHistoryBtn.textContent = "隐藏历史";
  } else {
    elements.historyPanel.style.display = "none";
    elements.historyOverlay.style.display = "none";
    elements.toggleHistoryBtn.textContent = "显示历史";
  }
}

/** 设置事件监听器 */
function setupEventListeners() {
  elements.selectAllButton.addEventListener("click", toggleSelectAll);
  elements.platformCheckboxes.forEach((cb) =>
    cb.addEventListener("change", savePlatformStates)
  );
  elements.sendButton.addEventListener("click", startSending);
  elements.toggleHistoryBtn.addEventListener("click", toggleHistoryPanel);
  elements.closeHistoryBtn.addEventListener("click", toggleHistoryPanel);

  // 点击遮罩层关闭历史面板
  elements.historyOverlay.addEventListener("click", toggleHistoryPanel);
}

export { initializePopup, setupEventListeners, startSending };

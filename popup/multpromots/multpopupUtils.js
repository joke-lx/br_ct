/**
 * 多提示词组件 - 工具函数
 * 简化版：移除旧模板系统，只保留动态输入框和历史记录管理
 */

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
    dynamicInputsContainer: document.getElementById("dynamic-inputs"),
    historyPanel: document.getElementById("history-panel"),
    historyList: document.getElementById("history-list"),
    closeHistoryBtn: document.getElementById("close-history-btn"),
    toggleHistoryBtn: document.getElementById("toggle-history-btn"),
    historyOverlay: document.getElementById("history-overlay"),
  };

  loadStoredData();

  // 初始化历史面板
  elements.historyPanel.style.display = "none";
  elements.historyOverlay.style.display = "none";

  // 创建默认输入框
  renderDefaultInput();
}

/** 渲染默认输入框 */
function renderDefaultInput() {
  elements.dynamicInputsContainer.innerHTML = "";
  dynamicInputs = [];

  const textarea = createInputBox("请输入您的问题...");
  elements.dynamicInputsContainer.appendChild(textarea);
  dynamicInputs.push(textarea);
}

/** 创建输入框 */
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

  // 监听输入事件
  textarea.addEventListener("input", adjustHeight);

  // 初始调用一次以确保正确显示
  setTimeout(adjustHeight, 0);

  return textarea;
}

/** 加载存储的数据 */
function loadStoredData() {
  // 加载历史记录
  chrome.storage.local.get(["multiPromptHistory"], (result) => {
    const history = result.multiPromptHistory || [];
    renderHistory(history);
  });
}

/** 保存历史记录 */
function saveHistory(content) {
  chrome.storage.local.get(["multiPromptHistory"], (result) => {
    let history = result.multiPromptHistory || [];

    // 添加新记录到开头
    history.unshift(content);

    // 限制历史记录数量
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    chrome.storage.local.set({ multiPromptHistory: history }, () => {
      renderHistory(history);
    });
  });
}

/** 渲染历史记录 */
function renderHistory(history) {
  elements.historyList.innerHTML = "";

  if (history.length === 0) {
    elements.historyList.innerHTML = `
      <div style="text-align: center; color: #999; padding: 40px;">
        暂无历史记录
      </div>
    `;
    return;
  }

  history.forEach((item, index) => {
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";
    historyItem.innerHTML = `
      <div class="history-content" title="${escapeHtml(item)}">
        ${escapeHtml(item)}
      </div>
      <button class="copy-btn" data-index="${index}">复制</button>
    `;

    // 点击历史记录内容填充到输入框
    historyItem.querySelector(".history-content").addEventListener("click", () => {
      if (dynamicInputs.length > 0) {
        dynamicInputs[0].value = item;
        dynamicInputs[0].dispatchEvent(new Event("input"));
      }
    });

    // 复制按钮
    historyItem.querySelector(".copy-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(item);
        const btn = e.target;
        const originalText = btn.textContent;
        btn.textContent = "✓ 已复制";
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1500);
      } catch (err) {
        console.error("复制失败:", err);
      }
    });

    elements.historyList.appendChild(historyItem);
  });
}

/** HTML 转义 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** 获取输入内容 */
function getInputContent() {
  return dynamicInputs.map(input => input.value).join("\n\n").trim();
}

/** 设置事件监听器 */
function setupEventListeners() {
  // 全选/取消全选
  elements.selectAllButton.addEventListener("click", toggleSelectAll);

  // 发送消息
  elements.sendButton.addEventListener("click", handleSend);

  // 历史记录面板
  elements.toggleHistoryBtn.addEventListener("click", () => {
    elements.historyPanel.style.display = "block";
    elements.historyOverlay.style.display = "block";
  });

  elements.closeHistoryBtn.addEventListener("click", closeHistoryPanel);
  elements.historyOverlay.addEventListener("click", closeHistoryPanel);
}

/** 关闭历史面板 */
function closeHistoryPanel() {
  elements.historyPanel.style.display = "none";
  elements.historyOverlay.style.display = "none";
}

/** 切换全选 */
function toggleSelectAll() {
  const visibleCheckboxes = Array.from(elements.platformCheckboxes).filter(cb => {
    const option = cb.closest('.platform-icon-option');
    return option && option.style.display !== 'none';
  });

  if (visibleCheckboxes.length === 0) return;

  const allChecked = visibleCheckboxes.every(cb => cb.checked);
  visibleCheckboxes.forEach(cb => {
    cb.checked = !allChecked;
  });

  updateSelectAllText();
}

/** 更新全选按钮文本 */
function updateSelectAllText() {
  const visibleCheckboxes = Array.from(elements.platformCheckboxes).filter(cb => {
    const option = cb.closest('.platform-icon-option');
    return option && option.style.display !== 'none';
  });

  if (visibleCheckboxes.length === 0) return;

  const allChecked = visibleCheckboxes.every(cb => cb.checked);
  elements.selectAllButton.textContent = allChecked ? "取消全选" : "全选";
}

/** 处理发送 */
async function handleSend() {
  const content = getInputContent();

  if (!content) {
    alert("请输入内容");
    return;
  }

  const selectedPlatforms = Array.from(elements.platformCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.platform);

  if (selectedPlatforms.length === 0) {
    alert("请至少选择一个平台");
    return;
  }

  // 保存到历史
  saveHistory(content);

  // 构造任务队列
  const actionsQueue = selectedPlatforms.map(platform => ({
    platform,
    message: content
  }));

  // 发送到 background
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "processTaskQueue",
          queue: actionsQueue,
          config: {
            maxConcurrent: 3,
            batchDelay: 300,
            tabLoadTimeout: 8000,
            scriptTimeout: 5000
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

    console.log("发送成功:", response);

    // 显示结果
    if (response && response.status === "completed") {
      const successMsg = `处理完成: 成功 ${response.success}/${response.total}`;
      elements.sendButton.textContent = successMsg;
      setTimeout(() => {
        elements.sendButton.textContent = "发送消息";
      }, 2000);
    }
  } catch (error) {
    console.error("发送失败:", error);
    alert("发送失败: " + error.message);
  }
}

// 导出函数
export {
  initializePopup,
  setupEventListeners,
  getInputContent,
  dynamicInputs
};

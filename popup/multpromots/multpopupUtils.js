import { populateOptimizer } from "../promots/promptsUI.js";

const OPTIMIZER_KEY = "selectedOptimizer";
const MAX_HISTORY = 5;

let elements = {};
let dynamicInputs = []; // 存储动态输入框

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
    historySelect: document.getElementById("history-select"),
  };

  populateOptimizer(elements.promptOptimizerSelect);
  setupOptimizerInputSync();
  loadStoredData();
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
      const textarea = createInputBox(`输入（按照顺序进行映射） `);
      elements.dynamicInputsContainer.appendChild(textarea);
      dynamicInputs.push(textarea);
    });
  }
}

/** 创建输入框 */
function createInputBox(placeholder) {
  const textarea = document.createElement("textarea");
  textarea.className = "message-input";
  textarea.placeholder = placeholder;
  textarea.rows = 2;
  return textarea;
}

/** 加载存储数据（优化器选择 + 平台状态 + 历史消息） */
function loadStoredData() {
  chrome.storage.sync.get(
    [OPTIMIZER_KEY, "platformStates", "agentHistory"],
    (result) => {
      loadOptimizer(result[OPTIMIZER_KEY]);
      restorePlatformStates(result.platformStates);
      populateAgentHistory(result.agentHistory || {});
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

/** 渲染每个智能体历史记录 */
function populateAgentHistory(agentHistory) {
  elements.historySelect.innerHTML = `<option value="">选择历史消息</option>`;
  Object.entries(agentHistory).forEach(([agent, messages]) => {
    messages.forEach((msg) => {
      const opt = document.createElement("option");
      opt.value = msg;
      opt.textContent = `[${agent}] ${
        msg.length > 40 ? msg.slice(0, 40) + "..." : msg
      }`;
      elements.historySelect.appendChild(opt);
    });
  });

  // 选择历史消息
  elements.historySelect.addEventListener("change", () => {
    if (elements.historySelect.value) {
      dynamicInputs[0].value = elements.historySelect.value;
    }
  });
}

/** 添加历史记录 */
function addToAgentHistory(message) {
  return new Promise((resolve) => {
    chrome.storage.sync.get("agentHistory", (result) => {
      const agentHistory = result.agentHistory || {};
      const selectedPlatforms = Array.from(elements.platformCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.dataset.platform);

      selectedPlatforms.forEach((agent) => {
        if (!agentHistory[agent]) agentHistory[agent] = [];
        agentHistory[agent] = agentHistory[agent].filter(
          (msg) => msg !== message
        );
        agentHistory[agent].unshift(message);
        if (agentHistory[agent].length > MAX_HISTORY) {
          agentHistory[agent] = agentHistory[agent].slice(0, MAX_HISTORY);
        }
      });

      chrome.storage.sync.set({ agentHistory }, () => resolve());
    });
  });
}

/** 发送消息逻辑 */
function startSending() {
  const selectedValue =
    elements.promptOptimizerSelect.querySelector(".selected-value");
  const templateKey = selectedValue.dataset.value;
  const templateContent = selectedValue.dataset.template || "%s";

  let message = templateContent;
  dynamicInputs.forEach((input, i) => {
    const key = i === 0 ? "%s" : `%s${i}`;
    message = message.replaceAll(key, input.value.trim() || key);
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

  addToAgentHistory(message).then(() => {
    const actionsQueue = selectedPlatforms.map((platform) => ({
      platform,
      message,
    }));
    chrome.runtime.sendMessage(
      { action: "processTaskQueue", queue: actionsQueue },
      () => {
        window.close();
      }
    );
  });
}

/** 设置事件监听器 */
function setupEventListeners() {
  elements.selectAllButton.addEventListener("click", toggleSelectAll);
  elements.platformCheckboxes.forEach((cb) =>
    cb.addEventListener("change", savePlatformStates)
  );
  elements.sendButton.addEventListener("click", startSending);
}

export { initializePopup, setupEventListeners, startSending };

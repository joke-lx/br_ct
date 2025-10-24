import { populateOptimizer } from "../promots/promptsUI.js";

const HISTORY_KEY = "messageHistory";
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
  };

  populateOptimizer(elements.promptOptimizerSelect);
  setupOptimizerInputSync();
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

/** 根据模板渲染输入框 */
function renderDynamicInputs(template) {
  const matches = Array.from(template.matchAll(/%s\d*/g)); // 匹配 %s, %s1, %s2
  const placeholders = matches.map((m) => m[0]);
  elements.dynamicInputsContainer.innerHTML = "";
  dynamicInputs = [];

  if (placeholders.length === 0) {
    // 默认一个输入框
    const textarea = createInputBox("主输入（对应 %s）");
    elements.dynamicInputsContainer.appendChild(textarea);
    dynamicInputs.push(textarea);
  } else {
    placeholders.forEach((ph, i) => {
      const textarea = createInputBox(`输入 ${i + 1} （${ph}）`);
      elements.dynamicInputsContainer.appendChild(textarea);
      dynamicInputs.push(textarea);
    });
  }
}

/** 创建一个输入框 */
function createInputBox(placeholder) {
  const textarea = document.createElement("textarea");
  textarea.className = "message-input";
  textarea.placeholder = placeholder;
  textarea.rows = 2;
  return textarea;
}

/** 事件绑定 */
function setupEventListeners() {
  elements.selectAllButton.addEventListener("click", toggleSelectAll);
  elements.platformCheckboxes.forEach((cb) =>
    cb.addEventListener("change", savePlatformStates)
  );
  elements.sendButton.addEventListener("click", startSending);
}

/** 切换全选 */
function toggleSelectAll() {
  const allChecked = Array.from(elements.platformCheckboxes).every(
    (cb) => cb.checked
  );
  elements.platformCheckboxes.forEach((cb) => (cb.checked = !allChecked));
  savePlatformStates();
}

/** 保存平台状态 */
function savePlatformStates() {
  const states = {};
  elements.platformCheckboxes.forEach((cb) => {
    states[cb.dataset.platform] = cb.checked;
  });
  chrome.storage.sync.set({ platformStates: states });
}

/** 发送逻辑 */
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

  const actionsQueue = selectedPlatforms.map((p) => ({ platform: p, message }));
  chrome.runtime.sendMessage(
    { action: "processTaskQueue", queue: actionsQueue },
    () => {
      window.close();
    }
  );
}

export { initializePopup, setupEventListeners, startSending };

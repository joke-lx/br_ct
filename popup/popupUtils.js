// popupUtils.js

const HISTORY_KEY = 'messageHistory';
const OPTIMIZER_KEY = 'selectedOptimizer';
const MAX_HISTORY = 5;

/** 填充优化器下拉框 */
function populateOptimizer(promptOptimizerSelect) {
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '不使用优化';
  promptOptimizerSelect.appendChild(emptyOption);

  for (const key in PROMPT_TEMPLATES) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = PROMPT_TEMPLATES[key].label;
    promptOptimizerSelect.appendChild(option);
  }
}

/** 渲染历史消息 */
function populateHistory(historySelect, history) {
  historySelect.innerHTML = `<option value="">选择历史消息</option>`;
  history.forEach(msg => {
    const opt = document.createElement('option');
    opt.value = msg;
    opt.textContent = msg.length > 40 ? msg.slice(0, 40) + '...' : msg;
    historySelect.appendChild(opt);
  });
}

/** 添加消息到历史 */
function addToHistory(message, historySelect) {
  chrome.storage.sync.get(HISTORY_KEY, (result) => {
    let history = result[HISTORY_KEY] || [];
    history = history.filter(item => item !== message);
    history.unshift(message);
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    chrome.storage.sync.set({ [HISTORY_KEY]: history }, () => {
      populateHistory(historySelect, history);
    });
  });
}

/** 保存平台勾选状态 */
function savePlatformStates(platformCheckboxes) {
  const checkedStates = {};
  platformCheckboxes.forEach(cb => {
    checkedStates[cb.dataset.platform] = cb.checked;
  });
  chrome.storage.sync.set({ platformStates: checkedStates });
}

export {
  HISTORY_KEY,
  OPTIMIZER_KEY,
  populateOptimizer,
  populateHistory,
  addToHistory,
  savePlatformStates
};

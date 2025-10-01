// popup.js
import {
  HISTORY_KEY,
  OPTIMIZER_KEY,
  populateOptimizer,
  populateHistory,
  addToHistory,
  savePlatformStates
} from './popupUtils.js';

document.addEventListener('DOMContentLoaded', function () {
  const platformCheckboxes = document.querySelectorAll('.platform-option input[type="checkbox"]');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const selectAllButton = document.getElementById('select-all');
  const historySelect = document.getElementById('history-select');
  const promptOptimizerSelect = document.getElementById('prompt-optimizer-select');

  if (messageInput) {
    setTimeout(() => {
      messageInput.focus();
      const len = messageInput.value.length;
      messageInput.setSelectionRange(len, len);
    }, 100);
  }

  // 填充优化器
  populateOptimizer(promptOptimizerSelect);

  // 加载存储
  chrome.storage.sync.get(['lastMessage', 'platformStates', HISTORY_KEY, OPTIMIZER_KEY], (result) => {
    if (result.lastMessage) {
      messageInput.value = result.lastMessage;
    }
    if (result.platformStates) {
      platformCheckboxes.forEach(cb => {
        if (result.platformStates.hasOwnProperty(cb.dataset.platform)) {
          cb.checked = result.platformStates[cb.dataset.platform];
        }
      });
    }
    if (result[HISTORY_KEY]) {
      populateHistory(historySelect, result[HISTORY_KEY]);
    }
    if (result[OPTIMIZER_KEY]) {
      promptOptimizerSelect.value = result[OPTIMIZER_KEY];
    }
  });

  // 保存输入框内容
  messageInput.addEventListener('input', () => {
    chrome.storage.sync.set({ lastMessage: messageInput.value });
  });

  // 历史选择
  historySelect.addEventListener('change', () => {
    if (historySelect.value) {
      messageInput.value = historySelect.value;
      messageInput.dispatchEvent(new Event('input'));
    }
  });

  // 优化器选择
  promptOptimizerSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ [OPTIMIZER_KEY]: promptOptimizerSelect.value });
  });

  // 勾选状态保存
  platformCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      savePlatformStates(platformCheckboxes);
    });
  });

  // 全选/取消全选
  selectAllButton.addEventListener('click', function () {
    const allChecked = Array.from(platformCheckboxes).every(checkbox => checkbox.checked);
    platformCheckboxes.forEach(checkbox => { checkbox.checked = !allChecked; });
    this.textContent = allChecked ? '全选' : '取消全选';
    savePlatformStates(platformCheckboxes);
  });

  // 发送逻辑
  function startSending() {
    const originalMessage = messageInput.value.trim();
    if (!originalMessage) {
      alert('请输入消息内容');
      return;
    }

    const optimizerKey = promptOptimizerSelect.value;
    let finalMessage = originalMessage;

    if (optimizerKey && PROMPT_TEMPLATES[optimizerKey]) {
      const template = PROMPT_TEMPLATES[optimizerKey].template;
      finalMessage = template.includes('%s')
        ? template.replace('%s', originalMessage)
        : originalMessage + ' ' + template;
    }

    const selectedPlatforms = Array.from(platformCheckboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.dataset.platform);

    if (selectedPlatforms.length === 0) {
      alert('请至少选择一个平台');
      return;
    }

    savePlatformStates(platformCheckboxes);
    addToHistory(originalMessage, historySelect);

    sendButton.disabled = true;
    sendButton.textContent = '发送中...';

    const actionsQueue = selectedPlatforms.map(platform => ({ platform, message: finalMessage }));

    chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
      window.close();
    });
  }

  sendButton.addEventListener('click', startSending);
});

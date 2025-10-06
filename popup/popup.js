import {
  HISTORY_KEY,
  OPTIMIZER_KEY,
  populateOptimizer,
  populateHistory,
  addToHistory,
  savePlatformStates
} from './popupUtils.js';

document.addEventListener('DOMContentLoaded', function () {
  // 修正了选择器，以匹配新的 HTML 类名 .platform-icon-option
  const platformCheckboxes = document.querySelectorAll('.platform-icon-option input[type="checkbox"]');
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
    
    // 加载平台状态
    if (result.platformStates) {
      platformCheckboxes.forEach(cb => {
        // 查找对应的 icon 容器，并在加载状态时更新它的视觉状态
        const iconWrapper = cb.closest('.platform-icon-option').querySelector('.icon-wrapper');
        
        if (result.platformStates.hasOwnProperty(cb.dataset.platform)) {
          cb.checked = result.platformStates[cb.dataset.platform];
          if (iconWrapper) {
            // 确保视觉状态与 checked 属性同步
            iconWrapper.classList.toggle('checked', cb.checked);
          }
        }
      });
      // 更新全选按钮文本
      updateSelectAllText(platformCheckboxes, selectAllButton);
    }
    
    if (result[HISTORY_KEY]) {
      populateHistory(historySelect, result[HISTORY_KEY]);
    }
    if (result[OPTIMIZER_KEY]) {
      promptOptimizerSelect.value = result[OPTIMIZER_KEY];
    }
  });

  // 更新全选按钮文本的辅助函数
  function updateSelectAllText(checkboxes, button) {
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    button.textContent = allChecked ? '取消全选' : '全选';
  }

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

  // 勾选状态保存及视觉更新
  platformCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const iconWrapper = cb.closest('.platform-icon-option').querySelector('.icon-wrapper');
      if (iconWrapper) {
        iconWrapper.classList.toggle('checked', cb.checked);
      }
      savePlatformStates(platformCheckboxes);
      updateSelectAllText(platformCheckboxes, selectAllButton);
    });
  });

  // 全选/取消全选
  selectAllButton.addEventListener('click', function () {
    const allChecked = Array.from(platformCheckboxes).every(checkbox => checkbox.checked);
    
    platformCheckboxes.forEach(checkbox => { 
      checkbox.checked = !allChecked; 
      const iconWrapper = checkbox.closest('.platform-icon-option').querySelector('.icon-wrapper');
      if (iconWrapper) {
        iconWrapper.classList.toggle('checked', checkbox.checked);
      }
    });
    
    updateSelectAllText(platformCheckboxes, this);
    savePlatformStates(platformCheckboxes);
  });

  // 发送逻辑
  function startSending() {
    const originalMessage = messageInput.value.trim();
    if (!originalMessage) {
      // 避免使用 alert()，使用更友好的方式提示，但由于这是浏览器插件上下文，暂时保留此处的简单逻辑
      // 实际应用中应替换为自定义 modal
      console.error('请输入消息内容');
      return;
    }

    const optimizerKey = promptOptimizerSelect.value;
    let finalMessage = originalMessage;

    if (optimizerKey && PROMPT_TEMPLATES[optimizerKey]) {
      const template = PROMPT_TEMPLATES[optimizerKey].template;
      // PROMPT_TEMPLATES 假定在 `./promots/prompts.js` 中定义且已全局加载
      finalMessage = template.includes('%s')
        ? template.replace('%s', originalMessage)
        : originalMessage + ' ' + template;
    }

    const selectedPlatforms = Array.from(platformCheckboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.dataset.platform);

    if (selectedPlatforms.length === 0) {
      console.error('请至少选择一个平台');
      return;
    }

    savePlatformStates(platformCheckboxes);
    addToHistory(originalMessage, historySelect);

    sendButton.disabled = true;
    sendButton.textContent = '发送中...';

    const actionsQueue = selectedPlatforms.map(platform => ({ platform, message: finalMessage }));

    // 假设 chrome.runtime.sendMessage 存在并用于与 background script 通信
    chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
      // 任务发送后关闭弹窗
      window.close();
    });
  }

  sendButton.addEventListener('click', startSending);
});

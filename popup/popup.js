
document.addEventListener('DOMContentLoaded', function () {
  const platformCheckboxes = document.querySelectorAll('.platform-option input[type="checkbox"]');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const selectAllButton = document.getElementById('select-all');
  const historySelect = document.getElementById('history-select');
  const promptOptimizerSelect = document.getElementById('prompt-optimizer-select');
  
  // 存储键名
  const HISTORY_KEY = 'messageHistory';
  const OPTIMIZER_KEY = 'selectedOptimizer';
  const MAX_HISTORY = 5;

  function populateOptimizer() {
    // 先添加一个空选项表示不进行优化
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '不使用优化';
    promptOptimizerSelect.appendChild(emptyOption);
    
    // 添加其他优化选项
    for (const key in PROMPT_TEMPLATES) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = PROMPT_TEMPLATES[key].label;
      promptOptimizerSelect.appendChild(option);
    }
  }
  
  // 页面加载时立即执行填充
  populateOptimizer();
  
  // 加载历史消息、平台勾选状态和上次选择的优化器
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
      populateHistory(result[HISTORY_KEY]);
    }
    if (result[OPTIMIZER_KEY]) {
      promptOptimizerSelect.value = result[OPTIMIZER_KEY];
    }
  });

  // 实时保存输入框内容
  messageInput.addEventListener('input', () => {
    chrome.storage.sync.set({ lastMessage: messageInput.value });
  });
  
  // 点击历史消息自动填充
  historySelect.addEventListener('change', () => {
    if (historySelect.value) {
      messageInput.value = historySelect.value;
      messageInput.dispatchEvent(new Event('input'));
    }
  });

  // 当优化器选项改变时，保存其状态
  promptOptimizerSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ [OPTIMIZER_KEY]: promptOptimizerSelect.value });
  });
  
  // 勾选状态变动时实时保存
  platformCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const checkedStates = {};
      platformCheckboxes.forEach(c => {
        checkedStates[c.dataset.platform] = c.checked;
      });
      chrome.storage.sync.set({ platformStates: checkedStates });
    });
  });
  
  // 全选/取消全选
  selectAllButton.addEventListener('click', function () {
    const allChecked = Array.from(platformCheckboxes).every(checkbox => checkbox.checked);
    platformCheckboxes.forEach(checkbox => { checkbox.checked = !allChecked; });
    this.textContent = allChecked ? '全选' : '取消全选';
    
    // 保存状态
    const checkedStates = {};
    platformCheckboxes.forEach(c => {
      checkedStates[c.dataset.platform] = c.checked;
    });
    chrome.storage.sync.set({ platformStates: checkedStates });
  });
  
  // 渲染历史记录
  function populateHistory(history) {
    historySelect.innerHTML = `<option value="">选择历史消息</option>`;
    history.forEach(msg => {
      const opt = document.createElement('option');
      opt.value = msg;
      opt.textContent = msg.length > 40 ? msg.slice(0, 40) + '...' : msg;
      historySelect.appendChild(opt);
    });
  }
  
  // 添加消息到历史记录
  function addToHistory(message) {
    chrome.storage.sync.get(HISTORY_KEY, (result) => {
      let history = result[HISTORY_KEY] || [];
      history = history.filter(item => item !== message);
      history.unshift(message);
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      chrome.storage.sync.set({ [HISTORY_KEY]: history }, () => {
        populateHistory(history);
      });
    });
  }
  
  // 更新 startSending 函数以应用提示词
  function startSending() {
    const originalMessage = messageInput.value.trim();
    if (!originalMessage) {
      alert('请输入消息内容');
      return;
    }
    
    // 应用提示词模板
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
    
    const checkedStates = {};
    platformCheckboxes.forEach(cb => { checkedStates[cb.dataset.platform] = cb.checked; });
    chrome.storage.sync.set({ platformStates: checkedStates });
    
    // 将用户的原始消息添加到历史记录
    addToHistory(originalMessage);
    
    sendButton.disabled = true;
    sendButton.textContent = '发送中...';
    
    // 使用最终（优化后）的消息创建任务队列
    const actionsQueue = selectedPlatforms.map(platform => ({ platform, message: finalMessage }));
    
    chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
      window.close();
    });
  }
  
  sendButton.addEventListener('click', startSending);
});
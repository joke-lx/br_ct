document.addEventListener('DOMContentLoaded', function () {
  const platformCheckboxes = document.querySelectorAll('.platform-option input[type="checkbox"]');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const selectAllButton = document.getElementById('select-all');
  const historySelect = document.getElementById('history-select');
  
  // 存储键名
  const HISTORY_KEY = 'messageHistory';
  const MAX_HISTORY = 5;
  
  // 加载历史消息和平台勾选状态
  chrome.storage.sync.get(['lastMessage', 'platformStates', HISTORY_KEY], (result) => {
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
  });
  
  // 点击历史消息自动填充
  historySelect.addEventListener('change', () => {
    if (historySelect.value) {
      messageInput.value = historySelect.value;
    }
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
  
  // 添加消息到历史记录（只在发送时调用）
  function addToHistory(message) {
    chrome.storage.sync.get(HISTORY_KEY, (result) => {
      let history = result[HISTORY_KEY] || [];
      
      // 移除重复项
      history = history.filter(item => item !== message);
      
      // 添加到开头
      history.unshift(message);
      
      // 限制最大数量
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      
      // 保存并更新显示
      chrome.storage.sync.set({ [HISTORY_KEY]: history }, () => {
        populateHistory(history);
      });
    });
  }
  
  function startSending() {
    const message = messageInput.value.trim();
    if (!message) {
      alert('请输入消息内容');
      return;
    }
    
    const selectedPlatforms = Array.from(platformCheckboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.dataset.platform);
    
    if (selectedPlatforms.length === 0) {
      alert('请至少选择一个平台');
      return;
    }
    
    // 保存消息历史与平台勾选状态
    chrome.storage.sync.set({ lastMessage: message });
    const checkedStates = {};
    platformCheckboxes.forEach(cb => { checkedStates[cb.dataset.platform] = cb.checked; });
    chrome.storage.sync.set({ platformStates: checkedStates });
    
    // 只在发送时添加到历史记录
    addToHistory(message);
    
    sendButton.disabled = true;
    sendButton.textContent = '发送中...';
    
    const actionsQueue = selectedPlatforms.map(platform => ({ platform, message }));
    
    chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
      window.close();
    });
  }
  
  sendButton.addEventListener('click', startSending);
});
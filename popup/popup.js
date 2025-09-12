document.addEventListener('DOMContentLoaded', function () {
  const platformCheckboxes = document.querySelectorAll('.platform-option input[type="checkbox"]');
  const messageInput = document.querySelector('.message-input');
  const sendButton = document.getElementById('send-button');
  const selectAllButton = document.getElementById('select-all');

  // 加载历史消息和平台勾选状态
  chrome.storage.sync.get(['lastMessage', 'platformStates'], (result) => {
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
  });

  // 勾选状态变动时实时保存（可选）
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
  });

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

    sendButton.disabled = true;
    sendButton.textContent = '发送中...';

    const actionsQueue = selectedPlatforms.map(platform => ({ platform, message }));

    chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
      window.close();
    });
  }

  sendButton.addEventListener('click', startSending);
});

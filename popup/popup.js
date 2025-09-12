document.addEventListener('DOMContentLoaded', function() {
  const platformCheckboxes = document.querySelectorAll('.platform-option input[type="checkbox"]');
  const messageInput = document.querySelector('.message-input');
  const sendButton = document.getElementById('send-button');
  const selectAllButton = document.getElementById('select-all');

  // 加载历史消息
  chrome.storage.sync.get(['lastMessage'], (result) => {
    if (result.lastMessage) {
      messageInput.value = result.lastMessage;
    }
  });

  // 全选/取消全选功能
  selectAllButton.addEventListener('click', function() {
    const allChecked = Array.from(platformCheckboxes).every(checkbox => checkbox.checked);
    
    platformCheckboxes.forEach(checkbox => {
      checkbox.checked = !allChecked;
    });
    
    this.textContent = allChecked ? '全选' : '取消全选';
  });

  // 统一的发送处理函数
  function startSending() {
    const message = messageInput.value.trim();
    if (!message) {
      alert('请输入消息内容');
      return;
    }

    // 获取选中的平台
    const selectedPlatforms = Array.from(platformCheckboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.dataset.platform);

    if (selectedPlatforms.length === 0) {
      alert('请至少选择一个平台');
      return;
    }

    // 保存消息历史
    chrome.storage.sync.set({ lastMessage: message });

    // 禁用按钮，防止重复点击
    sendButton.disabled = true;
    sendButton.textContent = '发送中...';

    // 根据选中的平台创建任务队列
    const actionsQueue = selectedPlatforms.map(platform => ({
      platform: platform,
      message: message
    }));

    // 将任务队列存储到本地存储，并通知后台脚本开始处理
    chrome.runtime.sendMessage({
      action: "processTaskQueue",
      queue: actionsQueue
    }, () => {
      // 成功发送消息后关闭 popup 窗口
      window.close();
    });
  }

  // "发送消息"按钮事件
  sendButton.addEventListener('click', startSending);
});
// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const platformOptions = document.querySelectorAll('.platform-option');
  const messageInput = document.querySelector('.message-input');
  const sendButton = document.getElementById('send-button');
  const sendAllButton = document.getElementById('send-all-button');

  // 当前选中的平台
  let selectedPlatform = 'yuanbao';

  // 加载历史消息
  chrome.storage.sync.get(['lastMessage'], (result) => {
    if (result.lastMessage) {
      messageInput.value = result.lastMessage;
    }
  });

  // 平台选择事件
  platformOptions.forEach(option => {
    option.addEventListener('click', function() {
      // 更新UI状态
      platformOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      // 更新选中的平台
      selectedPlatform = this.dataset.platform;
    });
  });

  // 统一的发送处理函数
  function startSending(platforms) {
    const message = messageInput.value.trim();
    if (!message) {
      // 在 popup 中使用 alert 是安全的
      alert('请输入消息内容');
      return;
    }

    // 保存消息历史
    chrome.storage.sync.set({ lastMessage: message });

    // 禁用按钮，防止重复点击
    sendButton.disabled = true;
    sendAllButton.disabled = true;
    sendButton.textContent = '发送中...';
    sendAllButton.textContent = '发送中...';

    // 根据传入的平台信息创建任务队列
    const actionsQueue = platforms.map(platform => ({
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

  // “发送消息”按钮事件 (单个平台)
  sendButton.addEventListener('click', function() {
    startSending([selectedPlatform]);
  });

  // “依次发送”按钮事件 (所有平台)
  sendAllButton.addEventListener('click', function() {
    startSending(['yuanbao', 'gemini']);
  });
});

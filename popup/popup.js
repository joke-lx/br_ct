// popup.js - 更新版本，支持 Claude.ai
document.addEventListener('DOMContentLoaded', function() {
  const platformOptions = document.querySelectorAll('.platform-option');
  const messageInput = document.querySelector('.message-input');
  const sendButton = document.getElementById('send-button');
  const sendAllButton = document.getElementById('send-all-button');
  const testClaudeButton = document.getElementById('test-claude-button');
  const statusMessage = document.getElementById('status-message');

  // 当前选中的平台
  let selectedPlatform = 'yuanbao';

  // 支持的平台列表（更新为包含 Claude.ai）
  const supportedPlatforms = ['yuanbao', 'gemini', 'claude'];

  // 加载历史消息
  chrome.storage.sync.get(['lastMessage'], (result) => {
    if (result.lastMessage) {
      messageInput.value = result.lastMessage;
    }
  });

  // 状态显示函数
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
    
    // 3秒后自动隐藏状态消息
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }

  // 平台选择事件
  platformOptions.forEach(option => {
    option.addEventListener('click', function() {
      // 更新UI状态
      platformOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      // 更新选中的平台
      selectedPlatform = this.dataset.platform;
      
      // 显示选中的平台信息
      const platformName = this.querySelector('.platform-name').textContent;
      showStatus(`已选择：${platformName}`, 'info');
    });
  });

  // 统一的发送处理函数
  function startSending(platforms, buttonText = '发送中...') {
    const message = messageInput.value.trim();
    if (!message) {
      showStatus('请输入消息内容', 'error');
      return;
    }

    // 验证平台是否支持
    const validPlatforms = platforms.filter(platform => 
      supportedPlatforms.includes(platform)
    );
    
    if (validPlatforms.length === 0) {
      showStatus('没有有效的平台被选中', 'error');
      return;
    }

    // 保存消息历史
    chrome.storage.sync.set({ lastMessage: message });

    // 禁用所有按钮，防止重复点击
    disableButtons(buttonText);
    
    // 显示发送状态
    const platformNames = validPlatforms.map(p => {
      switch(p) {
        case 'yuanbao': return '腾讯元宝';
        case 'gemini': return 'Google Gemini';
        case 'claude': return 'Claude.ai';
        default: return p;
      }
    }).join('、');
    
    showStatus(`正在向 ${platformNames} 发送消息...`, 'info');

    // 根据传入的平台信息创建任务队列
    const actionsQueue = validPlatforms.map(platform => ({
      platform: platform,
      message: message
    }));

    // 将任务队列存储到本地存储，并通知后台脚本开始处理
    chrome.runtime.sendMessage({
      action: "processTaskQueue",
      queue: actionsQueue
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息时出错:', chrome.runtime.lastError);
        showStatus('发送失败：' + chrome.runtime.lastError.message, 'error');
        enableButtons();
        return;
      }
      
      if (response && response.status === "processing_started") {
        showStatus(`任务已开始处理，共 ${validPlatforms.length} 个平台`, 'success');
        // 延迟关闭窗口，让用户看到成功消息
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        showStatus('发送失败：后台处理器无响应', 'error');
        enableButtons();
      }
    });
  }

  // 禁用所有按钮
  function disableButtons(text) {
    sendButton.disabled = true;
    sendAllButton.disabled = true;
    testClaudeButton.disabled = true;
    
    sendButton.textContent = text;
    sendAllButton.textContent = text;
    testClaudeButton.textContent = text;
  }

  // 启用所有按钮
  function enableButtons() {
    sendButton.disabled = false;
    sendAllButton.disabled = false;
    testClaudeButton.disabled = false;
    
    sendButton.textContent = '发送消息';
    sendAllButton.textContent = '依次发送所有';
    testClaudeButton.textContent = '测试 Claude.ai';
  }

  // "发送消息"按钮事件 (单个平台)
  sendButton.addEventListener('click', function() {
    startSending([selectedPlatform]);
  });

  // "依次发送所有"按钮事件 (所有平台)
  sendAllButton.addEventListener('click', function() {
    startSending(supportedPlatforms, '批量发送中...');
  });

  // "测试 Claude.ai"按钮事件
  testClaudeButton.addEventListener('click', function() {
    // 临时保存当前消息
    const originalMessage = messageInput.value;
    
    // 设置测试消息
    messageInput.value = 'Hello Claude! 这是来自浏览器插件的测试消息。请简单回复确认收到。';
    
    // 发送测试消息
    startSending(['claude'], '测试中...');
    
    // 延迟恢复原消息（如果窗口没有关闭）
    setTimeout(() => {
      if (!document.hidden) {
        messageInput.value = originalMessage;
      }
    }, 2000);
  });

  // 快捷键支持
  document.addEventListener('keydown', function(event) {
    // Ctrl+Enter 发送消息到当前选中的平台
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      sendButton.click();
    }
    
    // Ctrl+Shift+Enter 发送消息到所有平台
    if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      sendAllButton.click();
    }
    
    // Alt+C 测试 Claude.ai
    if (event.altKey && event.key === 'c') {
      event.preventDefault();
      testClaudeButton.click();
    }
  });

  // 监听来自背景脚本的状态更新（如果需要）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updatePopupStatus") {
      showStatus(request.message, request.type || 'info');
    }
  });

  // 页面初始化时显示提示
  showStatus('插件已就绪，支持三个AI平台', 'success');
});
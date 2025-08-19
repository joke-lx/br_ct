document.addEventListener('DOMContentLoaded', function() {
  const platformOptions = document.querySelectorAll('.platform-option');
  const messageInput = document.querySelector('.message-input');
  const sendButton = document.querySelector('.send-button');
  
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
  
  // 发送按钮事件
  sendButton.addEventListener('click', function() {
    const message = messageInput.value.trim();
    if (!message) {
      alert('请输入消息内容');
      return;
    }
    
    // 保存消息
    chrome.storage.sync.set({ lastMessage: message });
    
    // 禁用按钮防止重复点击
    sendButton.disabled = true;
    sendButton.textContent = '发送中...';
    
    // 准备执行脚本的数据
    const aiAction = {
      run: true,
      platform: selectedPlatform,
      message: message
    };
    
    // 根据平台设置目标URL
    let targetUrl;
    if (selectedPlatform === 'yuanbao') {
      targetUrl = 'https://yuanbao.tencent.com/chat/naQivTmsDa';
    } else if (selectedPlatform === 'gemini') {
      targetUrl = 'https://gemini.google.com/app?hl=zh-cn';
    }
    
    // 保存并执行脚本
    chrome.storage.local.set({ aiAction }, () => {
      // 获取当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes(targetUrl)) {
          // 如果当前标签页已经是目标平台，直接执行脚本
          chrome.tabs.reload(tabs[0].id);
        } else {
          // 否则创建新标签页或更新当前标签页
          if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: targetUrl });
          } else {
            chrome.tabs.create({ url: targetUrl });
          }
        }
        
        // 恢复按钮状态
        setTimeout(() => {
          sendButton.disabled = false;
          sendButton.textContent = '发送消息';
        }, 3000);
      });
    });
  });
});



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

  function startSending(actions) {

    const message = messageInput.value.trim();

    if (!message) {

      // 在popup中使用alert是安全的

      alert('请输入消息内容');

      return;

    }



    // 保存消息历史

    chrome.storage.sync.set({ lastMessage: message });



    // 禁用按钮

    sendButton.disabled = true;

    sendAllButton.disabled = true;

    sendButton.textContent = '发送中...';

    sendAllButton.textContent = '发送中...';



    // 根据传入的动作信息创建任务队列

    const actionsQueue = actions.map(actionInfo => ({

      platform: actionInfo.platform,

      message: message,

      url: actionInfo.url

    }));



    // 存储任务队列，并通知后台脚本开始处理

    chrome.storage.local.set({ actionsQueue }, () => {

      chrome.runtime.sendMessage({ action: "processQueue" }, () => {

        // 通知后台后，关闭popup

        window.close();

      });

    });

  }



  // “发送消息”按钮事件 (单个平台)

  sendButton.addEventListener('click', function() {

    let targetUrl;

    if (selectedPlatform === 'yuanbao') {

      targetUrl = 'https://yuanbao.tencent.com/chat/naQivTmsDa';

    } else if (selectedPlatform === 'gemini') {

      targetUrl = 'https://gemini.google.com/app?hl=zh-cn';

    }

    startSending([{ platform: selectedPlatform, url: targetUrl }]);

  });



  // “依次发送”按钮事件 (所有平台)

  sendAllButton.addEventListener('click', function() {

    startSending([

      { platform: 'yuanbao', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa' },

      { platform: 'gemini', url: 'https://gemini.google.com/app?hl=zh-cn' }

    ]);

  });

});

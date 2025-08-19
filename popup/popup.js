document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.querySelector('.url-input');
  const jumpButton = document.querySelector('.jump-button');
  const messageInput = document.querySelector('.message-input');
  const scriptSendBtn = document.querySelector('.script-send-btn');
  
  // 加载历史URL和消息
  chrome.storage.sync.get(['lastUrl', 'lastMessage'], (result) => {
    urlInput.value = result.lastUrl || '';
    messageInput.value = result.lastMessage || '在浏览器控制台能否控制多个页面 执行方法';
  });

  // 跳转功能
  const navigateToUrl = (url) => {
    let finalUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      finalUrl = `https://${url}`;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      tabs[0] 
        ? chrome.tabs.update(tabs[0].id, { url: finalUrl })
        : chrome.tabs.create({ url: finalUrl });
    });
  };

  // 跳转按钮
  jumpButton.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      chrome.storage.sync.set({ lastUrl: url });
      navigateToUrl(url);
    }
  });

  // 回车跳转
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && urlInput.value.trim()) {
      jumpButton.click();
    }
  });

  // 目录项点击
  document.querySelectorAll('.directory-item').forEach(item => {
    item.addEventListener('click', function() {
      const url = this.dataset.url;
      const isScriptAction = this.classList.contains('script-action');
      
      if (isScriptAction) {
        chrome.storage.local.set({
          scriptAction: {
            run: true,
            url: url,
            name: this.textContent.trim()
          }
        });
      }
      
      urlInput.value = url;
      navigateToUrl(url);
    });
  });
  
  // 消息发送按钮
  scriptSendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
      // 保存消息
      chrome.storage.sync.set({ lastMessage: message });
      
      // 获取当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // 准备执行脚本的数据
          const scriptData = {
            run: true,
            url: tabs[0].url,
            name: "发送消息到页面",
            message: message
          };
          
          // 保存并执行脚本
          chrome.storage.local.set({ scriptAction: scriptData }, () => {
            // 在当前页面执行脚本
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['contentScripts/messageSender.js']
            }, () => {
              // 发送消息
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "sendMessage",
                message: message
              });
            });
          });
        }
      });
    }
  });
});
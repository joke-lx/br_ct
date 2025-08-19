// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get(['scriptAction'], (result) => {
      const action = result.scriptAction;
      if (action?.run) {
        executeScriptBasedOnSite(tabId, tab.url, action);
      }
    });
  }
});

// 执行脚本
function executeScriptBasedOnSite(tabId, url, scriptAction) {
  // 重置标志
  chrome.storage.local.set({ scriptAction: { ...scriptAction, run: false } });

  // 特定网站的脚本处理
  if (scriptAction.name.includes('消息发送')) {
    executeMessageSenderScript(tabId, scriptAction);
  }
  // 其他脚本类型...
}

// 执行消息发送脚本
function executeMessageSenderScript(tabId, action) {
  // 注入内容脚本
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['contentScripts/messageSender.js']
  }, () => {
    // 发送消息请求
    chrome.tabs.sendMessage(tabId, {
      action: "sendMessage",
      message: action.message || "这是一个自动发送的测试消息"
    }, (response) => {
      if (response?.status === 'success') {
        console.log("消息发送成功");
      } else {
        console.warn("消息发送可能失败");
      }
    });
  });
}
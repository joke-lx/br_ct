// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get(['aiAction'], (result) => {
      const action = result.aiAction;
      if (action?.run) {
        executeScriptBasedOnPlatform(tabId, tab.url, action);
      }
    });
  }
});

// 执行脚本
function executeScriptBasedOnPlatform(tabId, url, action) {
  // 重置标志
  chrome.storage.local.set({ aiAction: { ...action, run: false } });

  // 检查URL是否匹配目标平台
  if (action.platform === 'yuanbao' && url.includes('yuanbao.tencent.com')) {
    executeYuanbaoScript(tabId, action);
  } 
  else if (action.platform === 'gemini' && url.includes('gemini.google.com')) {
    executeGeminiScript(tabId, action);
  }
  else {
    console.warn(`当前页面不是${action.platform}平台`);
  }
}

// 执行Yuanbao脚本
function executeYuanbaoScript(tabId, action) {
  // 注入内容脚本
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['contentScripts/yuanbao.js']
  }, () => {
    // 发送消息请求
    chrome.tabs.sendMessage(tabId, {
      action: "sendMessage",
      message: action.message || "这是一个自动发送的测试消息"
    }, (response) => {
      if (response?.status === 'success') {
        console.log("Yuanbao消息发送成功");
      } else {
        console.warn("Yuanbao消息发送可能失败");
      }
    });
  });
}

// 执行Gemini脚本
function executeGeminiScript(tabId, action) {
  // 注入内容脚本
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['contentScripts/gemini.js']
  }, () => {
    // 发送消息请求
    chrome.tabs.sendMessage(tabId, {
      action: "sendMessage",
      message: action.message || "这是一个自动发送的测试消息"
    }, (response) => {
      if (response?.status === 'success') {
        console.log("Gemini消息发送成功");
      } else {
        console.warn("Gemini消息发送可能失败");
      }
    });
  });
}
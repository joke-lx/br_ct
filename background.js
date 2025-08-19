// 监听来自popup的消息，启动任务队列处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processQueue") {
    console.log("收到处理队列的请求");
    processNextAction();
    sendResponse({ status: "processing_started" });
  }
  return true; // 异步响应
});

// 处理队列中的下一个任务
function processNextAction() {
  chrome.storage.local.get('actionsQueue', (result) => {
    const queue = result.actionsQueue;

    // 如果队列为空，则任务完成
    if (!queue || queue.length === 0) {
      console.log("任务队列已空，处理完成");
      chrome.storage.local.remove('actionsQueue'); // 清理存储
      return;
    }

    const nextAction = queue[0];
    console.log("正在处理下一个任务:", nextAction);

    // 查询是否已存在目标平台的标签页
    chrome.tabs.query({}, (tabs) => {
      const targetTab = tabs.find(tab => isUrlForPlatform(tab.url, nextAction.platform));

      if (targetTab) {
        // 如果存在，则更新并激活该标签页
        console.log(`为 ${nextAction.platform} 找到已存在标签页 ${targetTab.id}，正在更新`);
        chrome.tabs.update(targetTab.id, { url: nextAction.url, active: true });
      } else {
        // 如果不存在，则创建新标签页
        console.log(`未找到 ${nextAction.platform} 的标签页，正在创建`);
        chrome.tabs.create({ url: nextAction.url, active: true });
      }
    });
  });
}

// 监听标签页更新，当目标页面加载完成后注入脚本
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get('actionsQueue', (result) => {
      const queue = result.actionsQueue;

      // 检查队列中是否有待处理的任务
      if (queue && queue.length > 0) {
        const currentAction = queue[0];

        // 检查加载完成的页面是否是当前任务的目标平台
        if (isUrlForPlatform(tab.url, currentAction.platform)) {
          console.log(`标签页 ${tabId} (${currentAction.platform}) 加载完成，准备执行脚本`);
          executeScriptForPlatform(tabId, currentAction);
        }
      }
    });
  }
});

// 辅助函数：检查URL是否匹配平台
function isUrlForPlatform(url, platform) {
  if (!url) return false;
  if (platform === 'yuanbao' && url.includes('yuanbao.tencent.com')) return true;
  if (platform === 'gemini' && url.includes('gemini.google.com')) return true;
  return false;
}

// 根据平台信息，执行相应的内容脚本
function executeScriptForPlatform(tabId, action) {
  const scriptFile = `contentScripts/${action.platform}.js`;

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [scriptFile]
  }, () => {
    // 脚本注入后，向其发送消息
    chrome.tabs.sendMessage(tabId, {
      action: "sendMessage",
      message: action.message
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`向 ${action.platform} 发送消息时出错:`, chrome.runtime.lastError.message);
      } else {
        console.log(`成功向 ${action.platform} 发送消息，响应:`, response);
      }

      // 任务完成（无论成功与否），从队列中移除，并处理下一个
      chrome.storage.local.get('actionsQueue', (result) => {
        let queue = result.actionsQueue || [];
        // 预防竞态条件：确保我们完成的任务仍然是队列的第一个
        if (queue.length > 0 && queue[0].platform === action.platform) {
          queue.shift(); // 移除已完成的任务
          console.log("任务完成，更新队列:", queue);
          chrome.storage.local.set({ actionsQueue: queue }, () => {
            // 触发下一个任务
            processNextAction();
          });
        }
      });
    });
  });
}

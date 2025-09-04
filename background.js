// background.js
// 存储 AI 平台的 URL 映射，方便管理
const platformUrls = {
  yuanbao: 'https://yuanbao.tencent.com/chat/',
  gemini: 'https://gemini.google.com/app',
  claude: 'https://claude.ai/new' // 新增 Claude.ai 支持
};

// 监听来自 popup 的任务请求 队列分发函数 分发到具体的函数 
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processTaskQueue") {
    // 收到任务队列，保存并开始处理第一个任务
    chrome.storage.local.set({ actionsQueue: request.queue }, () => {
      processNextAction();
    });
    sendResponse({ status: "processing_started" });
  } else if (request.action === "executeFunctionScript") {
    // 新增逻辑：处理脚本执行请求
    executeFunctionScript(request.file, sendResponse);
    return true; // 异步响应
  }
  return true; // 异步响应
});

// 处理队列中的下一个任务
function processNextAction() {
  chrome.storage.local.get('actionsQueue', (result) => {
    const queue = result.actionsQueue || [];
    
    // 如果队列为空，则任务完成
    if (queue.length === 0) {
      console.log("任务队列已空，处理完成。");
      return;
    }

    const currentAction = queue[0];
    const targetUrl = platformUrls[currentAction.platform];

    if (!targetUrl) {
      console.error(`不支持的平台: ${currentAction.platform}`);
      completeTask(currentAction);
      return;
    }

    // 查询所有标签页，寻找目标平台的标签页
    chrome.tabs.query({}, (tabs) => {
      const targetTab = tabs.find(tab => tab.url && isMatchingPlatform(tab.url, currentAction.platform));

      if (targetTab) {
        // 如果找到目标标签页，直接激活并注入脚本，不重新加载！
        console.log(`找到已存在标签页 (${targetTab.id})，正在激活并注入脚本。`);
        chrome.tabs.update(targetTab.id, { active: true }, () => {
          // 确保标签页被激活后再注入，避免竞态条件
          executeScriptForPlatform(targetTab.id, currentAction);
        });
      } else {
        // 未找到，创建新标签页并等待其加载完成
        console.log(`未找到 ${currentAction.platform} 的标签页，正在创建新标签页。`);
        chrome.tabs.create({ url: targetUrl, active: true });
      }
    });
  });
}

/**
 * 判断 URL 是否匹配指定平台
 * @param {string} url - 标签页 URL
 * @param {string} platform - 平台名称
 * @returns {boolean}
 */
function isMatchingPlatform(url, platform) {
  switch (platform) {
    case 'yuanbao':
      return url.includes('yuanbao.tencent.com');
    case 'gemini':
      return url.includes('gemini.google.com');
    case 'claude':
      return url.includes('claude.ai');
    default:
      return false;
  }
}

// 监听全部的事件 通过容器进行调度
// 监听标签页更新，仅在新标签页加载完成后执行脚本
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 标签页加载完成的检查
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get('actionsQueue', (result) => {
      const queue = result.actionsQueue || [];
      if (queue.length === 0) return;
      
      const currentAction = queue[0];
      
      // 检查加载完成的页面是否是当前任务的目标平台 
      if (isMatchingPlatform(tab.url, currentAction.platform)) {
        console.log(`新标签页 ${tabId} 加载完成，准备执行脚本。`);
        // 对于 Claude.ai，可能需要额外的加载时间
        const delay = currentAction.platform === 'claude' ? 2000 : 500;
        setTimeout(() => {
          executeScriptForPlatform(tabId, currentAction);
        }, delay);
      }
    });
  }
});

// 具体调用执行的脚本
function executeScriptForPlatform(tabId, action) {
  const scriptFile = `contentScripts/${action.platform}.js`;

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [scriptFile]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("脚本注入失败:", chrome.runtime.lastError.message);
      // 任务失败，移除并处理下一个
      completeTask(action);
      return;
    }

    console.log(`成功注入 ${action.platform} 脚本`);

    // 脚本注入后，向其发送消息
    chrome.tabs.sendMessage(tabId, {
      action: "sendMessage",
      message: action.message
    }, (response) => {
      if (chrome.runtime.lastError || !response || response.status === 'failed') {
        console.error(`向 ${action.platform} 发送消息时出错:`, chrome.runtime.lastError?.message || "无响应或失败");
      } else {
        console.log(`成功向 ${action.platform} 发送消息。`);
      }
      
      // 任务完成，移除并处理下一个
      completeTask(action);
    });
  });
}

// 辅助函数：任务完成后从队列中移除
function completeTask(action) {
  chrome.storage.local.get('actionsQueue', (result) => {
    let queue = result.actionsQueue || [];
    // 确保移除的是当前任务，防止竞态条件
    if (queue.length > 0 && queue[0].platform === action.platform) {
      queue.shift(); 
      chrome.storage.local.set({ actionsQueue: queue }, () => {
        console.log(`${action.platform} 任务完成，处理下一个任务`);
        // 触发下一个任务
        processNextAction();
      });
    }
  });
}

// 新增函数：执行指定目录下的脚本
function executeFunctionScript(scriptFile, sendResponse) {
  // 获取当前活跃的标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      sendResponse({ status: 'failed', message: '未找到活跃的标签页。' });
      return;
    }

    const tabId = tabs[0].id;

    // 注入脚本
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [`funcs/${scriptFile}`] // 注入 funcs 目录下的脚本
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("脚本注入失败:", chrome.runtime.lastError.message);
        sendResponse({ status: 'failed', message: chrome.runtime.lastError.message });
        return;
      }
      
      // 脚本注入后，执行其 main() 函数
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // 在被注入的页面环境中调用 main() 函数
          if (typeof main === 'function') {
            main();
            return { status: 'success' };
          }
          return { status: 'failed', message: '未找到 main() 函数。' };
        }
      }, (results) => {
        if (chrome.runtime.lastError || !results || results[0].result.status === 'failed') {
          console.error("main() 函数执行失败:", chrome.runtime.lastError?.message || results[0].result.message);
          sendResponse({ status: 'failed', message: chrome.runtime.lastError?.message || results[0].result.message });
        } else {
          console.log(`成功执行 ${scriptFile} 中的 main() 函数。`);
          sendResponse({ status: 'success' });
        }
      });
    });
  });
}
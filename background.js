// background.js
// 存储 AI 平台的 URL 映射，方便管理
// background.js
const platformUrls = {
  yuanbao: 'https://yuanbao.tencent.com/chat/',
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com'  ,
  claude: 'https://claude.ai'   
};

// 监听来自 popup 的任务请求 队列分发函数 分发到具体的函数 牺牲类型string 获得任意的api上层快速兼容 
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processTaskQueue") {
    // 收到任务队列，保存并开始处理第一个任务
    chrome.storage.local.set({ actionsQueue: request.queue }, () => {
      processNextAction();
    });
    sendResponse({ status: "processing_started" });
  }else if (request.action === "executeFunctionScript") {
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

    // 查询所有标签页，寻找目标平台的标签页
    chrome.tabs.query({}, (tabs) => {
      const targetTab = tabs.find(tab => tab.url && tab.url.includes(targetUrl));

      if (targetTab) {
        // 如果找到目标标签页，直接激活并注入脚本，不重新加载！
        console.log(`找到已存在标签页 (${targetTab.id})，正在激活并注入脚本。`);
        chrome.tabs.update(targetTab.id, { active: true }, () => {
          // 确保标签页被激活后再注入，避免竞态条件
          executeScriptForPlatform(targetTab.id, currentAction);
        });
      } else {
        // ======20250821-[Comment]-0604 进行页面的加载 Load+队列的形式 实现消费
        // 未找到，创建新标签页并等待其加载完成
        console.log(`未找到 ${currentAction.platform} 的标签页，正在创建新标签页。`);
        chrome.tabs.create({ url: targetUrl, active: true });
      }
    });
  });
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
      const targetUrl = platformUrls[currentAction.platform];
      
      // 检查加载完成的页面是否是当前任务的目标平台 
      // ======20250820-[Comment]-0598  检查队列  通过监听对象的api 模拟出主动出发 自动检查消息容器  过滤性质的容器监听实现  打开一个标签页就会进行触发 
      // 所有对象的方法触发都会进行监听器事件的调用 自己领取需要消费的队列
      if (tab.url.includes(targetUrl)) {
        console.log(`新标签页 ${tabId} 加载完成，准备执行脚本。`);
        executeScriptForPlatform(tabId, currentAction);
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

    // 脚本注入后，向其发送消息

    // ======20250820-[Comment]-0599 脚本注入 通过方法名执行指定的函数名 发出对应的消息 发出对应的消息 tabs对象进行发送和消费
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
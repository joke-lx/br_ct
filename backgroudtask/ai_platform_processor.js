// ai_platform_processor.js

// 存储 AI 平台的 URL 映射，并导出
export const platformUrls = {
  yuanbao: 'https://yuanbao.tencent.com/chat/',
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai',
  doubao: 'https://www.doubao.com/chat/'
};

/**
 * 辅助函数：任务完成后从队列中移除并启动下一个任务
 * @param {object} action 完成的任务对象
 */
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

/**
 * 具体调用执行的脚本（AI 平台任务）
 * @param {number} tabId 目标标签页ID
 * @param {object} action 当前任务对象
 */
function executeScriptForPlatform(tabId, action) {
  const scriptFile = `contentScripts/${action.platform}.js`;

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [scriptFile]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("AI 脚本注入失败:", chrome.runtime.lastError.message);
      completeTask(action);
      return;
    }

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


/**
 * 导出函数：处理队列中的下一个任务
 */
export function processNextAction() {
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
        // 找到目标标签页，直接激活并注入脚本
        console.log(`找到已存在标签页 (${targetTab.id})，正在激活并注入脚本。`);
        chrome.tabs.update(targetTab.id, { active: true }, () => {
          executeScriptForPlatform(targetTab.id, currentAction);
        });
      } else {
        // 未找到，创建新标签页
        console.log(`未找到 ${currentAction.platform} 的标签页，正在创建新标签页。`);
        chrome.tabs.create({ url: targetUrl, active: true });
      }
    });
  });
}

/**
 * 导出函数：监听标签页更新（用于新创建的 AI 平台标签页）
 */
export function setupTabUpdateListener() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      chrome.storage.local.get('actionsQueue', (result) => {
        const queue = result.actionsQueue || [];
        if (queue.length === 0) return;

        const currentAction = queue[0];
        const targetUrl = platformUrls[currentAction.platform];

        // 检查加载完成的页面是否是当前任务的目标平台
        if (tab.url.includes(targetUrl)) {
          console.log(`新标签页 ${tabId} 加载完成，准备执行脚本。`);
          executeScriptForPlatform(tabId, currentAction);
        }
      });
    }
  });
}
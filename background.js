// background.js
// 使用 ES Modules 导入功能
import { processNextAction, setupTabUpdateListener } from './backgroudtask/ai_platform_processor.js';
import { executeFunctionScript , setupFuncCommandListener } from './backgroudtask/func_executor.js';
import { setTabTransListener } from './backgroudtask/tranTarget.js';

// 初始化标签页更新监听器，用于处理 AI 平台任务的加载完成事件
setupTabUpdateListener();
setupFuncCommandListener();
setTabTransListener();

// 监听来自 popup 的任务请求 
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processTaskQueue") {
    // 收到任务队列，保存并开始处理第一个任务 (AI 平台逻辑)
    chrome.storage.local.set({ actionsQueue: request.queue }, () => {
      processNextAction();
    });
    sendResponse({ status: "processing_started" });
    return true; // 异步响应
  } else if (request.action === "executeFunctionScript") {
    // 处理通用脚本执行请求，调用导入的模块函数
    executeFunctionScript(request.file, sendResponse);
    return true; // 异步响应
  }

  // 其他消息
  return true; 
});

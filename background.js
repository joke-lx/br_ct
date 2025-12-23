// background.js
// 使用 ES Modules 导入功能
import {
    processNextAction,
    setupTabUpdateListener,
    closeAllAITabs,
    processTaskQueueConcurrent  // 新增：导入并发处理函数
} from './backgroudtask/ai_platform_processor.js';
import { executeFunctionScript, setupFuncCommandListener } from './backgroudtask/func_executor.js';
import { setTabTransListener } from './backgroudtask/gotoServer.js';
import { startServer } from './backgroudtask/word_http_server.js';

// 初始化标签页更新监听器
setupTabUpdateListener();
setupFuncCommandListener();
setTabTransListener();
startServer();

// 监听来自 popup 的任务请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processTaskQueue") {
        // 新增：使用并发处理模式
        const config = request.config || {
            maxConcurrent: 3,      // 默认最多同时处理3个平台
            batchDelay: 300,       // 批次间延迟300ms
            tabLoadTimeout: 8000,  // 页面加载超时8秒
            scriptTimeout: 5000    // 脚本执行超时5秒
        };

        // 并发处理任务队列
        processTaskQueueConcurrent(request.queue, config)
            .then(results => {
                const success = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;

                console.log(`任务处理完成: 成功 ${success}, 失败 ${failed}`);

                sendResponse({
                    status: "completed",
                    total: results.length,
                    success: success,
                    failed: failed,
                    results: results
                });
            })
            .catch(error => {
                console.error("处理任务队列失败:", error);
                sendResponse({
                    status: "error",
                    error: error.message
                });
            });

        return true; // 保持消息通道开启，等待异步响应

    } else if (request.action === "executeFunctionScript") {
        // 处理通用脚本执行请求
        executeFunctionScript(request.file, sendResponse);
        return true;

    } else if (request.action === "closeAllAITabs") {
        // 处理关闭所有AI标签页的请求
        closeAllAITabs();
        sendResponse({ status: "closing_tabs" });
        return true;
    }

    return false;
});
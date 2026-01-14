// ai_platform_processor.js

// 导入统一平台配置
import { getPlatformUrls } from '../config/platformConfig.js';

// 存储 AI 平台的 URL 映射，并导出
export const platformUrls = getPlatformUrls();

// ==================== 原有的串行处理逻辑（保持不变） ====================

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
 * 导出函数：处理队列中的下一个任务（串行）
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
                console.log(`找到已存在标签页 (${targetTab.id})，正在激活并注入脚本。`);
                chrome.tabs.update(targetTab.id, { active: true }, () => {
                    executeScriptForPlatform(targetTab.id, currentAction);
                });
            } else {
                console.log(`未找到 ${currentAction.platform} 的标签页，正在创建新标签页。`);
                chrome.tabs.create({ url: targetUrl, active: true });
            }
        });
    });
}

/**
 * 导出函数：设置消息监听器（处理 AI 平台相关的消息）
 */
export function setupMessageListener() {
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
    } else if (request.action === "closeAllAITabs") {
      // 处理关闭所有AI标签页的请求
      closeAllAITabs();
      sendResponse({ status: "closing_tabs" });
      return true;
    }
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

// ==================== 新增：并发处理逻辑 ====================

/**
 * 并发处理任务队列（推荐）
 * @param {Array} queue 任务队列
 * @param {Object} options 配置选项
 * @returns {Promise<Array>} 处理结果数组
 */
export async function processTaskQueueConcurrent(queue, options = {}) {
    const {
        maxConcurrent = 3,      // 最大并发数
        batchDelay = 300,       // 批次间延迟（ms）
        tabLoadTimeout = 8000,  // 标签页加载超时（ms）
        scriptTimeout = 5000    // 脚本执行超时（ms）
    } = options;

    console.log(`开始并发处理 ${queue.length} 个任务，最大并发数: ${maxConcurrent}`);

    const results = [];

    // 分批处理
    for (let i = 0; i < queue.length; i += maxConcurrent) {
        const batch = queue.slice(i, i + maxConcurrent);
        const batchNum = Math.floor(i / maxConcurrent) + 1;

        console.log(`处理批次 ${batchNum}:`, batch.map(t => t.platform).join(', '));

        // 并发执行当前批次
        const batchResults = await Promise.allSettled(
            batch.map((task, index) => {
                // 判断标准：是整个队列的第 0 个元素 (i 是当前批次的起始索引)
                const isFirstTask = (i === 0 && index === 0);
                return processSingleTaskConcurrent(task, {
                    tabLoadTimeout,
                    scriptTimeout,
                    active: isFirstTask // 只有第一个任务传 true
                });
            })
        );

        results.push(...batchResults);

        // 记录批次结果
        const succeeded = batchResults.filter(r => r.status === 'fulfilled').length;
        const failed = batchResults.filter(r => r.status === 'rejected').length;
        console.log(`批次 ${batchNum} 完成: 成功 ${succeeded}, 失败 ${failed}`);

        // 批次间延迟（避免浏览器过载）
        if (i + maxConcurrent < queue.length) {
            await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
    }

    // 统计总体结果
    const totalSuccess = results.filter(r => r.status === 'fulfilled').length;
    const totalFailed = results.filter(r => r.status === 'rejected').length;
    console.log(`所有任务完成: 成功 ${totalSuccess}, 失败 ${totalFailed}`);

    return results;
}

/**
 * 处理单个任务（并发版本）
 * @param {Object} task 任务对象 {platform, message}
 * @param {Object} options 配置选项
 * @returns {Promise<Object>} 处理结果
 */
async function processSingleTaskConcurrent(task, options = {}) {
    const { platform, message } = task;
    const { tabLoadTimeout = 8000, scriptTimeout = 5000, active = false } = options;

    try {
        console.log(`[${platform}] 开始处理任务`);

        // 1. 查找或创建标签页
        const tab = await findOrCreatePlatformTab(platform,active);
        console.log(`[${platform}] 使用标签页 ID: ${tab.id}`);

        // 2. 等待页面加载完成
        await waitForTabComplete(tab.id, tabLoadTimeout);
        console.log(`[${platform}] 页面加载完成`);

        // 3. 注入并执行脚本
        await injectAndExecuteScript(tab.id, platform, message, scriptTimeout);
        console.log(`[${platform}] 任务完成`);

        return {
            platform,
            success: true,
            tabId: tab.id
        };

    } catch (error) {
        console.error(`[${platform}] 任务失败:`, error.message);
        throw new Error(`${platform}: ${error.message}`);
    }
}

/**
 * 查找或创建平台标签页
 * @param {string} platform 平台名称
 * @returns {Promise<Object>} 标签页对象
 */
async function findOrCreatePlatformTab(platform,shouldActive = false) {
    const targetUrl = platformUrls[platform];

    if (!targetUrl) {
        throw new Error(`未知平台: ${platform}`);
    }

    // 查找已存在的标签页
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(tab => tab.url && tab.url.includes(targetUrl));

    if (existingTab) {
        console.log(`[${platform}] 找到已存在的标签页: ${existingTab.id}`);
        // 如果需要激活已存在的标签页
        if (shouldActive) {
            await chrome.tabs.update(existingTab.id, { active: true });
        }
        // 不激活，后台处理
        return existingTab;
    }

    // 创建新标签页（后台）
    console.log(`[${platform}] 创建新标签页`);
    const newTab = await chrome.tabs.create({
        url: targetUrl,
        active: shouldActive  // 后台打开
    });

    return newTab;
}

/**
 * 等待标签页加载完成
 * @param {number} tabId 标签页ID
 * @param {number} timeout 超时时间（ms）
 * @returns {Promise<void>}
 */
function waitForTabComplete(tabId, timeout = 8000) {
    return new Promise((resolve, reject) => {
        let timer;

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
        };

        timer = setTimeout(() => {
            cleanup();
            reject(new Error('标签页加载超时'));
        }, timeout);

        function listener(id, changeInfo, tab) {
            if (id === tabId && changeInfo.status === 'complete') {
                cleanup();
                // 额外等待，确保页面 JS 初始化完成
                setTimeout(() => resolve(), 800);
            }
        }

        chrome.tabs.onUpdated.addListener(listener);

        // 检查当前状态（可能已经加载完成）
        chrome.tabs.get(tabId, (tab) => {
            if (tab.status === 'complete') {
                cleanup();
                setTimeout(() => resolve(), 800);
            }
        });
    });
}

/**
 * 注入并执行脚本
 * @param {number} tabId 标签页ID
 * @param {string} platform 平台名称
 * @param {string} message 消息内容
 * @param {number} timeout 超时时间（ms）
 * @returns {Promise<void>}
 */
function injectAndExecuteScript(tabId, platform, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const scriptFile = `contentScripts/${platform}.js`;
        let timer;

        timer = setTimeout(() => {
            reject(new Error('脚本执行超时'));
        }, timeout);

        // 1. 注入脚本文件
        chrome.scripting.executeScript({
            target: { tabId },
            files: [scriptFile]
        }, () => {
            if (chrome.runtime.lastError) {
                clearTimeout(timer);
                reject(new Error(`脚本注入失败: ${chrome.runtime.lastError.message}`));
                return;
            }

            // 2. 发送消息到 content script
            chrome.tabs.sendMessage(tabId, {
                action: "sendMessage",
                message: message
            }, (response) => {
                clearTimeout(timer);

                if (chrome.runtime.lastError) {
                    reject(new Error(`消息发送失败: ${chrome.runtime.lastError.message}`));
                    return;
                }

                if (!response || response.status === 'failed') {
                    reject(new Error('Content script 执行失败或无响应'));
                    return;
                }

                resolve();
            });
        });
    });
}

// ==================== 工具函数 ====================

/**
 * 导出函数：关闭所有AI平台的标签页
 */
export function closeAllAITabs() {
    chrome.tabs.query({}, (tabs) => {
        const tabsToClose = [];

        // 遍历所有标签页，找到AI平台的标签页
        tabs.forEach(tab => {
            const tabUrl = tab.url;
            if (tabUrl) {
                // 检查是否匹配任何AI平台URL
                for (const platform in platformUrls) {
                    if (tabUrl.includes(platformUrls[platform])) {
                        tabsToClose.push(tab.id);
                        break;
                    }
                }
            }
        });

        if (tabsToClose.length > 0) {
            console.log(`找到 ${tabsToClose.length} 个AI平台标签页，准备关闭`);
            chrome.tabs.remove(tabsToClose, () => {
                if (chrome.runtime.lastError) {
                    console.error("关闭标签页时出错:", chrome.runtime.lastError.message);
                } else {
                    console.log("成功关闭所有AI平台标签页");
                }
            });
        } else {
            console.log("未找到AI平台标签页");
        }
    });
}
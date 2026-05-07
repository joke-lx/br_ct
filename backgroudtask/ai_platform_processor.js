// ai_platform_processor.js
// 架构：
// 1. setupTabUpdateListener —— 监听所有 AI 平台 Tab 加载，自动注入脚本
// 2. processTaskQueueConcurrent —— 任务触发时，复用已注入 Tab 或新建 Tab，再发消息

import { getPlatformUrls } from '../config/platformConfig.js';

export const platformUrls = getPlatformUrls();

// ==================== Tab 注入记录 ====================
// platform -> Set<tabId>
// 以 platform 为 key，查询"该平台已在哪些 Tab 注入"更直接

const injectedTabs = new Map(); // platform -> Set<tabId>

function markInjected(tabId, platform) {
  if (!injectedTabs.has(platform)) {
    injectedTabs.set(platform, new Set());
  }
  injectedTabs.get(platform).add(tabId);

  // Tab 关闭时清理记录
  chrome.tabs.onRemoved.addListener(function closedListener(removedTabId) {
    if (removedTabId === tabId) {
      removeTab(tabId);
      chrome.tabs.onRemoved.removeListener(closedListener);
    }
  });
}

function removeTab(tabId) {
  for (const tabSet of injectedTabs.values()) {
    tabSet.delete(tabId);
  }
}

function hasInjected(platform) {
  return injectedTabs.has(platform) && injectedTabs.get(platform).size > 0;
}

// 获得该平台已注入的任意一个有效 Tab
function getInjectedTab(platform) {
  if (!hasInjected(platform)) return null;
  const tabIds = [...injectedTabs.get(platform)];
  return tabIds[0] || null;
}

// 从 URL 反查 platform key
function getPlatformFromUrl(url) {
  for (const [platform, platformUrl] of Object.entries(platformUrls)) {
    if (url.includes(platformUrl)) {
      return platform;
    }
  }
  return null;
}

// ==================== 注入 + 发消息 ====================

/**
 * 注入平台脚本到指定 Tab（幂等）
 */
function injectScript(tabId, platform) {
  return new Promise((resolve, reject) => {
    const scriptFile = `contentScripts/${platform}.js`;
    chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      markInjected(tabId, platform);
      resolve();
    });
  });
}

/**
 * 向 Tab 发消息
 */
function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: "sendMessage", message }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || response.status === 'failed') {
        reject(new Error('Content script 执行失败'));
        return;
      }
      resolve(response);
    });
  });
}

// ==================== 核心：Tab 加载自动注入 ====================

/**
 * 监听所有 AI 平台 Tab 加载，自动注入
 * 处理用户自己打开 Tab 的场景
 */
export function setupTabUpdateListener() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    const platform = getPlatformFromUrl(tab.url);
    if (!platform) return;

    if (hasInjected(platform)) {
      console.log(`[${platform}] Tab ${tabId} 已注入，跳过`);
      return;
    }

    console.log(`[${platform}] Tab ${tabId} 加载完成，开始注入`);
    injectScript(tabId, platform)
      .then(() => console.log(`[${platform}] 注入成功`))
      .catch(err => console.error(`[${platform}] 注入失败:`, err.message));
  });
}

// ==================== 消息发送 ====================

export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processTaskQueue") {
      const config = request.config || {
        maxConcurrent: 3,
        batchDelay: 300,
        tabLoadTimeout: 8000,
      };

      processTaskQueueConcurrent(request.queue, config)
        .then(results => {
          const success = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          sendResponse({ status: "completed", total: results.length, success, failed, results });
        })
        .catch(error => {
          sendResponse({ status: "error", error: error.message });
        });
      return true;

    } else if (request.action === "closeAllAITabs") {
      closeAllAITabs();
      sendResponse({ status: "closing_tabs" });
      return true;
    }
  });
}

export async function processTaskQueueConcurrent(queue, options = {}) {
  const { maxConcurrent = 3, batchDelay = 300 } = options;
  const results = [];

  for (let i = 0; i < queue.length; i += maxConcurrent) {
    const batch = queue.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map((task, index) => processSingleTask(task, i === 0 && index === 0))
    );
    results.push(...batchResults);

    if (i + maxConcurrent < queue.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  return results;
}

async function processSingleTask(task, isFirst = false) {
  const { platform, message } = task;

  // 查找或创建 Tab（复用已注入的 Tab）
  const tab = await findOrCreatePlatformTab(platform, isFirst);

  // 等待加载完成
  await waitForTabComplete(tab.id);

  // 发消息
  await sendMessage(tab.id, message);

  return { platform, success: true, tabId: tab.id };
}

/**
 * 查找或创建平台 Tab
 * 优先复用已注入的 Tab，其次查找已有 Tab，最后创建新 Tab
 */
async function findOrCreatePlatformTab(platform, isFirst = false) {
  const targetUrl = platformUrls[platform];
  if (!targetUrl) throw new Error(`未知平台: ${platform}`);

  // 1. 优先复用已注入的 Tab
  const injectedTabId = getInjectedTab(platform);
  if (injectedTabId !== null) {
    try {
      const tab = await chrome.tabs.get(injectedTabId);
      return tab;
    } catch (e) {
      // Tab 已失效，removeTab 会在 onRemoved 里清理
    }
  }

  // 2. 查找已存在的匹配 Tab
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(tab => tab.url && tab.url.includes(targetUrl));
  if (existing) return existing;

  // 3. 创建新 Tab（第一个任务激活让用户看到跳转）
  return chrome.tabs.create({ url: targetUrl, active: isFirst });
}

function waitForTabComplete(tabId, timeout = 20000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    };
    const listener = (id, changeInfo, tab) => {
      if (id === tabId && changeInfo.status === 'complete') {
        cleanup();
        setTimeout(resolve, 800);
      }
    };
    timer = setTimeout(() => { cleanup(); reject(new Error('加载超时')); }, timeout);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, tab => {
      if (tab?.status === 'complete') { cleanup(); setTimeout(resolve, 800); }
    });
  });
}

// ==================== 工具函数 ====================

export function closeAllAITabs() {
  chrome.tabs.query({}, tabs => {
    const toClose = tabs
      .filter(tab => getPlatformFromUrl(tab.url))
      .map(tab => tab.id);
    if (toClose.length) {
      chrome.tabs.remove(toClose);
      toClose.forEach(id => removeTab(id));
    }
  });
}

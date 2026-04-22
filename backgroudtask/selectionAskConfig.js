/**
 * 划词快捷提问配置模块
 * 提供平台域名映射和设置管理
 */

import { PLATFORM_CONFIG } from '../config/platformConfig.js';

/**
 * 构建域名→平台映射
 */
export function getPlatformDomains() {
  const domains = {};
  Object.entries(PLATFORM_CONFIG).forEach(([platformId, config]) => {
    try {
      const url = new URL(config.url);
      // 使用域名匹配（去掉www.前缀）
      const domain = url.hostname.replace(/^www\./, '');
      domains[domain] = platformId;
    } catch (e) {
      console.warn(`[SelectionAskConfig] 无效的平台URL: ${config.url}`);
    }
  });
  return domains;
}

/**
 * 获取划词快捷提问设置
 */
export function getSelectionAskSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['selectionAskSettings'], (result) => {
      const settings = result.selectionAskSettings || { enabled: true };
      resolve(settings);
    });
  });
}

/**
 * 保存划词快捷提问设置
 */
export function saveSelectionAskSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ selectionAskSettings: settings }, resolve);
  });
}

/**
 * 初始化划词快捷提问配置监听
 */
export function initSelectionAskConfig() {
  // 处理来自 content script 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPlatformDomains') {
      sendResponse({ domains: getPlatformDomains() });
      return true;
    }

    if (request.action === 'getSelectionAskSettings') {
      getSelectionAskSettings().then((settings) => {
        sendResponse({ settings });
      });
      return true;
    }

    if (request.action === 'selectionAskSettingsUpdated') {
      saveSelectionAskSettings(request.settings);
      sendResponse({ success: true });
      return true;
    }
  });

  console.log('[SelectionAskConfig] 划词快捷提问配置初始化完成');
}

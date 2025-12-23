// platformVisibility.js - 平台可见性管理模块

import { loadData, savePlatformVisibilitySettings } from './storage.js';

/**
 * 加载并应用平台可见性设置
 */
export async function loadPlatformVisibilitySettings() {
  try {
    const result = await loadData('platformVisibilitySettings');
    const visibilitySettings = result.platformVisibilitySettings || {};

    // 获取所有平台选项
    const platformOptions = document.querySelectorAll('.platform-icon-option');

    platformOptions.forEach(option => {
      const platformId = option.getAttribute('data-platform-id');
      if (platformId) {
        // 如果设置了可见性为false，则隐藏该平台
        if (visibilitySettings.hasOwnProperty(platformId) && !visibilitySettings[platformId]) {
          option.style.display = 'none';
        } else {
          option.style.display = '';
        }
      }
    });

    return visibilitySettings;
  } catch (error) {
    console.error('加载平台可见性设置失败:', error);
    return {};
  }
}

/**
 * 应用平台可见性设置（当设置更新时调用）
 */
export function applyPlatformVisibilitySettings(settings) {
  const platformOptions = document.querySelectorAll('.platform-icon-option');

  platformOptions.forEach(option => {
    const platformId = option.getAttribute('data-platform-id');
    if (platformId) {
      // 如果设置了可见性为false，则隐藏该平台
      if (settings.hasOwnProperty(platformId) && !settings[platformId]) {
        option.style.display = 'none';
      } else {
        option.style.display = '';
      }
    }
  });
}

/**
 * 获取可见的平台复选框
 */
export function getVisiblePlatformCheckboxes(allCheckboxes) {
  return Array.from(allCheckboxes).filter((checkbox) => {
    const option = checkbox.closest('.platform-icon-option');
    return option && option.style.display !== 'none';
  });
}

/**
 * 检查是否所有可见平台都已选中
 */
export function areAllVisiblePlatformsChecked(visibleCheckboxes) {
  if (visibleCheckboxes.length === 0) {
    return false;
  }
  return visibleCheckboxes.every((checkbox) => checkbox.checked);
}

/**
 * 设置平台可见性并保存
 */
export async function setPlatformVisibility(platformId, isVisible) {
  try {
    const currentSettings = await loadData('platformVisibilitySettings');
    const visibilitySettings = currentSettings.platformVisibilitySettings || {};

    visibilitySettings[platformId] = isVisible;

    await savePlatformVisibilitySettings(visibilitySettings);
    return visibilitySettings;
  } catch (error) {
    console.error('设置平台可见性失败:', error);
    throw error;
  }
}

/**
 * 监听平台可见性更新消息
 */
export function setupPlatformVisibilityMessageListener(callback) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'platformVisibilityUpdated') {
      applyPlatformVisibilitySettings(request.settings);
      if (callback) {
        callback(request.settings);
      }
    }
  });
}
/**
 * Translation Module - Background Service Worker
 * 负责初始化和启动翻译/OCR功能的所有子模块
 */

import { setupContextMenu } from './contextMenu.js';
import { setupMessageHandler } from './messageHandler.js';
import { setupStorage } from './storage.js';
import { setupOCR } from './ocr.js';
import { initSelectionAskConfig } from './selectionAskConfig.js';

/**
 * 初始化所有翻译模块
 */
export function setupTranslationModule() {
  console.log('[Translation Module] 初始化翻译模块...');

  // 按顺序初始化各个模块
  setupStorage();
  setupContextMenu();
  setupMessageHandler();
  setupOCR();
  initSelectionAskConfig();

  console.log('[Translation Module] 所有翻译模块已启动');
}

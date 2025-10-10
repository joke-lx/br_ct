// popup.js
import {
  HISTORY_KEY,
  OPTIMIZER_KEY,
  initializePopup,
  setupEventListeners,
  loadStoredData,
  startSending
} from './popupUtils.js';

document.addEventListener('DOMContentLoaded', function () {
  // 初始化弹窗
  initializePopup();
  
  // 加载存储的数据
  loadStoredData();
  
  // 设置所有事件监听器
  setupEventListeners();
});

// popup.js
import {
  initializePopup,
  setupEventListeners,
  loadStoredData,
} from "./popupUtils.js";
import { setupDragDropEvents } from "./dragDropHandler.js";

document.addEventListener("DOMContentLoaded", async function () {
  try {
    // 初始化弹窗
    await initializePopup();

    // 加载存储的数据
    await loadStoredData();

    // 设置所有事件监听器
    setupEventListeners();

    // 初始化指定输入框的拖放事件
    setupDragDropEvents();
  } catch (error) {
    console.error("初始化popup失败:", error);
  }
});

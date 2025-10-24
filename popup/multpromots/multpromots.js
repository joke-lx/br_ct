// popup.js
import {
  initializePopup,
  setupEventListeners,
  loadStoredData,
} from "./multpopupUtils.js";
import { setupDragDropEvents } from "../popup/dragDropHandler.js";

document.addEventListener("DOMContentLoaded", function () {
  // 初始化弹窗
  initializePopup();

  // 加载存储的数据
  loadStoredData();

  // 设置所有事件监听器
  setupEventListeners();

  // 初始化指定输入框的拖放事件
  setupDragDropEvents();
});

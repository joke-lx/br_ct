// main.js - sidebar入口
import {
  initializePopup,
  setupEventListeners,
  loadStoredData,
} from "./mainUtils.js";
import { setupDragDropEvents } from "../../popup/main/dragDropHandler.js";
import { initializePlatformOptions } from "../../popup/main/platformRenderer.js";

document.addEventListener("DOMContentLoaded", async function () {
  try {
    initializePlatformOptions();
    await initializePopup();
    await loadStoredData();
    setupEventListeners();
    setupDragDropEvents();
  } catch (error) {
    console.error("初始化popup失败:", error);
  }
});

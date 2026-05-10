import {
  initializePopup,
  setupEventListeners,
  loadStoredData,
  initializeResponseDisplay,
} from "./mainUtils.js";
import { setupDragDropEvents } from "../../popup/main/dragDropHandler.js";
import { initializePlatformOptions } from "../../popup/main/platformRenderer.js";

document.addEventListener("DOMContentLoaded", async function () {
  try {
    console.log("[Sidebar] DOMContentLoaded");
    initializePlatformOptions();
    await initializePopup();
    console.log("[Sidebar] initializePopup done");
    initializeResponseDisplay();
    console.log("[Sidebar] initializeResponseDisplay done");
    await loadStoredData();
    setupEventListeners();
    setupDragDropEvents();
  } catch (error) {
    console.error("初始化popup失败:", error);
  }
});

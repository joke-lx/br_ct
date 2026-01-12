import { initializePopup, setupEventListeners } from "./multpopupUtils.js";
import { initializeAIOptimizer } from "./aiOptimizer.js";


// 这html 啥东西都可以静态获得 非常不符合程序栈的结构
document.addEventListener("DOMContentLoaded", () => {
  initializePopup();
  setupEventListeners();
  initializeAIOptimizer();
});

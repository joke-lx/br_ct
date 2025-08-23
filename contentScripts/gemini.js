// ==========================================================
//                     Helper Functions
// ==========================================================

// 通过 XPath 获取元素
function getElementByXpath(xpath) {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch (e) {
    console.error(`XPath 表达式无效: ${xpath}`, e);
    return null;
  }
}

// 触发输入元素的完整事件序列
function triggerInputEvents(element) {
  if (!element) {
    console.warn("尝试对空元素触发输入事件。");
    return;
  }
  const inputEvent = new Event('input', {
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(inputEvent);
}

// 更可靠的点击方法
function triggerClick(element) {
  if (!element) {
    console.warn('尝试点击空元素。');
    return false;
  }
  // 检查元素是否可见或可用
  if (element.offsetParent === null || element.disabled) {
    console.warn('元素不可点击或已被禁用。', element);
    return false;
  }
  try {
    element.click();
    return true;
  } catch (e) {
    console.error('点击事件失败:', e);
    return false;
  }
}

// ==========================================================
//                     Element Finders
// ==========================================================

/**
 * 按优先级尝试多个选择器来查找输入框
 */
function findInputElement() {
  const xpaths = [
    // 最佳选择：定位在 rich-textarea 组件内的 p 标签 (最稳定)
    '//rich-textarea/div[1]/p',
    // 备选方案1：通过 ARIA role 属性定位 (非常稳定)
    "//div[@role='textbox'][@contenteditable='true']/p",
    // 备选方案2：通过可能的父容器 class 定位 (比较稳定)
    "//div[contains(@class, 'input-area')]//p[@contenteditable='true']",
    // 最后的备用方案：您的原始 XPath
    '//*[@id="app-root"]/main/side-navigation-v2/mat-sidenav-container/mat-sidenav-content/div/div[2]/chat-window/div/input-container/div/input-area-v2/div/div/div[1]/div/div/rich-textarea/div[1]/p'
  ];

  for (const xpath of xpaths) {
    const element = getElementByXpath(xpath);
    if (element) {
      console.log(`使用 XPath 成功找到输入框: ${xpath}`);
      return element;
    }
  }

  return null;
}

/**
 * 按优先级尝试多个选择器来查找发送按钮
 */
function findSendButton() {
  const xpaths = [
    "//button[@aria-label='Send message']",
    "//button[.//span[contains(text(),'Send')]]",
    "//button[contains(@class, 'send-button')]",
    '//*[@id="app-root"]/main/side-navigation-v2/mat-sidenav-container/mat-sidenav-content/div/div[2]/chat-window/div/input-container/div/input-area-v2/div/div/div[3]/div/div[2]/button'
  ];

  for (const xpath of xpaths) {
    const element = getElementByXpath(xpath);
    if (element) {
      console.log(`使用 XPath 成功找到发送按钮: ${xpath}`);
      return element;
    }
  }

  return null;
}

// ==========================================================
//                     Main Logic
// ==========================================================

// 使用状态锁防止重复点击
let isSending = false;

/**
 * 主函数：输入文本并发送
 * @param {string} message 要发送的文本
 * @returns {boolean} 操作是否成功
 */
function sendChatMessage(message) {
  // 检查状态锁，如果正在发送则直接退出
  if (isSending) {
    console.warn("正在发送消息，请勿重复操作。");
    return false;
  }

  const inputElement = findInputElement();
  if (!inputElement) {
    console.error("未找到输入框元素。");
    return false;
  }

  // 1. 设置状态锁为 true，表示开始发送
  isSending = true;
  console.log("开始发送流程，已锁定发送状态。");

  // 2. 输入文本
  try {
    inputElement.textContent = message;
    triggerInputEvents(inputElement);
    console.log("文本输入成功，已触发输入事件。");
  } catch (e) {
    console.error('输入文本失败:', e);
    isSending = false; // 失败时解锁
    return false;
  }

  // 3. 查找发送按钮
  const buttonElement = findSendButton();
  if (!buttonElement) {
    console.error("未找到发送按钮。");
    isSending = false; // 失败时解锁
    return false;
  }

  // 4. 延时后执行点击，确保输入事件被处理
  setTimeout(() => {
    if (triggerClick(buttonElement)) {
      console.log("消息发送成功！");
    } else {
      console.error("发送失败。");
    }
    // 5. 无论成功与否，发送流程结束，解锁
    isSending = false;
    console.log("发送流程结束，已解锁发送状态。");
  }, 100);

  return true;
}

// ==========================================================
//                     Message Listener
// ==========================================================

// 监听插件消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendMessage") {
    console.log(`收到消息发送请求: "${request.message}"`);
    const success = sendChatMessage(request.message);
    sendResponse({
      status: success ? "success" : "failed"
    });
  }
  // 异步响应时需要返回 true
  return true;
});
// 通过 XPath 获取元素
function getElementByXpath(xpath) {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue;
}

// 触发输入元素的完整事件序列
function triggerInputEvents(element) {
  // 现代浏览器中，直接设置 textContent/value 后
  // 派遣 'input' 事件通常就足够了。
  const inputEvent = new Event('input', {
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(inputEvent);
}

// 更可靠的点击方法
function triggerClick(element) {
  if (!element) return false;
  if (element.offsetParent === null || element.disabled) {
    console.warn('元素不可点击', element);
    return false;
  }
  // 优先使用 element.click()，它在大多数情况下都有效
  element.click();
  return true;
}

/**
 * 优化的函数：按优先级尝试多个选择器来查找输入框
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

  return null; // 如果所有 XPath 都失败了
}


// 主函数：输入文本并发送
function sendChatMessage(message) {
  // 1. 使用优化的逻辑定位输入框
  const inputElement = findInputElement();

  if (!inputElement) {
    console.error("使用所有备选方案后，仍未找到输入框元素。");
    return false;
  }

  // 2. 输入文本
  try {
    // 对于 contenteditable 元素，直接修改 textContent 是最可靠的方式
    inputElement.textContent = message;
    triggerInputEvents(inputElement); // 触发事件以通知框架更新状态
  } catch (e) {
    console.error('输入文本失败:', e);
    return false;
  }

  // 3. 定位并点击发送按钮 (这里的 XPath 也建议优化)
  // 建议优化为: //button[@aria-label='Send message'] 或 //button[contains(@class, 'send-button')]
  const buttonXPath = "//button[.//span[contains(text(),'Send')]] | //button[@aria-label='Send message'] | //button[contains(@class, 'send')]";
  let buttonElement = getElementByXpath(buttonXPath);
  
  if (!buttonElement) {
      // 备用查找发送按钮的逻辑
      const originalButtonXPath = '//*[@id="app-root"]/main/side-navigation-v2/mat-sidenav-container/mat-sidenav-content/div/div[2]/chat-window/div/input-container/div/input-area-v2/div/div/div[3]/div/div[2]/button';
      buttonElement = getElementByXpath(originalButtonXPath);
  }

  if (!buttonElement) {
    console.error("未找到发送按钮");
    return false;
  }
  
  // 4. 延时后执行点击，确保输入事件被处理
  setTimeout(() => {
    if (!triggerClick(buttonElement)) {
      console.error("发送失败");
    }
  }, 100);

  return true;
}

// 监听插件消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendMessage") {
    console.log(`收到消息发送请求: ${request.message}`);
    const success = sendChatMessage(request.message);
    sendResponse({
      status: success ? "success" : "failed"
    });
  }
  return true; // 异步响应时需要返回 true
});
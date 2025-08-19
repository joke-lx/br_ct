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
  const eventTypes = ['input', 'change', 'keydown', 'keypress', 'keyup'];
  eventTypes.forEach(eventType => {
    const event = new Event(eventType, {
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  });
}

// 更可靠的点击方法
function triggerClick(element) {
  if (!element) return false;
  
  // 检查元素是否可见/可点击
  if (element.offsetParent === null || element.disabled) {
    console.warn('元素不可点击', element);
    return false;
  }
  
  // 完整的鼠标事件序列
  const mouseEvents = ['mousedown', 'mouseup', 'click'];
  mouseEvents.forEach(eventType => {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      view: window,
      buttons: 1
    });
    element.dispatchEvent(event);
  });
  
  // 实际执行点击
  element.click();
  return true;
}

// 主函数：输入文本并发送
function sendChatMessage(message) {
  // 1. 定位输入框
  const inputXPath = '//*[@id="app-root"]/main/side-navigation-v2/mat-sidenav-container/mat-sidenav-content/div/div[2]/chat-window/div/input-container/div/input-area-v2/div/div/div[1]/div/div/rich-textarea/div[1]/p';
  const inputElement = getElementByXpath(inputXPath);
  
  if (!inputElement) {
    console.error("未找到输入框元素");
    return false;
  }
  
  // 2. 输入文本
  try {
    if (inputElement.isContentEditable || inputElement.tagName === 'P') {
      inputElement.textContent = message;
      document.execCommand('insertText', false, message);
    } else {
      inputElement.value = message;
    }
    triggerInputEvents(inputElement);
  } catch (e) {
    console.error('输入文本失败:', e);
    return false;
  }
  
  // 3. 定位并点击发送按钮
  const buttonXPath = '//*[@id="app-root"]/main/side-navigation-v2/mat-sidenav-container/mat-sidenav-content/div/div[2]/chat-window/div/input-container/div/input-area-v2/div/div/div[3]/div/div[2]/button/span[3]';
  const buttonElement = getElementByXpath(buttonXPath)?.closest('button') || getElementByXpath(buttonXPath);
  
  if (!buttonElement) {
    console.error("未找到发送按钮");
    return false;
  }
  
  // 4. 执行点击
  setTimeout(() => {
    if (!triggerClick(buttonElement)) {
      console.error("发送失败，尝试备用方案...");
      const parentButton = buttonElement.closest('button');
      if (parentButton && parentButton !== buttonElement) {
        triggerClick(parentButton);
      }
    }
  }, 100);
  
  return true;
}

// 监听插件消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendMessage") {
    console.log(`收到消息发送请求: ${request.message}`);
    sendChatMessage(request.message);
    sendResponse({status: "success"});
  }
});
// 通过 XPath 获取元素（复用函数）
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

// 更可靠的点击方法（支持完整鼠标事件序列）
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
  
  // 2. 输入文本（支持contenteditable元素）
  try {
    if (inputElement.isContentEditable || inputElement.tagName === 'P') {
      inputElement.textContent = message;
      // 富文本可能需要更复杂的处理
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
  
  // 4. 执行点击（带延迟确保内容已处理）
  setTimeout(() => {
    if (!triggerClick(buttonElement)) {
      console.error("发送失败，尝试备用方案...");
      // 备选方案：直接触发父级按钮点击
      const parentButton = buttonElement.closest('button');
      if (parentButton && parentButton !== buttonElement) {
        triggerClick(parentButton);
      }
    }
  }, 100);
  
  return true;
}

// 使用示例
sendChatMessage("在浏览器控制台能否控制多个页面执行方法");

// 可选：自动重试机制（针对动态加载的内容）
function sendWithRetry(message, maxRetries = 3, interval = 500) {
  let attempts = 0;
  
  const trySend = () => {
    attempts++;
    if (sendChatMessage(message)) {
      console.log('消息发送成功');
      return;
    }
    
    if (attempts < maxRetries) {
      console.log(`尝试 ${attempts}/${maxRetries}...`);
      setTimeout(trySend, interval);
    } else {
      console.error('达到最大重试次数，发送失败');
    }
  };
  
  trySend();
}


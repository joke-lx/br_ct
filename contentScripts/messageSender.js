
// 通过 XPath 获取目标输入框元素
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

// 输入内容到目标元素
function inputContentToDialog(content, callback) {
  const targetXPath = '//*[@id="app"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div/div[3]/div/div[4]/div/div/div[2]/div[2]/div/div/div[1]';
  
  const inputElement = getElementByXpath(targetXPath);
  
  if (!inputElement) {
    console.error("无法通过 XPath 找到元素");
    return callback && callback(false);
  }

  // 检查元素类型并处理
  if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
    inputElement.value = content;
    triggerInputEvents(inputElement);
    callback && setTimeout(callback, 50); // 加入短暂延迟
  } else if (inputElement.getAttribute('contenteditable') === 'true') {
    inputElement.innerHTML = '';
    document.execCommand('insertText', false, content);
    callback && setTimeout(callback, 50); // 富文本框需要额外处理时间
  } else {
    console.error('无法识别的输入元素类型');
    callback && callback(false);
  }
}

// 触发必要的事件
function triggerInputEvents(element) {
  const eventTypes = ['input', 'change', 'keydown', 'keyup'];
  eventTypes.forEach(eventType => {
    const event = new Event(eventType, {
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  });
}

// 更可靠的点击发送方法
function clickSendButton() {
  const buttonId = 'yuanbao-send-btn';
  
  // 方法1：优先尝试直接点击
  const sendButton = document.getElementById(buttonId);
  if (sendButton) {
    // 检查按钮状态
    if (sendButton.disabled) {
      console.warn('发送按钮处于禁用状态');
      return false;
    }
    
    // 创建更完整的鼠标事件序列
    const mouseEvents = ['mousedown', 'mouseup', 'click'];
    mouseEvents.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1
      });
      sendButton.dispatchEvent(event);
    });
    return true;
  }
  
  console.error(`未找到ID为 ${buttonId} 的发送按钮`);
  return false;
}

// 主执行函数 (输入+发送)
function sendMessage(content) {
  inputContentToDialog(content, function() {
    // 添加额外延迟确保内容处理完成
    setTimeout(() => {
      if (!clickSendButton()) {
        console.error("消息发送失败，尝试备用方案...");
        // 备选方案：在页面完全加载后重试
        document.addEventListener('DOMContentLoaded', () => clickSendButton());
      }
    }, 100); // 增加100ms延迟确保内容已处理
  });
}

// 监听插件消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendMessage") {
    console.log(`收到消息发送请求: ${request.message}`);
    sendMessage(request.message);
    sendResponse({status: "success"});
  }
});
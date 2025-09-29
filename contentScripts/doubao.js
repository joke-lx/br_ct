// ==========================================================
//                     通用查找器 (支持 CSS + XPath)
// ==========================================================
function findElementBySelectors(selectors) {
  for (const selector of selectors) {
    try {
      let element = null;
      if (selector.type === "css") {
        element = document.querySelector(selector.value);
      } else if (selector.type === "xpath") {
        const result = document.evaluate(
          selector.value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        element = result.singleNodeValue;
      }

      if (element) {
        console.log(`成功找到元素: ${selector.type} -> ${selector.value}`);
        return element;
      }
    } catch (e) {
      console.warn(`选择器无效: ${selector.type} -> ${selector.value}`, e);
    }
  }
  console.warn("所有选择器都未找到元素");
  return null;
}

// 等待元素出现，支持重试机制，默认 3 秒超时
async function waitForElement(selectors, timeout = 3000, retryInterval = 100) {
  const start = Date.now();
  let attemptCount = 0;

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      attemptCount++;
      const element = findElementBySelectors(selectors);

      if (element) {
        clearInterval(timer);
        console.log(`元素在第 ${attemptCount} 次尝试中找到`);
        resolve(element);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        console.warn(`元素查找超时，共尝试 ${attemptCount} 次`);
        resolve(null);
      }
    }, retryInterval);
  });
}

// ==========================================================
//                     输入 & 点击工具
// ==========================================================
function triggerInputEvents(element) {
  if (!element) {
    console.warn("输入元素不存在，无法触发事件");
    return false;
  }

  try {
    const events = [
      new Event("input", { bubbles: true, cancelable: true }),
      new Event("change", { bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
      new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Enter" })
    ];

    events.forEach(event => element.dispatchEvent(event));
    console.log("输入事件触发成功");
    return true;
  } catch (e) {
    console.error("触发输入事件失败", e);
    return false;
  }
}

function triggerClick(element) {
  if (!element) {
    console.warn("点击元素不存在");
    return false;
  }

  if (element.offsetParent === null) {
    console.warn("元素不可见，无法点击", element);
    return false;
  }

  if (element.disabled) {
    console.warn("元素已禁用，无法点击", element);
    return false;
  }

  try {
    element.click();
    console.log("点击成功");
    return true;
  } catch (e) {
    console.warn("普通点击失败，尝试鼠标事件", e);

    try {
      const mouseEvent = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
      element.dispatchEvent(mouseEvent);
      console.log("鼠标事件点击成功");
      return true;
    } catch (e2) {
      console.error("所有点击方式都失败", e2);
      return false;
    }
  }
}

// ==========================================================
//                     Doubao 输入框 & 按钮选择器
// ==========================================================
const inputSelectors = [
  // Doubao textarea
  { type: 'xpath', value: '//*[@id="chat-route-layout"]/div/main/div/div/div[2]/div/div/div[2]/div[2]/div[2]/div[1]/div[2]/div[2]/div[1]/div/textarea' },
  { type: 'css', value: '#chat-route-layout textarea' }
];

const buttonSelectors = [
  // Doubao 发送按钮
  { type: 'xpath', value: '//*[@id="flow-end-msg-send"]' },
  { type: 'css', value: '#flow-end-msg-send' }
];

// ==========================================================
//                     主逻辑
// ==========================================================
let isSending = false; // 状态锁

async function sendChatMessage(message) {
  if (isSending) {
    console.warn("正在发送中，请勿重复操作");
    return false;
  }

  if (!message || typeof message !== 'string' || message.trim() === '') {
    console.error("消息内容无效");
    return false;
  }

  isSending = true;
  console.log("开始发送流程，已锁定发送状态");

  try {
    console.log("正在查找输入框...");
    const inputElement = await waitForElement(inputSelectors, 5000, 100);
    if (!inputElement) {
      console.error("未找到输入框，发送失败");
      return false;
    }

    console.log("开始输入文本内容...");
    inputElement.value = message.trim();
    if (!triggerInputEvents(inputElement)) {
      console.error("触发输入事件失败");
      return false;
    }
    console.log("文本输入完成");

    console.log("正在查找发送按钮...");
    const buttonElement = await waitForElement(buttonSelectors, 5000, 100);
    if (!buttonElement) {
      console.error("未找到发送按钮");
      return false;
    }

    console.log("准备发送消息...");
    await new Promise(resolve => setTimeout(resolve, 150));

    if (triggerClick(buttonElement)) {
      console.log("消息发送成功");
      return true;
    } else {
      console.error("点击发送失败");
      return false;
    }
  } catch (e) {
    console.error("发送流程异常", e);
    return false;
  } finally {
    isSending = false;
    console.log("发送流程结束，已解锁发送状态");
  }
}

// ==========================================================
//                     消息监听 & 环境检查
// ==========================================================
if (!window.location.hostname.includes('doubao')) {
  console.warn('当前页面不是 Doubao，脚本未激活');
} else {
  console.log('Doubao 内容脚本已加载并激活');

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage") {
      console.log(`收到消息发送请求: "${request.message}"`);

      sendChatMessage(request.message).then((success) => {
        sendResponse({
          status: success ? "success" : "failed",
          platform: "doubao",
          timestamp: Date.now()
        });
        console.log(`消息处理完成，状态: ${success ? "success" : "failed"}`);
      }).catch((error) => {
        console.error("消息处理异常", error);
        sendResponse({
          status: "error",
          platform: "doubao",
          error: error.message,
          timestamp: Date.now()
        });
      });

      return true; // 异步响应
    }

    console.warn("收到未知的消息类型", request);
    sendResponse({ status: "unknown_action" });
  });
}

/**
 * @fileoverview
 * Doubao 聊天机器人内容脚本 - 完整版
 * 适配 Doubao 输入框和发送按钮
 * 保留完整错误处理、事件触发、点击备用方案、状态锁及异步消息监听
 */

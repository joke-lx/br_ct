// ==========================================================
//                     通用查找器
// ==========================================================

function findElementByXPaths(xpaths) {
  for (const xpath of xpaths) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const element = result.singleNodeValue;
      if (element) {
        console.log(`成功找到元素: ${xpath}`);
        return element;
      }
    } catch (e) {
      console.warn(`XPath 表达式无效: ${xpath}`, e);
    }
  }
  return null;
}
// ======20250929-[Comment]-0794 resolve(element); 返回对应的结果
// 等待元素出现，默认 3 秒超时
async function waitForElement(xpaths, timeout = 3000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const element = findElementByXPaths(xpaths);
      if (element) {
        clearInterval(timer);
        resolve(element);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        resolve(null);
      }
    }, 100); // 每 100ms 检查一次
  });
}

// ==========================================================
//                     输入 & 点击工具
// ==========================================================

function triggerInputEvents(element) {
  if (!element) return;
  const inputEvent = new Event("input", { bubbles: true, cancelable: true });
  element.dispatchEvent(inputEvent);
}

function triggerClick(element) {
  if (!element || element.offsetParent === null || element.disabled) {
    console.warn("元素不可点击或已禁用", element);
    return false;
  }
  element.click();
  return true;
}

// ==========================================================
//                     主逻辑
// ==========================================================

let isSending = false; // 状态锁

const MANUAL_INPUT_SELECTORS = [
  "#prompt-textarea",
  "div[contenteditable=\"true\"]",
  "rich-textarea",
];

const MANUAL_BUTTON_SELECTORS = [
  "#composer-submit-button",
  "button[aria-label=\"Send message\"]",
];

function recycleResponseListener(reason) {
  const listener = window.__responseListenerInstances && window.__responseListenerInstances.chatgpt;
  if (!listener || typeof listener.reset !== "function") return;
  console.log(`ChatGPT 手动发送，回收回复监听: ${reason}`);
  listener.reset();
}

function matchesAnySelector(target, selectors) {
  return selectors.some((selector) => {
    try {
      return !!target.closest(selector);
    } catch (e) {
      return false;
    }
  });
}

if (!window.__chatgptManualRecycleBound) {
  window.__chatgptManualRecycleBound = true;

  document.addEventListener("click", (event) => {
    if (isSending) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (matchesAnySelector(target, MANUAL_BUTTON_SELECTORS)) {
      recycleResponseListener("button-click");
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (isSending) return;
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const isInputTarget = target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement ||
      target.isContentEditable;
    if (!isInputTarget) return;
    if (matchesAnySelector(target, MANUAL_INPUT_SELECTORS)) {
      recycleResponseListener("enter-key");
    }
  }, true);
}

async function sendChatMessage(message) {
  if (isSending) {
    console.warn("正在发送中，请勿重复操作");
    return false;
  }

  isSending = true;
  console.log("开始发送流程，已锁定发送状态");

  const inputXPaths = [
    '//*[@id="prompt-textarea"]/p',            // 新 DOM 的 p 标签
    '//*[@id="prompt-textarea"]',              // 新 DOM 的 contenteditable div
    '//div[@contenteditable="true"]/p',        // 通用 contenteditable p
    '//rich-textarea/div[1]/p',                // 旧版输入框
  ];

  const buttonXPaths = [
    '//*[@id="composer-submit-button"]',       // 新 DOM 按钮
    "//button[@aria-label='Send message']",    // 通用 send 按钮
    "//button[contains(@class, 'send-btn')]",  // 老版本
  ];

  // 1. 找输入框
  const inputElement = await waitForElement(inputXPaths, 3000);
  if (!inputElement) {
    console.error("未找到输入框");
    isSending = false;
    return false;
  }

  // 2. 输入内容
  try {
    inputElement.textContent = message;
    triggerInputEvents(inputElement);
    console.log("文本输入完成");
  } catch (e) {
    console.error("输入文本失败", e);
    isSending = false;
    return false;
  }

  // 3. 等待按钮出现（最多 3 秒）
  const buttonElement = await waitForElement(buttonXPaths, 3000);
  if (!buttonElement) {
    console.error("未找到发送按钮（可能被隐藏）");
    isSending = false;
    return false;
  }

  // 4. 延时点击
  setTimeout(() => {
    if (triggerClick(buttonElement)) {
      console.log("消息发送成功");
    } else {
      console.error("点击发送失败");
    }
    isSending = false; // 解锁
    console.log("发送流程结束，已解锁发送状态");
  }, 100);

  return true;
}

// ==========================================================
//                     消息监听
// ==========================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendMessage") {
    console.log(`收到消息发送请求: ${request.message}`);
    sendChatMessage(request.message).then((success) => {
      sendResponse({
        status: success ? "success" : "failed"
      });
    });
    return true; // 异步响应
  }
});

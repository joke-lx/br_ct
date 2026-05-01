/**
 * @fileoverview
 * CoderQwen 平台内容脚本 (https://coder.qwen.ai/)
 *
 * 特点：
 * - 标准 textarea 输入框
 * - 发送按钮带有"编码"文字
 */

// ==========================================================
//                     平台配置参数
// ==========================================================

const PLATFORM_CONFIG = {
  name: 'coderqwen',
  hostname: 'coder.qwen.ai',
  clickMode: 'click',
  inputMode: 'value',
  contenteditableInputMode: 'auto',
  needActivateInput: false,
  activateDelay: 100,
  inputDelay: 100,
  clickDelay: 100,
  elementTimeout: 5000,
  retryInterval: 100,
  verboseLogging: true,
  enableSmartDiscovery: true,
  findButtonNearInput: false,
  buttonEnableRetry: {
    enabled: false,
    maxRetries: 5,
    retryInterval: 200,
  },
};

// ==========================================================
//                     选择器配置
// ==========================================================

const INPUT_SELECTORS = [
  { type: 'css', value: 'textarea.code-agent-input-textarea' },
  { type: 'css', value: 'div.code-agent-input-textarea-container textarea' },
  { type: 'css', value: 'textarea[placeholder*="创意代码" i]' },
];

const BUTTON_SELECTORS = [
  { type: 'css', value: 'button.qwen-chat-btn.code-agent-input-button-class' },
  { type: 'css', value: 'button.qwen-chat-btn' },
  { type: 'xpath', value: "//button[.//span[contains(text(), '编码')]]" },
];

// ==========================================================
//                     通用查找器
// ==========================================================

function findElementBySelectors(selectors) {
  for (const selector of selectors) {
    try {
      let element = null;
      switch (selector.type) {
        case 'id':
          element = document.getElementById(selector.value);
          break;
        case 'css':
          element = document.querySelector(selector.value);
          break;
        case 'xpath':
          const result = document.evaluate(selector.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          element = result.singleNodeValue;
          break;
        default:
          continue;
      }
      if (element) {
        logInfo(`成功找到元素: ${selector.type} -> ${selector.value}`);
        return element;
      }
    } catch (e) {
      logWarning(`选择器无效: ${selector.type} -> ${selector.value}`, e);
    }
  }
  logWarning("所有选择器都未找到元素");
  return null;
}

async function waitForElement(selectors, timeout, elementType = 'input') {
  const startTime = Date.now();
  const endTime = startTime + timeout;
  let attemptCount = 0;

  return new Promise((resolve) => {
    const checkElement = () => {
      attemptCount++;
      const element = findElementBySelectors(selectors);
      if (element) {
        logInfo(`元素在第 ${attemptCount} 次尝试中找到 (耗时: ${Date.now() - startTime}ms)`);
        resolve(element);
        return;
      }
      if (Date.now() >= endTime) {
        logWarning(`元素查找超时 (${timeout}ms)，共尝试 ${attemptCount} 次`);
        if (PLATFORM_CONFIG.enableSmartDiscovery) {
          logInfo("预定义选择器失败，启动兜底机制...");
          const fallbackElement = elementType === 'button'
            ? findButtonElementIntelligently()
            : findInputElementIntelligently();
          if (fallbackElement) {
            logInfo("兜底机制成功找到元素！");
            resolve(fallbackElement);
            return;
          }
        }
        resolve(null);
        return;
      }
      setTimeout(checkElement, PLATFORM_CONFIG.retryInterval);
    };
    checkElement();
  });
}

// ==========================================================
//                     智能元素发现（兜底机制）
// ==========================================================

function findInputElementIntelligently() {
  logInfo("选择器失败，启动兜底机制查找输入元素...");
  const selectors = [
    'textarea:not([readonly]):not([disabled])',
    'input[type="text"]:not([readonly]):not([disabled])',
  ];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && isElementVisible(element)) {
      logInfo(`兜底机制找到输入元素: ${selector}`);
      return element;
    }
  }
  return null;
}

function findButtonElementIntelligently() {
  logInfo("选择器失败，启动兜底机制查找按钮元素...");
  const selectors = [
    'button:not([disabled]):not([hidden])',
    '[role="button"]:not([aria-disabled="true"])',
  ];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isElementVisible(element)) {
        logInfo(`兜底机制找到按钮元素: ${selector}`);
        return element;
      }
    }
  }
  return null;
}

function isElementVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  if (!document.body.contains(element)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// ==========================================================
//                     输入工具
// ==========================================================

async function setInputValue(element, value) {
  if (!element) return false;
  try {
    element.value = value.trim();
    return true;
  } catch (e) {
    logError("设置输入值失败", e);
    return false;
  }
}

function triggerInputEvents(element) {
  if (!element) return false;
  try {
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    return true;
  } catch (e) {
    logError("触发输入事件失败", e);
    return false;
  }
}

function activateInput(element) {
  if (!element) return false;
  try {
    element.click();
    element.focus();
    return true;
  } catch (e) {
    logError("激活输入框失败", e);
    return false;
  }
}

// ==========================================================
//                     点击工具
// ==========================================================

function triggerClick(element) {
  if (!element) return false;
  if (element.offsetParent === null) return false;
  try {
    element.click();
    logInfo("原生点击成功");
    return true;
  } catch (e) {
    logWarning("原生点击失败，尝试 MouseEvent");
    try {
      const rect = element.getBoundingClientRect();
      const mouseEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      });
      element.dispatchEvent(mouseEvent);
      return true;
    } catch (e2) {
      logError("MouseEvent 点击也失败", e2);
      return false;
    }
  }
}

// ==========================================================
//                     延时 & 日志
// ==========================================================

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logInfo(message) {
  if (PLATFORM_CONFIG.verboseLogging) console.log(`[${PLATFORM_CONFIG.name}] ${message}`);
}

function logWarning(message, error) {
  console.warn(`[${PLATFORM_CONFIG.name}] ${message}`, error || '');
}

function logError(message, error) {
  console.error(`[${PLATFORM_CONFIG.name}] ${message}`, error || '');
}

// ==========================================================
//                     主逻辑
// ==========================================================

let isSending = false;

async function sendChatMessage(message) {
  if (isSending) {
    logWarning("正在发送中，请勿重复操作");
    return false;
  }
  if (!message || typeof message !== 'string' || message.trim() === '') {
    logError("消息内容无效");
    return false;
  }

  isSending = true;
  logInfo(`开始发送流程，消息: "${message}"`);

  try {
    // 查找输入框
    const inputElement = await waitForElement(INPUT_SELECTORS, PLATFORM_CONFIG.elementTimeout);
    if (!inputElement) {
      logError("未找到输入框");
      return false;
    }

    // 激活输入框
    if (PLATFORM_CONFIG.needActivateInput) {
      activateInput(inputElement);
      await delay(PLATFORM_CONFIG.activateDelay);
    }

    // 设置输入值
    const inputResult = await setInputValue(inputElement, message);
    if (!inputResult) {
      logError("设置输入值失败");
      return false;
    }

    // 触发输入事件
    triggerInputEvents(inputElement);
    await delay(PLATFORM_CONFIG.inputDelay);

    // 查找发送按钮
    const buttonElement = await waitForElement(BUTTON_SELECTORS, PLATFORM_CONFIG.elementTimeout, 'button');
    if (!buttonElement) {
      logError("未找到发送按钮");
      return false;
    }

    await delay(PLATFORM_CONFIG.clickDelay);

    // 点击发送
    if (triggerClick(buttonElement)) {
      logInfo("消息发送成功");
      return true;
    } else {
      logError("点击发送按钮失败");
      return false;
    }
  } catch (e) {
    logError("发送流程异常", e);
    return false;
  } finally {
    isSending = false;
  }
}

// ==========================================================
//                     消息监听
// ==========================================================

if (!window.location.hostname.includes(PLATFORM_CONFIG.hostname)) {
  logWarning(`当前页面不是 ${PLATFORM_CONFIG.hostname}，脚本未激活`);
} else {
  logInfo(`CoderQwen 内容脚本已加载并激活`);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendMessage') {
      logInfo(`收到消息发送请求: "${request.message}"`);
      sendChatMessage(request.message)
        .then((success) => {
          sendResponse({ status: success ? 'success' : 'failed', platform: PLATFORM_CONFIG.name, timestamp: Date.now() });
        })
        .catch((error) => {
          logError("消息处理异常", error);
          sendResponse({ status: 'error', platform: PLATFORM_CONFIG.name, error: error.message, timestamp: Date.now() });
        });
      return true;
    }
    sendResponse({ status: 'unknown_action' });
  });
}

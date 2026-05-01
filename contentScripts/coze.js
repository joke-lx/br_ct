/**
 * @fileoverview
 * Coze 平台内容脚本 (https://www.coze.cn/)
 *
 * 特点：
 * - 使用 CodeMirror 编辑器 (contenteditable)
 * - 发送按钮是向上箭头图标
 */

// ==========================================================
//                     平台配置参数
// ==========================================================

const PLATFORM_CONFIG = {
  name: 'coze',
  hostname: 'coze.cn',
  clickMode: 'click',
  inputMode: 'value',
  contenteditableInputMode: 'beforeinput',
  needActivateInput: true,
  activateDelay: 200,
  inputDelay: 200,
  clickDelay: 100,
  elementTimeout: 5000,
  retryInterval: 100,
  verboseLogging: true,
  enableSmartDiscovery: true,
  findButtonNearInput: true,
  buttonEnableRetry: {
    enabled: false, // Coze 响应慢，直接点击
    maxRetries: 15,
    retryInterval: 600,
  },
};

// ==========================================================
//                     选择器配置
// ==========================================================

const INPUT_SELECTORS = [
  // CodeMirror 输入框
  { type: 'css', value: 'div.cm-content[contenteditable="true"]' },
  { type: 'css', value: 'div.cm-editor .cm-content' },
  { type: 'css', value: 'div.cm-lineWrapping[contenteditable="true"]' },
  // 容器内的 contenteditable
  { type: 'css', value: 'div.container-xcEh8Q div[contenteditable="true"]' },
];

const BUTTON_SELECTORS = [
  // 发送按钮 - 向上箭头 + bg-primary 背景（最精确）
  { type: 'css', value: 'div.container-xcEh8Q button.bg-primary svg.lucide-arrow-up' },
  { type: 'css', value: 'div.container-xcEh8Q button.bg-primary' },
  // 发送按钮 - 通过父容器定位
  { type: 'css', value: 'div.container-xcEh8Q div.flex.items-center.justify-end button' },
  // 通用向上箭头按钮
  { type: 'css', value: 'button.bg-primary:not([disabled]) svg.lucide-arrow-up' },
  { type: 'xpath', value: "//div[contains(@class, 'container-xcEh8Q')]//button[contains(@class, 'bg-primary')]//svg[contains(@class, 'lucide-arrow-up')]" },
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
    'div.cm-content[contenteditable="true"]',
    'div.cm-editor .cm-content',
    '[contenteditable="true"][role="textbox"]',
    'textarea:not([readonly]):not([disabled])',
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
  // 查找包含向上箭头路径的按钮
  const selectors = [
    'button svg path[d*="M12"][d*="19V5"]',
    'button:not([disabled]):not([hidden])',
    '[role="button"]:not([aria-disabled="true"])',
  ];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isElementVisible(element) && element.tagName === 'BUTTON') {
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
//                     输入工具 (CodeMirror)
// ==========================================================

async function simulateContenteditableInput(element, text) {
  if (!element || !text) return false;
  logInfo(`使用 beforeinput 模式输入 CodeMirror 编辑器，长度: ${text.length}`);

  element.focus();
  await delay(50);

  // 全选并替换
  document.execCommand('selectAll', false, null);
  await delay(30);

  const beforeInputEvent = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,
  });
  element.dispatchEvent(beforeInputEvent);

  const success = document.execCommand('insertText', false, text);
  if (!success) {
    element.textContent = text;
  }

  element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  document.dispatchEvent(new Event('selectionchange', { bubbles: true }));

  logInfo("CodeMirror beforeinput 模式输入完成");
  return true;
}

async function setInputValue(element, value) {
  if (!element) return false;

  const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';

  if (isContentEditable) {
    return await simulateContenteditableInput(element, value.trim());
  }

  element.value = value.trim();
  return true;
}

function triggerInputEvents(element) {
  if (!element) return false;
  try {
    const events = [
      new Event('focus', { bubbles: true }),
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
    ];
    events.forEach((event) => element.dispatchEvent(event));
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
//                     键盘工具 (Enter 键)
// ==========================================================

function triggerEnterKey(element) {
  if (!element) return false;

  try {
    // 聚焦元素
    element.focus();
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // keydown
    element.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      view: window,
      key: 'Enter',
      keyCode: 13,
      which: 13,
      clientX: centerX,
      clientY: centerY,
    }));

    // keypress
    element.dispatchEvent(new KeyboardEvent('keypress', {
      bubbles: true,
      cancelable: true,
      view: window,
      key: 'Enter',
      keyCode: 13,
      which: 13,
    }));

    // keyup
    element.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      view: window,
      key: 'Enter',
      keyCode: 13,
      which: 13,
    }));

    logInfo("Enter 键事件链已触发");
    return true;
  } catch (e) {
    logError("Enter 键触发失败", e);
    return false;
  }
}

// ==========================================================
//                     点击工具
// ==========================================================

function triggerClick(element) {
  if (!element) return false;
  if (element.offsetParent === null && !isElementVisible(element)) {
    logWarning("元素不可见，尝试强制点击");
  }

  // 先尝试找到真正的可点击按钮（可能 selector 匹配到的是包装层）
  let targetButton = element;
  if (element.tagName !== 'BUTTON') {
    const actualButton = element.closest('button');
    if (actualButton) {
      targetButton = actualButton;
    }
  }

  try {
    // 直接触发 mousedown + mouseup + click 完整事件链
    const rect = targetButton.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // mousedown
    targetButton.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    }));

    // 短暂延迟
    delay(10);

    // mouseup
    targetButton.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    }));

    // click
    targetButton.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    }));

    logInfo("完整鼠标事件链已触发");
    return true;
  } catch (e) {
    logError("鼠标事件触发失败", e);
    return false;
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

    // 使用 Enter 键发送消息
    logInfo("使用 Enter 键发送消息");
    await delay(PLATFORM_CONFIG.clickDelay);

    // 模拟 Enter 键按下
    const enterResult = triggerEnterKey(inputElement);
    if (enterResult) {
      logInfo("Enter 键已触发，消息发送成功");
      return true;
    } else {
      logError("Enter 键触发失败");
      return false;
    }
  } catch (e) {
    logError("发送流程异常", e);
    return false;
  } finally {
    isSending = false;
  }
}

async function waitForButtonEnabled(buttonElement, inputElement, message) {
  const { maxRetries, retryInterval } = PLATFORM_CONFIG.buttonEnableRetry;

  const checkButtonEnabled = () => {
    // Coze 按钮检查更宽松，只要按钮存在就认为可用
    if (!buttonElement) return false;
    if (!document.body.contains(buttonElement)) return false;
    const rect = buttonElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
  };

  if (checkButtonEnabled()) {
    logInfo("发送按钮已就绪");
    return true;
  }

  for (let i = 0; i < maxRetries; i++) {
    logWarning(`等待按钮就绪... (${i + 1}/${maxRetries})`);
    await delay(retryInterval);
    if (checkButtonEnabled()) {
      logInfo(`按钮在第 ${i + 1} 次重试后就绪`);
      return true;
    }
  }
  logError(`按钮在 ${maxRetries} 次重试后仍不可用`);
  return false;
}

// ==========================================================
//                     消息监听
// ==========================================================

if (!window.location.hostname.includes(PLATFORM_CONFIG.hostname)) {
  logWarning(`当前页面不是 ${PLATFORM_CONFIG.hostname}，脚本未激活`);
} else {
  logInfo(`Coze 内容脚本已加载并激活`);

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

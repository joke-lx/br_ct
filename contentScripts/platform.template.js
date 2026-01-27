/**
 * @fileoverview
 * AI 平台内容脚本通用模板
 *
 * 使用说明：
 * 1. 修改 PLATFORM_CONFIG 中的配置参数
 * 2. 根据平台特性调整 CLICK_MODE（普通平台用 'click'，GLM 用 'mouseup'）
 * 3. 修改选择器列表（inputSelectors 和 buttonSelectors）
 * 4. 如需自定义输入逻辑，修改 setInputValue() 函数
 */

// ==========================================================
//                     平台配置参数
// ==========================================================

/**
 * 平台配置对象 - 所有平台相关参数在此声明
 * 修改此配置以适配不同平台
 */
const PLATFORM_CONFIG = {
  // 平台标识（用于日志和响应）
  name: 'platform_name',

  // 域名检查（支持部分匹配）
  hostname: 'platform-domain.com',

  // 点击模式：'click' | 'mouseup' | 'both'
  // - 'click': 普通点击（ChatGPT, Claude, Gemini, Doubao, Tongyi 等）
  // - 'mouseup': GLM 特殊模式（只需 mouseup，不需要 click）
  // - 'both': 同时尝试两种方式
  clickMode: 'click',

  // 输入模式：'value' | 'textContent' | 'nativeSetter' | 'custom'
  // - 'value': 用于 input/textarea 元素
  // - 'textContent': 用于 contenteditable 元素
  // - 'nativeSetter': 使用原生 setter（React 受控组件）
  // - 'custom': 自定义逻辑
  inputMode: 'value',

  // 是否需要先激活输入框（点击 + focus）
  needActivateInput: false,

  // 激活后延迟时间（毫秒）
  activateDelay: 100,

  // 输入后延迟时间（毫秒）
  inputDelay: 100,

  // 点击后延迟时间（毫秒）
  clickDelay: 100,

  // 元素查找超时时间（毫秒）
  elementTimeout: 5000,

  // 元素查找重试间隔（毫秒）
  retryInterval: 100,

  // 是否输出详细日志
  verboseLogging: true,

  // 是否启用智能元素发现（当预定义选择器失败时自动查找）
  enableSmartDiscovery: true,
};

// ==========================================================
//                     选择器配置
// ==========================================================

/**
 * 输入框选择器列表（按优先级排序）
 * 支持类型：'css', 'xpath', 'id'
 * 选择器会按数组顺序依次尝试，找到第一个即返回
 */
const INPUT_SELECTORS = [
  // 示例：CSS 选择器
  // { type: 'css', value: 'textarea[placeholder="Start typing..."]' },

  // 示例：XPath 选择器
  // { type: 'xpath', value: '//textarea[@placeholder="Start typing..."]' },

  // 示例：ID 选择器
  // { type: 'id', value: 'prompt-textarea' },

  // 示例：contenteditable 元素
  // { type: 'css', value: 'div[contenteditable="true"]' },
  // { type: 'xpath', value: '//div[@role="textbox"][@contenteditable="true"]//p' },
];

/**
 * 发送按钮选择器列表（按优先级排序）
 * 支持类型：'css', 'xpath', 'id'
 */
const BUTTON_SELECTORS = [
  // 示例：通过 aria-label 定位
  // { type: 'css', value: 'button[aria-label="Send message"]' },

  // 示例：通过文本内容定位
  // { type: 'xpath', value: "//button[.//span[contains(text(), 'Send')]]" },

  // 示例：通过类名定位
  // { type: 'css', value: 'button.send-btn' },

  // 示例：完整路径（最不推荐，作为最后备选）
  // { type: 'xpath', value: '/html/body/div[1]/.../button' },
];

// ==========================================================
//                     通用查找器
// ==========================================================

/**
 * 统一的元素查找器 - 支持多种选择器类型
 * @param {Array<Object>} selectors - 选择器配置数组
 * @returns {Element|null} 找到的元素或 null
 */
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
          const result = document.evaluate(
            selector.value,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          element = result.singleNodeValue;
          break;

        default:
          logWarning(`未知的选择器类型: ${selector.type}`);
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

/**
 * 异步等待元素出现 - 支持超时和重试，超时后尝试智能发现
 * @param {Array<Object>} selectors - 选择器配置数组
 * @param {number} timeout - 超时时间（毫秒）
 * @param {boolean} enableSmartDiscovery - 是否启用智能发现作为后备（默认使用配置）
 * @returns {Promise<Element|null>} 找到的元素或超时后的 null
 */
async function waitForElement(selectors, timeout, enableSmartDiscovery) {
  const startTime = Date.now();
  const endTime = startTime + timeout;
  let attemptCount = 0;
  const smartDiscovery = enableSmartDiscovery !== undefined ? enableSmartDiscovery : PLATFORM_CONFIG.enableSmartDiscovery;

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

        // 尝试智能发现作为后备方案
        if (smartDiscovery) {
          logInfo("预定义选择器失败，启动智能元素发现...");
          const smartElement = findInputElementIntelligently();
          if (smartElement) {
            logInfo("智能发现成功找到输入元素！");
            resolve(smartElement);
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
//                     智能元素发现（递归查找）
// ==========================================================

/**
 * 智能查找可输入元素 - 递归搜索页面中的可输入元素
 * 当预定义选择器失败时作为备用方案
 * @returns {Element|null} 找到的最可能的输入元素
 */
function findInputElementIntelligently() {
  logInfo("启动智能元素发现，递归搜索可输入元素...");

  // 按优先级定义的候选元素查询
  const candidates = [];

  // 1. 查找所有可能的可输入元素
  // 1.1 textarea 元素（最常见的聊天输入框）
  const textareas = Array.from(document.querySelectorAll('textarea:not([readonly]):not([disabled])'));
  for (const el of textareas) {
    if (isElementVisible(el)) {
      const score = scoreInputElement(el);
      candidates.push({ element: el, score, type: 'textarea' });
    }
  }

  // 1.2 contenteditable 元素（富文本编辑器）
  const contentEditables = Array.from(document.querySelectorAll('[contenteditable="true"]:not([readonly])'));
  for (const el of contentEditables) {
    if (isElementVisible(el)) {
      const score = scoreInputElement(el);
      candidates.push({ element: el, score, type: 'contenteditable' });
    }
  }

  // 1.3 input 元素（类型为 text, search, email 等）
  const inputs = Array.from(document.querySelectorAll('input[type="text"]:not([readonly]):not([disabled]), input[type="search"]:not([readonly]):not([disabled]), input[type="email"]:not([readonly]):not([disabled]), input:not([type]):not([readonly]):not([disabled])'));
  for (const el of inputs) {
    if (isElementVisible(el)) {
      const score = scoreInputElement(el);
      candidates.push({ element: el, score, type: 'input' });
    }
  }

  if (candidates.length === 0) {
    logWarning("智能发现未找到可输入元素");
    return null;
  }

  // 按得分排序，选择最佳候选
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  logInfo(`智能发现找到输入元素: ${best.type}, 得分: ${best.score.toFixed(2)}`);

  // 输出前3个候选元素供调试
  if (candidates.length > 1) {
    logInfo(`其他候选元素: ${candidates.slice(1, 4).map(c => `${c.type}(${c.score.toFixed(1)})`).join(', ')}`);
  }

  return best.element;
}

/**
 * 评估输入元素作为目标的可能性得分
 * @param {Element} element - 输入元素
 * @returns {number} 得分（0-100，越高越可能是目标）
 */
function scoreInputElement(element) {
  let score = 0;

  // 获取元素位置信息
  const rect = element.getBoundingClientRect();

  // 1. 可见性得分 (0-30)
  if (rect.width > 0 && rect.height > 0) {
    // 元素在视口内
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
    if (isInViewport) score += 15;
    else score += 5; // 部分可见

    // 元素大小（聊天输入框通常较大）
    const area = rect.width * rect.height;
    if (area > 50000) score += 10;      // 大于 200x250
    else if (area > 20000) score += 7;  // 大于 140x140
    else if (area > 10000) score += 5;  // 大于 100x100
    else if (area > 5000) score += 3;   // 大于 70x70
  }

  // 2. 位置得分 (0-25) - 越靠下越可能是聊天输入框
  const windowHeight = window.innerHeight;
  const relativeTop = rect.top / windowHeight;
  if (relativeTop > 0.7) score += 15;   // 底部 30%
  else if (relativeTop > 0.5) score += 10; // 下半部分
  else if (relativeTop > 0.3) score += 5;  // 中下部

  // 3. 标签类型得分 (0-20)
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'textarea') score += 20;      // textarea 最可能是聊天输入
  else if (element.isContentEditable) score += 15; // contenteditable 次之
  else if (tagName === 'input') score += 5;    // input 可能是搜索框

  // 4. 属性特征得分 (0-25)
  const placeholder = (element.placeholder || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const className = (element.className || '').toLowerCase();
  const id = (element.id || '').toLowerCase();

  // 常见的聊天输入框特征
  const chatKeywords = [
    'message', 'prompt', 'input', 'chat', 'send', 'text',
    '提问', '输入', '发送', '消息', '对话', '回答'
  ];

  const hasChatKeyword = chatKeywords.some(keyword =>
    placeholder.includes(keyword) ||
    ariaLabel.includes(keyword) ||
    className.includes(keyword) ||
    id.includes(keyword)
  );

  if (hasChatKeyword) score += 15;

  // placeholder 存在（有 placeholder 更可能是用户输入区域）
  if (placeholder) score += 5;

  // 避免选择隐藏或极小的元素
  if (rect.width < 50 || rect.height < 20) {
    score -= 20;
  }

  // 如果元素是只读或已禁用（应该在前面的过滤中排除，但双重保险）
  if (element.readOnly || element.disabled) {
    score -= 50;
  }

  return Math.max(0, score);
}

/**
 * 检查元素是否可见
 * @param {Element} element - 要检查的元素
 * @returns {boolean} 是否可见
 */
function isElementVisible(element) {
  if (!element) return false;

  // 检查基本的显示属性
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // 检查是否在 DOM 中
  if (!document.body.contains(element)) {
    return false;
  }

  // 检查尺寸
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  // 检查是否被 overflow:hidden 遮挡
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.overflow === 'hidden' || parentStyle.overflow === 'auto') {
      const parentRect = parent.getBoundingClientRect();
      if (rect.bottom < parentRect.top || rect.top > parentRect.bottom ||
          rect.right < parentRect.left || rect.left > parentRect.right) {
        return false;
      }
    }
    parent = parent.parentElement;
  }

  return true;
}

// ==========================================================
//                     输入工具
// ==========================================================

/**
 * 设置输入元素的值（根据配置的 inputMode）
 * @param {Element} element - 输入元素
 * @param {string} value - 要设置的值
 * @returns {boolean} 是否成功
 */
function setInputValue(element, value) {
  if (!element) {
    logWarning("输入元素不存在");
    return false;
  }

  try {
    const trimmedValue = value.trim();

    switch (PLATFORM_CONFIG.inputMode) {
      case 'value':
        // 用于 input/textarea 元素
        element.value = trimmedValue;
        break;

      case 'textContent':
        // 用于 contenteditable 元素
        element.textContent = trimmedValue;
        break;

      case 'nativeSetter':
        // 使用原生 setter（React 受控组件）
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;

        if (nativeSetter) {
          nativeSetter.call(element, trimmedValue);
        } else {
          element.value = trimmedValue;
        }
        break;

      case 'custom':
        // 自定义逻辑，根据需要修改
        if (element.isContentEditable || element.contentEditable === 'true') {
          element.textContent = trimmedValue;
        } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.value = trimmedValue;
        } else {
          element.textContent = trimmedValue;
        }
        break;

      default:
        logWarning(`未知的输入模式: ${PLATFORM_CONFIG.inputMode}`);
        return false;
    }

    logInfo("输入值已设置");
    return true;
  } catch (e) {
    logError("设置输入值失败", e);
    return false;
  }
}

/**
 * 触发输入元素的完整事件序列
 * @param {Element} element - 目标元素
 * @returns {boolean} 是否成功
 */
function triggerInputEvents(element) {
  if (!element) {
    logWarning("输入元素不存在，无法触发事件");
    return false;
  }

  try {
    const events = [
      new Event('focus', { bubbles: true }),
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
      new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' }),
    ];

    events.forEach((event) => element.dispatchEvent(event));

    logInfo("输入事件已触发");
    return true;
  } catch (e) {
    logError("触发输入事件失败", e);
    return false;
  }
}

/**
 * 激活输入框（点击 + 聚焦）
 * @param {Element} element - 输入元素
 * @returns {boolean} 是否成功
 */
function activateInput(element) {
  if (!element) {
    logWarning("输入元素不存在，无法激活");
    return false;
  }

  try {
    element.click();
    element.focus();
    logInfo("输入框已激活");
    return true;
  } catch (e) {
    logError("激活输入框失败", e);
    return false;
  }
}

// ==========================================================
//                     点击工具
// ==========================================================

/**
 * 触发元素点击 - 支持多种点击模式
 * @param {Element} element - 目标元素
 * @returns {boolean} 是否成功
 */
function triggerClick(element) {
  if (!element) {
    logWarning("点击元素不存在");
    return false;
  }

  // 检查元素状态
  if (element.offsetParent === null) {
    logWarning("元素不可见，无法点击");
    return false;
  }

  if (element.disabled) {
    logWarning("元素已禁用，无法点击");
    return false;
  }

  const clickMode = PLATFORM_CONFIG.clickMode;

  try {
    switch (clickMode) {
      case 'mouseup':
        // GLM 特殊模式：只用 mouseup 触发
        return triggerMouseUpClick(element);

      case 'click':
        // 普通点击模式
        return triggerNormalClick(element);

      case 'both':
        // 先尝试普通点击，失败后尝试 mouseup
        if (triggerNormalClick(element)) {
          return true;
        }
        logInfo("普通点击失败，尝试 mouseup 模式");
        return triggerMouseUpClick(element);

      default:
        logWarning(`未知的点击模式: ${clickMode}`);
        return false;
    }
  } catch (e) {
    logError("点击失败", e);
    return false;
  }
}

/**
 * 普通点击模式（click 事件）
 * @param {Element} element - 目标元素
 * @returns {boolean} 是否成功
 */
function triggerNormalClick(element) {
  try {
    // 尝试原生 click()
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
      logInfo("MouseEvent 点击成功");
      return true;
    } catch (e2) {
      logError("MouseEvent 点击也失败", e2);
      return false;
    }
  }
}

/**
 * MouseUp 点击模式（GLM 特殊）
 * GLM 只需要 mouseup 事件，不需要完整的 click
 * @param {Element} element - 目标元素
 * @returns {boolean} 是否成功
 */
function triggerMouseUpClick(element) {
  try {
    const rect = element.getBoundingClientRect();

    // 模拟鼠标按下
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    element.dispatchEvent(mousedownEvent);

    // 模拟鼠标抬起（GLM 关键点：mouseup 就能触发）
    const mouseupEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    element.dispatchEvent(mouseupEvent);

    logInfo("MouseUp 点击成功（GLM 模式）");
    return true;
  } catch (e) {
    logError("MouseUp 点击失败", e);
    return false;
  }
}

// ==========================================================
//                     延时工具
// ==========================================================

/**
 * 延时指定毫秒数
 * @param {number} ms - 延时时间（毫秒）
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================================
//                     日志工具
// ==========================================================

function logInfo(message) {
  if (PLATFORM_CONFIG.verboseLogging) {
    console.log(`[${PLATFORM_CONFIG.name}] ${message}`);
  }
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

let isSending = false; // 状态锁，防止重复发送

/**
 * 发送聊天消息的完整流程
 * @param {string} message - 要发送的消息内容
 * @returns {Promise<boolean>} 发送是否成功
 */
async function sendChatMessage(message) {
  // 1. 状态锁检查
  if (isSending) {
    logWarning("正在发送中，请勿重复操作");
    return false;
  }

  // 2. 消息验证
  if (!message || typeof message !== 'string' || message.trim() === '') {
    logError("消息内容无效");
    return false;
  }

  isSending = true;
  logInfo(`开始发送流程，消息: "${message}"`);

  try {
    // 3. 查找输入框
    logInfo("正在查找输入框...");
    const inputElement = await waitForElement(INPUT_SELECTORS, PLATFORM_CONFIG.elementTimeout);
    if (!inputElement) {
      logError("未找到输入框，发送失败");
      return false;
    }

    // 4. 激活输入框（如果需要）
    if (PLATFORM_CONFIG.needActivateInput) {
      logInfo("正在激活输入框...");
      activateInput(inputElement);
      await delay(PLATFORM_CONFIG.activateDelay);
    }

    // 5. 设置输入值
    logInfo("正在设置输入值...");
    if (!setInputValue(inputElement, message)) {
      logError("设置输入值失败");
      return false;
    }

    // 6. 触发输入事件
    if (!triggerInputEvents(inputElement)) {
      logError("触发输入事件失败");
      return false;
    }

    // 7. 输入后延迟
    await delay(PLATFORM_CONFIG.inputDelay);

    // 8. 查找发送按钮
    logInfo("正在查找发送按钮...");
    const buttonElement = await waitForElement(BUTTON_SELECTORS, PLATFORM_CONFIG.elementTimeout);
    if (!buttonElement) {
      logError("未找到发送按钮");
      return false;
    }

    // 9. 点击后延迟
    await delay(PLATFORM_CONFIG.clickDelay);

    // 10. 点击发送
    logInfo("正在点击发送按钮...");
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
    logInfo("发送流程结束，已解锁状态");
  }
}

// ==========================================================
//                     消息监听 & 环境检查
// ==========================================================

// 环境检查
if (!window.location.hostname.includes(PLATFORM_CONFIG.hostname)) {
  logWarning(`当前页面不是 ${PLATFORM_CONFIG.hostname}，脚本未激活`);
} else {
  logInfo(`${PLATFORM_CONFIG.hostname} 内容脚本已加载并激活`);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendMessage') {
      logInfo(`收到消息发送请求: "${request.message}"`);

      sendChatMessage(request.message)
        .then((success) => {
          sendResponse({
            status: success ? 'success' : 'failed',
            platform: PLATFORM_CONFIG.name,
            timestamp: Date.now(),
          });
          logInfo(`消息处理完成，状态: ${success ? 'success' : 'failed'}`);
        })
        .catch((error) => {
          logError("消息处理异常", error);
          sendResponse({
            status: 'error',
            platform: PLATFORM_CONFIG.name,
            error: error.message,
            timestamp: Date.now(),
          });
        });

      return true; // 异步响应
    }

    logWarning("收到未知的消息类型", request);
    sendResponse({ status: 'unknown_action' });
  });
}

// ==========================================================
//                     调试工具（可选）
// ==========================================================

// 暴露到全局作用域，方便控制台调试
if (typeof window !== 'undefined') {
  window.__platformScript = {
    config: PLATFORM_CONFIG,
    sendChatMessage,
    findElementBySelectors,
    waitForElement,
    triggerClick,
    findInputElementIntelligently,  // 智能发现功能
    scoreInputElement,                // 评分功能
    isElementVisible,                 // 可见性检查
  };
  logInfo("调试工具已暴露到 window.__platformScript");
}

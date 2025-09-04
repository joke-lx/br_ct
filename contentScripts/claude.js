/**
 * @fileoverview
 * Claude.ai 聊天机器人脚本，专门用于与 Claude.ai 平台进行交互。
 * 基于优化的查找器策略，支持多种选择器以提高稳定性。
 * 
 * 核心特性：
 * 1. 多重选择器优先级策略，确保在页面结构变化时仍能正常工作
 * 2. 支持 contenteditable 的 p 标签输入框
 * 3. 完整的事件触发机制，确保框架状态同步
 * 4. 防重复发送机制
 * 5. 详细的调试日志输出
 */

/**
 * 优化的查找器：按优先级尝试多个选择器来查找元素。
 * @param {Array<Object>} selectors - 包含选择器类型和值的对象数组。
 * @returns {Element|null} 找到的元素或 null。
 */
function findElement(selectors) {
  for (const selector of selectors) {
    let element = null;

    if (selector.type === 'xpath') {
      try {
        const result = document.evaluate(
          selector.value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        element = result.singleNodeValue;
      } catch (e) {
        console.warn(`Claude.ai: XPath 表达式无效: ${selector.value}`);
      }
    } else if (selector.type === 'css') {
      try {
        element = document.querySelector(selector.value);
      } catch (e) {
        console.warn(`Claude.ai: CSS 选择器无效: ${selector.value}`);
      }
    } else if (selector.type === 'id') {
      element = document.getElementById(selector.value);
    }

    if (element) {
      console.log(`Claude.ai: 成功使用 ${selector.type} 找到元素: ${selector.value}`);
      return element;
    }
  }

  console.warn('Claude.ai: 所有选择器都未找到元素');
  return null;
}

/**
 * 触发输入元素的完整事件序列。
 * 对于 Claude.ai 的 contenteditable 元素，需要触发多种事件以确保状态同步。
 * @param {Element} element - 需要触发事件的元素。
 */
function triggerInputEvents(element) {
  if (!element) {
    console.warn("Claude.ai: 尝试对空元素触发输入事件。");
    return;
  }

  // 触发多种事件以确保 React/Vue 等框架能够检测到变化
  const events = [
    new Event('input', { bubbles: true, cancelable: true }),
    new Event('change', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
    new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' })
  ];

  events.forEach(event => {
    try {
      element.dispatchEvent(event);
    } catch (e) {
      console.warn(`Claude.ai: 触发事件失败:`, e);
    }
  });
}

/**
 * 触发一个元素的点击事件。
 * @param {Element} element - 需要点击的元素。
 * @returns {boolean} 如果点击成功返回 true，否则返回 false。
 */
function triggerClick(element) {
  if (!element) {
    console.warn('Claude.ai: 尝试点击空元素。');
    return false;
  }

  // 检查元素是否可见和可用
  if (element.offsetParent === null || element.disabled) {
    console.warn('Claude.ai: 元素不可点击或已被禁用。', element);
    return false;
  }

  try {
    // 先尝试标准的 click() 方法
    element.click();
    console.log('Claude.ai: 按钮点击成功');
    return true;
  } catch (e) {
    console.error('Claude.ai: 点击事件失败:', e);
    
    // 如果标准点击失败，尝试触发鼠标事件
    try {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(clickEvent);
      console.log('Claude.ai: 鼠标事件点击成功');
      return true;
    } catch (e2) {
      console.error('Claude.ai: 鼠标事件点击也失败:', e2);
      return false;
    }
  }
}

// 使用状态锁防止重复发送
let isSending = false;

/**
 * 主函数：输入文本并发送消息。
 * @param {string} message - 需要发送的文本。
 * @returns {boolean} 如果整个过程成功返回 true，否则返回 false。
 */
function sendChatMessage(message) {
  // 检查状态锁
  if (isSending) {
    console.warn("Claude.ai: 正在发送消息，请勿重复操作。");
    return false;
  }

  // 定义输入框选择器的优先级列表
  const inputSelectors = [
    // 最佳选择：基于你提供的 XPath，但添加更灵活的变体
    { type: 'xpath', value: '/html/body/div[3]/div[2]/main/div[2]/div/fieldset/div[1]/div[1]/div[1]/div/div/p[2]' },
    // 备选方案1：使用更通用的 contenteditable p 标签选择器
    { type: 'css', value: 'div[contenteditable="true"] p' },
    // 备选方案2：通过 role 属性定位
    { type: 'xpath', value: "//div[@role='textbox'][@contenteditable='true']//p" },
    // 备选方案3：通过 aria-label 定位（基于文档中的 aria-label）
    { type: 'xpath', value: "//div[@aria-label='Write your prompt to Claude']//p" },
    // 备选方案4：ProseMirror 编辑器选择器
    { type: 'css', value: '.ProseMirror p' },
    // 备选方案5：通用的 fieldset 内的 p 标签
    { type: 'xpath', value: "//fieldset//div//p[@contenteditable or parent::div[@contenteditable='true']]" }
  ];

  // 1. 查找输入框
  const inputElement = findElement(inputSelectors);
  if (!inputElement) {
    console.error("Claude.ai: 使用所有备选方案后，仍未找到输入框元素。");
    return false;
  }

  // 设置状态锁
  isSending = true;
  console.log("Claude.ai: 开始发送流程，已锁定发送状态。");

  // 2. 输入文本
  try {
    // 清空现有内容并设置新内容
    inputElement.textContent = message;
    
    // 触发输入事件
    triggerInputEvents(inputElement);
    console.log("Claude.ai: 文本输入成功，已触发输入事件。");
  } catch (e) {
    console.error('Claude.ai: 输入文本失败:', e);
    isSending = false;
    return false;
  }

  // 3. 定义发送按钮选择器的优先级列表
  const buttonSelectors = [
    // 最佳选择：基于你提供的 XPath
    { type: 'xpath', value: '/html/body/div[3]/div[2]/main/div[2]/div/fieldset/div[1]/div[1]/div[2]/div[3]/div/button' },
    // 备选方案1：通过 aria-label 定位
    { type: 'xpath', value: "//button[@aria-label='Send message']" },
    // 备选方案2：通过按钮内的 SVG 路径特征定位（发送箭头图标）
    { type: 'xpath', value: "//button[.//svg//path[contains(@d,'M208.49,120.49a12,12,0,0,1-17,0L140,69V216')]]" },
    // 备选方案3：通过按钮的样式类组合定位
    { type: 'css', value: 'button[aria-label="Send message"]' },
    // 备选方案4：通过包含发送图标的按钮
    { type: 'xpath', value: "//button[contains(@class, 'bg-accent-main')]" },
    // 备选方案5：fieldset 内的最后一个按钮
    { type: 'xpath', value: "//fieldset//button[last()]" }
  ];

  // 4. 查找发送按钮
  const buttonElement = findElement(buttonSelectors);
  if (!buttonElement) {
    console.error("Claude.ai: 未找到发送按钮。");
    isSending = false;
    return false;
  }

  // 5. 延时后执行点击，确保输入事件被处理
  setTimeout(() => {
    if (triggerClick(buttonElement)) {
      console.log("Claude.ai: 消息发送成功！");
    } else {
      console.error("Claude.ai: 发送失败。");
    }
    
    // 无论成功与否，发送流程结束，解锁
    isSending = false;
    console.log("Claude.ai: 发送流程结束，已解锁发送状态。");
  }, 150); // 稍微增加延时以确保输入事件完全处理

  return true;
}

/**
 * 辅助函数：检查当前页面是否是 Claude.ai
 */
function isClaudePage() {
  return window.location.hostname.includes('claude.ai');
}

// 只在 Claude.ai 页面上监听消息
if (isClaudePage()) {
  console.log('Claude.ai: 内容脚本已加载');
  
  // 监听来自扩展程序后台的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage") {
      console.log(`Claude.ai: 收到消息发送请求: "${request.message}"`);
      const success = sendChatMessage(request.message);
      sendResponse({
        status: success ? "success" : "failed",
        platform: "claude"
      });
    }
    return true; // 异步响应时需要返回 true
  });
} else {
  console.warn('Claude.ai: 当前页面不是 Claude.ai，脚本将不会激活');
}
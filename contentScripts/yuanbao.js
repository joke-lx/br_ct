/**
 * @fileoverview
 * 这是一个经过重构的聊天机器人脚本，旨在更稳定地定位聊天输入框和发送按钮，
 * 并模拟用户输入和点击操作。
 * * 核心改进点：
 * 1. 使用 CSS 选择器和 XPath 混合策略，优先使用最稳定的选择器（如 ID）。
 * 2. 引入优先查找列表，确保在网站 DOM 结构微小变化时仍能正常工作。
 * 3. 统一处理输入框，无论是 <p> 还是 <input>，都通过更通用的方式赋值。
 * 4. 增加了更清晰的日志输出，方便调试。
 * 5. 增加了原始的 XPath 作为最终备选方案，提高兼容性。
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
        console.warn(`XPath 表达式无效: ${selector.value}`);
      }
    } else if (selector.type === 'css') {
      try {
        element = document.querySelector(selector.value);
      } catch (e) {
        console.warn(`CSS 选择器无效: ${selector.value}`);
      }
    } else if (selector.type === 'id') {
      element = document.getElementById(selector.value);
    }

    if (element) {
      console.log(`成功使用 ${selector.type} 找到元素: ${selector.value}`);
      return element;
    }
  }

  return null; // 如果所有选择器都失败了
}

/**
 * 触发输入元素的完整事件序列。
 * 对于 contenteditable 元素，设置 textContent 后派发 'input' 事件通常就足够了。
 * @param {Element} element - 需要触发事件的元素。
 */
function triggerInputEvents(element) {
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  element.dispatchEvent(inputEvent);
}

/**
 * 触发一个元素的点击事件。
 * @param {Element} element - 需要点击的元素。
 * @returns {boolean} 如果点击成功返回 true，否则返回 false。
 */
function triggerClick(element) {
  if (!element || element.offsetParent === null || element.disabled) {
    console.warn('元素不可点击或已禁用', element);
    return false;
  }
  // 使用标准的 .click() 方法，它在大多数情况下都有效
  element.click();
  return true;
}

/**
 * 主函数：输入文本并发送消息。
 * @param {string} message - 需要发送的文本。
 * @returns {boolean} 如果整个过程成功返回 true，否则返回 false。
 */
function sendChatMessage(message) {
  // 定义输入框选择器的优先级列表
  const inputSelectors = [
    // 最佳选择：使用 CSS 选择器定位 ql-editor 内部的 p 标签 (最稳定)
    { type: 'css', value: '.ql-editor[contenteditable="true"] p' },
    // 备选方案1：通过 ARIA role 属性定位 (非常稳定)
    { type: 'xpath', value: "//div[@role='textbox'][@contenteditable='true']/p" },
    // 备选方案2：通过父容器 class 定位
    { type: 'css', value: '.style__text-area__edit__content___JcgqO p' },
    // 备选方案3：原始 XPath 的简化版
    { type: 'xpath', value: "//*[contains(@class, 'chat-input-editor')]//p" },
    // 最后的备用方案：兼容旧代码的最长 XPath
    { type: 'xpath', value: '//*[@id="app"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div/div[3]/div/div[4]/div/div/div[2]/div[2]/div/div/div/p' }
  ];

  // 1. 使用优化的逻辑定位输入框
  const inputElement = findElement(inputSelectors);
  if (!inputElement) {
    console.error("使用所有备选方案后，仍未找到输入框元素。");
    return false;
  }

  // 2. 输入文本
  try {
    // 对于 contenteditable 的 p 标签，直接修改 textContent 是最可靠的方式
    inputElement.textContent = message;
    triggerInputEvents(inputElement); // 触发事件以通知框架更新状态
  } catch (e) {
    console.error('输入文本失败:', e);
    return false;
  }

  // 3. 定位并点击发送按钮 (优先使用 ID，最稳定)
  const buttonSelectors = [
    { type: 'id', value: 'yuanbao-send-btn' },
    { type: 'xpath', value: "//button[contains(@class, 'send-btn')] | //a[contains(@class, 'send-btn')]" },
    // 最后的备用方案：兼容旧代码的最长 XPath
    { type: 'xpath', value: '//*[@id="app"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div/div[3]/div/div[4]/div/div/div[3]/div[2]/button' }
  ];
  const buttonElement = findElement(buttonSelectors);
  if (!buttonElement) {
    console.error("未找到发送按钮。");
    return false;
  }
  
  // 4. 延时后执行点击，确保输入事件被处理
  setTimeout(() => {
    if (!triggerClick(buttonElement)) {
      console.error("发送失败");
    } else {
      console.log("消息发送成功！");
    }
  }, 100);

  return true;
}

// 监听来自扩展程序后台的消息
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

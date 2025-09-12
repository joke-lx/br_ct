/**
 * @fileoverview
 * Claude.ai 聊天机器人内容脚本，用于与 Claude.ai 页面交互。
 * 改进版，增加重试机制和更健壮的选择器。
 */

// ==========================================================
//                     Helper Functions
// ==========================================================

// 通用 XPath 查找器
function getElementByXpath(xpath) {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch (e) {
    console.error(`XPath 表达式无效: ${xpath}`, e);
    return null;
  }
}

// 通用 CSS 查找器
function getElementByCss(selector) {
  try {
    return document.querySelector(selector);
  } catch (e) {
    console.error(`CSS 选择器无效: ${selector}`, e);
    return null;
  }
}

/**
 * 优化的查找器：按优先级依次尝试，并提供重试机制。
 * @param {Array<Object>} selectors - 包含 {type, value} 的选择器数组。
 * @param {number} retries - 重试次数。
 * @param {number} delay - 每次重试的延时（毫秒）。
 * @returns {Promise<Element>} - 成功找到元素则 resolve，否则 reject。
 */
function findElementWithRetry(selectors, retries = 5, delay = 200) {
  return new Promise((resolve, reject) => {
    const attemptFind = (count) => {
      for (const selector of selectors) {
        let el = null;
        if (selector.type === 'xpath') el = getElementByXpath(selector.value);
        else if (selector.type === 'css') el = getElementByCss(selector.value);
        else if (selector.type === 'id') el = document.getElementById(selector.value);

        if (el) {
          console.log(`Claude.ai: 成功使用 ${selector.type} 找到元素: ${selector.value}`);
          return resolve(el);
        }
      }

      if (count <= 0) {
        console.warn('Claude.ai: 所有选择器都未找到元素，重试已达上限。');
        return reject(new Error('元素查找失败'));
      }

      console.warn(`Claude.ai: 未找到元素，正在进行第 ${5 - count + 1} 次重试...`);
      setTimeout(() => attemptFind(count - 1), delay);
    };

    attemptFind(retries);
  });
}

// 触发输入元素的完整事件序列
function triggerInputEvents(element) {
  if (!element) return;
  const events = [
    new Event('input', { bubbles: true, cancelable: true }),
    new Event('change', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
    new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' })
  ];
  events.forEach(e => element.dispatchEvent(e));
}

// 更可靠的点击
function triggerClick(element) {
  if (!element || element.offsetParent === null || element.disabled) {
    console.warn('Claude.ai: 元素不可点击或已被禁用', element);
    return false;
  }
  try {
    element.click();
    return true;
  } catch (e) {
    console.error('Claude.ai: 点击失败', e);
    try {
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      element.dispatchEvent(ev);
      return true;
    } catch (e2) {
      console.error('Claude.ai: 鼠标事件点击也失败', e2);
      return false;
    }
  }
}

// ==========================================================
//                     Element Selectors
// ==========================================================

// 输入框选择器优先级
const inputSelectors = [
  // 新增：更通用的选择器
  { type: 'css', value: '.ProseMirror p' },
  { type: 'xpath', value: "//div[@contenteditable='true']/p" },
  { type: 'xpath', value: "//div[@aria-label='Write your prompt to Claude']//p" },
  { type: 'xpath', value: "//div[@role='textbox'][@contenteditable='true']//p" },
  // 保留原始的 XPath
  { type: 'xpath', value: '/html/body/div[3]/div[2]/main/div[2]/div/fieldset/div[1]/div[1]/div[1]/div/div/p[2]' },
];

// 发送按钮选择器优先级
const buttonSelectors = [
  // 新增：更通用的选择器
  { type: 'xpath', value: "//button[@aria-label='Send message']" },
  { type: 'css', value: 'button[data-testid="send-button"]' },
  { type: 'xpath', value: "//button[.//svg[contains(@viewBox, '0 0 24 24')]]" }, // 通过 SVG 图标定位
  { type: 'xpath', value: "//button[contains(@class, 'bg-accent-main')]" },
  // 保留原始的 XPath
  { type: 'xpath', value: '/html/body/div[3]/div[2]/main/div[2]/div/fieldset/div[1]/div[1]/div[2]/div[3]/div/button' },
];

// ==========================================================
//                     Main Logic
// ==========================================================

let isSending = false;

async function sendChatMessage(message) {
  if (isSending) {
    console.warn('Claude.ai: 正在发送消息，请勿重复操作');
    return false;
  }

  isSending = true;
  console.log('Claude.ai: 开始发送流程');

  try {
    // 1. 查找输入框，带重试
    const input = await findElementWithRetry(inputSelectors);
    
    // 2. 输入文本并触发事件
    input.textContent = message;
    triggerInputEvents(input);
    console.log('Claude.ai: 文本输入成功');

    // 3. 查找发送按钮，带重试
    const button = await findElementWithRetry(buttonSelectors);

    // 4. 延时后点击发送按钮
    // 延时是为了确保输入事件已经处理完毕，且按钮已变为可用状态
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (triggerClick(button)) {
      console.log('Claude.ai: 消息发送成功');
    } else {
      console.error('Claude.ai: 发送失败');
      return false;
    }

  } catch (e) {
    console.error(`Claude.ai: 发送流程失败 - ${e.message}`);
    return false;
  } finally {
    isSending = false;
    console.log('Claude.ai: 发送流程结束');
  }

  return true;
}

// ==========================================================
//                     Message Listener
// ==========================================================

if (window.location.hostname.includes('claude.ai')) {
  console.log('Claude.ai: 内容脚本已加载');

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'sendMessage') {
      console.log(`Claude.ai: 收到消息发送请求: "${req.message}"`);
      // 使用 async/await 确保 sendChatMessage 完成
      sendChatMessage(req.message).then(ok => {
        sendResponse({ status: ok ? 'success' : 'failed', platform: 'claude' });
      });
      // 返回 true 保持 sendResponse 端口开放，以便异步响应
      return true;
    }
  });
} else {
  console.warn('Claude.ai: 当前页面不是 Claude.ai，脚本未激活');
}
/**
 * @fileoverview
 * Claude.ai 聊天机器人内容脚本，用于与 Claude.ai 页面交互。
 * 特性：
 * 1. 多重选择器优先级查找元素（容错强）
 * 2. 支持 contenteditable 的 p 标签输入框
 * 3. 触发完整事件序列，确保框架同步
 * 4. 防重复发送机制
 * 5. 接收扩展后台消息并执行发送
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

// 优化的查找器：按优先级依次尝试
function findElement(selectors) {
  for (const selector of selectors) {
    let el = null;
    if (selector.type === 'xpath') el = getElementByXpath(selector.value);
    else if (selector.type === 'css') el = getElementByCss(selector.value);
    else if (selector.type === 'id') el = document.getElementById(selector.value);

    if (el) {
      console.log(`Claude.ai: 成功使用 ${selector.type} 找到元素: ${selector.value}`);
      return el;
    }
  }
  console.warn('Claude.ai: 所有选择器都未找到元素');
  return null;
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
//                     Element Finders
// ==========================================================

// 输入框选择器优先级
const inputSelectors = [
  { type: 'xpath', value: '/html/body/div[3]/div[2]/main/div[2]/div/fieldset/div[1]/div[1]/div[1]/div/div/p[2]' },
  { type: 'css', value: 'div[contenteditable="true"] p' },
  { type: 'xpath', value: "//div[@role='textbox'][@contenteditable='true']//p" },
  { type: 'xpath', value: "//div[@aria-label='Write your prompt to Claude']//p" },
  { type: 'css', value: '.ProseMirror p' },
  { type: 'xpath', value: "//fieldset//div//p[@contenteditable or parent::div[@contenteditable='true']]" }
];

// 发送按钮选择器优先级
const buttonSelectors = [
  { type: 'xpath', value: '/html/body/div[3]/div[2]/main/div[2]/div/fieldset/div[1]/div[1]/div[2]/div[3]/div/button' },
  { type: 'xpath', value: "//button[@aria-label='Send message']" },
  { type: 'xpath', value: "//button[.//svg//path[contains(@d,'M208.49,120.49a12,12,0,0,1-17,0L140,69V216')]]" },
  { type: 'css', value: 'button[aria-label="Send message"]' },
  { type: 'xpath', value: "//button[contains(@class, 'bg-accent-main')]" },
  { type: 'xpath', value: "//fieldset//button[last()]" }
];

// ==========================================================
//                     Main Logic
// ==========================================================

let isSending = false;

function sendChatMessage(message) {
  if (isSending) {
    console.warn('Claude.ai: 正在发送消息，请勿重复操作');
    return false;
  }

  const input = findElement(inputSelectors);
  if (!input) {
    console.error('Claude.ai: 未找到输入框');
    return false;
  }

  isSending = true;
  console.log('Claude.ai: 开始发送流程');

  try {
    input.textContent = message;
    triggerInputEvents(input);
  } catch (e) {
    console.error('Claude.ai: 输入失败', e);
    isSending = false;
    return false;
  }

  const button = findElement(buttonSelectors);
  if (!button) {
    console.error('Claude.ai: 未找到发送按钮');
    isSending = false;
    return false;
  }

  setTimeout(() => {
    if (triggerClick(button)) console.log('Claude.ai: 消息发送成功');
    else console.error('Claude.ai: 发送失败');

    isSending = false;
    console.log('Claude.ai: 发送流程结束');
  }, 150);

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
      const ok = sendChatMessage(req.message);
      sendResponse({ status: ok ? 'success' : 'failed', platform: 'claude' });
    }
    return true;
  });
} else {
  console.warn('Claude.ai: 当前页面不是 Claude.ai，脚本未激活');
}

/**
 * @fileoverview 
 * Google AI Studio (aistudio.google.com) 自动化适配脚本
 * 基于通用自动化架构适配
 */

// ========================================================== //
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
  // console.warn("当前轮次未找到元素"); // 减少日志噪音
  return null;
}

// 等待元素出现，支持重试机制，默认 5 秒超时
async function waitForElement(selectors, timeout = 5000, retryInterval = 100) {
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

// ========================================================== //
//                     输入 & 点击工具
// ========================================================== 

function triggerInputEvents(element) {
  if (!element) {
    console.warn("输入元素不存在，无法触发事件");
    return false;
  }
  
  try {
    // 针对 Angular/Material Textarea 的特定事件序列
    // 必须触发 input 事件，Angular 才会进行脏检查并启用 Run 按钮
    const events = [
      new Event("focus", { bubbles: true }),
      new Event("input", { bubbles: true, cancelable: true }),
      new Event("change", { bubbles: true, cancelable: true }),
      new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "ArrowRight" }), // 模拟一些键盘活动
      new Event("blur", { bubbles: true })
    ];
    
    events.forEach(event => {
      element.dispatchEvent(event);
    });
    
    console.log("Angular 输入事件触发成功");
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
  
  // 检查是否禁用 (Angular Material 按钮通常有 disabled 属性或 aria-disabled)
  if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
    console.warn("按钮处于禁用状态，无法点击 (可能是输入未被识别)", element);
    return false;
  }
  
  try {
    element.click();
    console.log("原生点击成功");
    return true;
  } catch (e) {
    console.warn("普通点击失败，尝试鼠标事件", e);
    try {
      const mouseEvent = new MouseEvent("click", { 
        bubbles: true, 
        cancelable: true, 
        view: window 
      });
      element.dispatchEvent(mouseEvent);
      console.log("鼠标事件点击成功");
      return true;
    } catch (e2) {
      console.error("所有点击方式都失败", e2);
      return false;
    }
  }
}

// ========================================================== //
//                     输入框 & 按钮选择器 (针对 AI Studio)
// ========================================================== 

const inputSelectors = [
  // 1. 最准确：通过 placeholder 属性 (根据你提供的 HTML)
  { type: 'css', value: 'textarea[placeholder="Start typing a prompt"]' },
  // 2. 通过组件结构 (ms-text-chunk 下的 textarea)
  { type: 'css', value: 'ms-text-chunk textarea' },
  // 3. 通过 XPath (aria-label)
  { type: 'xpath', value: '//textarea[@aria-label="Start typing a prompt"]' },
  // 4. 宽泛的 textarea 选择器 (作为最后手段)
  { type: 'css', value: 'textarea.textarea' }
];

const buttonSelectors = [
  // 1. 最准确：通过 aria-label "Run" (根据你提供的 HTML)
  { type: 'css', value: 'button[aria-label="Run"]' },
  // 2. 组件类名选择
  { type: 'css', value: 'ms-run-button button' },
  // 3. XPath 查找包含 Run 文本的按钮
  { type: 'xpath', value: "//button[.//span[contains(text(), 'Run')]]" },
  // 4. 你的原始路径的简化版
  { type: 'css', value: '.run-button' }
];

// ========================================================== //
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
  console.log("开始发送流程 (AI Studio)...");

  try {
    // 1. 找输入框
    console.log("正在查找输入框...");
    const inputElement = await waitForElement(inputSelectors, 5000, 200);
    if (!inputElement) {
      console.error("未找到输入框，发送失败");
      return false;
    }

    // 2. 输入内容并触发事件
    console.log("开始输入文本内容...");
    try {
      // 聚焦
      inputElement.focus();
      
      // AI Studio 使用 Textarea，直接修改 value
      inputElement.value = message;
      
      // 触发 Angular 脏检查
      if (!triggerInputEvents(inputElement)) {
        console.error("触发输入事件失败");
        return false;
      }
      
      console.log("文本输入完成");
    } catch (e) {
      console.error("输入文本失败", e);
      return false;
    }

    // 3. 等待按钮变为可用状态 (等待 Angular 响应输入事件解除 disabled)
    // 稍微等待一下让 Angular 处理 input 事件
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log("正在查找并等待 Run 按钮...");
    const buttonElement = await waitForElement(buttonSelectors, 3000, 200);
    
    if (!buttonElement) {
      console.error("未找到发送按钮");
      return false;
    }

    // 4. 执行点击
    console.log("准备点击运行...");
    if (triggerClick(buttonElement)) {
      console.log("消息发送(运行)成功");
      return true;
    } else {
      console.error("点击发送失败，按钮可能仍被禁用");
      return false;
    }

  } catch (e) {
    console.error("发送流程异常", e);
    return false;
  } finally {
    isSending = false; // 确保状态锁被释放
    console.log("发送流程结束");
  }
}

// ========================================================== //
//                     消息监听 & 环境检查
// ========================================================== 

const targetHostname = 'aistudio.google.com';

if (!window.location.hostname.includes(targetHostname)) {
  console.warn(`当前页面不是 ${targetHostname}，脚本未激活`);
} else {
  console.log(`${targetHostname} 内容脚本已加载并激活`);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage") {
      console.log(`收到消息发送请求: "${request.message}"`);
      
      sendChatMessage(request.message).then((success) => {
        sendResponse({
          status: success ? "success" : "failed",
          platform: "google-aistudio",
          timestamp: Date.now()
        });
      }).catch((error) => {
        sendResponse({
          status: "error",
          error: error.message
        });
      });
      
      return true; // 异步响应
    }
  });
}
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

// ==========================================================
//                     输入 & 点击工具
// ==========================================================
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
      const mouseEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
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

// ==========================================================
//                     通义千问 输入框 & 按钮选择器
// ==========================================================
const inputSelectors = [
  // 通义千问 textarea
  { type: "css", value: "textarea.ant-input.css-12jjqpr.ant-input-outlined.textarea-iXt_xk.fade-in-WLNZxg.mobile" },
  { 
    type: "xpath", 
    value: '//*[@id="tongyi-content-wrapper"]/div[1]/div[2]/div[1]/div[3]/div[2]/div[1]/div[1]/div[1]/div[1]/textarea[1]' 
  },
  { 
    type: "css", 
    value: "#tongyi-content-wrapper > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > textarea:nth-of-type(1)" 
  },
  { 
    type: "xpath", 
    value: '/html[1]/body[1]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[2]/div[1]/div[3]/div[2]/div[1]/div[1]/div[1]/div[1]/textarea[1]' 
  }
];

const buttonSelectors = [
  // 通义千问 发送按钮
  { type: "css", value: "div.operateBtn-JsB9e2" },
  { 
    type: "xpath", 
    value: '//*[@id="tongyi-content-wrapper"]/div[1]/div[2]/div[1]/div[3]/div[2]/div[1]/div[2]/div[3]/div[2]' 
  },
  { 
    type: "css", 
    value: "#tongyi-content-wrapper > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(2)" 
  },
  { 
    type: "xpath", 
    value: '/html[1]/body[1]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[2]/div[1]/div[3]/div[2]/div[1]/div[2]/div[3]/div[2]' 
  }
];

// ==========================================================
//                     主逻辑：发送消息（已修复输入激活问题）
// ==========================================================
let isSending = false; // 状态锁

async function sendChatMessage(message) {
  if (isSending) {
    console.warn("正在发送中，请勿重复操作");
    return false;
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
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

    // ========== 关键修复：激活输入框并注入文本 ==========
    console.log("正在激活输入框...");

    // 1. 点击激活（触发组件挂载/交互状态）
    triggerClick(inputElement);
    inputElement.focus(); // 显式聚焦

    // 2. 使用原生 value setter 设置内容（兼容 React 受控组件）
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    const finalMessage = message.trim();
    if (nativeSetter) {
      nativeSetter.call(inputElement, finalMessage);
    } else {
      // 回退方案（极少见）
      inputElement.value = finalMessage;
    }

    // 3. 派发标准 input 和 change 事件
    inputElement.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    inputElement.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

    console.log("✅ 输入内容已成功注入并激活");

    // ========== 查找并点击发送按钮 ==========
    console.log("正在查找发送按钮...");
    const buttonElement = await waitForElement(buttonSelectors, 5000, 100);
    if (!buttonElement) {
      console.error("未找到发送按钮");
      return false;
    }

    // 短暂等待确保输入被处理
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (triggerClick(buttonElement)) {
      console.log("✅ 消息发送成功");
      return true;
    } else {
      console.error("❌ 点击发送按钮失败");
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
if (!window.location.hostname.includes("tongyi")) {
  console.warn("当前页面不是通义千问，脚本未激活");
} else {
  console.log("通义千问内容脚本已加载并激活");

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage") {
      console.log(`收到消息发送请求: "${request.message}"`);

      sendChatMessage(request.message)
        .then((success) => {
          sendResponse({
            status: success ? "success" : "failed",
            platform: "tongyi",
            timestamp: Date.now(),
          });
          console.log(`消息处理完成，状态: ${success ? "success" : "failed"}`);
        })
        .catch((error) => {
          console.error("消息处理异常", error);
          sendResponse({
            status: "error",
            platform: "tongyi",
            error: error.message,
            timestamp: Date.now(),
          });
        });

      return true; // 表示将异步响应
    }

    console.warn("收到未知的消息类型", request);
    sendResponse({ status: "unknown_action" });
  });
}

/**
 * @fileoverview
 * 通义千问聊天机器人内容脚本 - 修复增强版
 * ✅ 已解决：输入后聚焦即清空的问题
 * ✅ 方法：先 click + focus 激活组件，再通过原生 value setter + input 事件注入内容
 * ✅ 兼容 React/Ant Design 受控输入框
 * ✅ 保留原有重试、状态锁、异步通信等健壮机制
 */
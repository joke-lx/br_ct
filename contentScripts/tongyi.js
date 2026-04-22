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

/**
 * 模拟真实键盘输入（一次性插入，使用 beforeinput 事件）
 * @param {Element} element - 目标输入元素
 * @param {string} text - 要输入的文本
 * @returns {Promise<boolean>}
 */
async function simulateKeyboardInput(element, text) {
  if (!element || !text) {
    console.warn("元素或文本为空");
    return false;
  }

  console.log(`开始模拟输入，文本长度: ${text.length}`);

  // 确保元素有焦点
  element.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 清空现有内容
  document.execCommand('selectAll', false, null);
  await new Promise((resolve) => setTimeout(resolve, 20));
  document.execCommand('delete', false, null);
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 创建 beforeinput 事件（现代编辑器使用）
  const beforeInputEvent = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,
  });

  // 触发 beforeinput 事件
  element.dispatchEvent(beforeInputEvent);

  // 使用 execCommand 一次性插入所有文本
  const success = document.execCommand('insertText', false, text);

  if (!success) {
    // 回退方案：直接设置 textContent
    console.warn("execCommand 失败，使用回退方案");
    element.textContent = text;
  }

  // 触发 input 事件
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,
  });
  element.dispatchEvent(inputEvent);

  // 触发 change 事件
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  // 触发 selectionchange
  document.dispatchEvent(new Event('selectionchange', { bubbles: true }));

  console.log(`✅ 输入完成，共 ${text.length} 个字符`);
  return true;
}

// ==========================================================
//          通义千问 输入框 & 按钮选择器 (2025-04 修复)
// ==========================================================
const inputSelectors = [
  // ==========================================================
  // 👇 【核心修复】新版千问使用 Slate 编辑器 (contenteditable div)
  // ==========================================================
  // 1. 最佳选择：通过 data-slate-editor 属性定位（2025-04 最新）
  {
    type: "css",
    value: 'div[data-slate-editor="true"]',
  },
  // 2. 通过 role="textbox" 和 contenteditable 属性定位
  {
    type: "css",
    value: 'div[role="textbox"][contenteditable="true"]',
  },
  // 3. 通过 placeholder 文本定位
  {
    type: "xpath",
    value: '//div[@data-placeholder="向千问提问"]',
  },
  // 3. 通过 placeholder 文本定位
  {
    type: "xpath",
    value: '//div[@data-placeholder="向千问提问"]',
  },
  // 4. 完整的 CSS 路径（基于用户提供的 HTML 结构）
  {
    type: "css",
    value: 'div.slateEditorWrapper-yF7NWU div[role="textbox"]',
  },
  // 5. XPath 备选方案
  {
    type: "xpath",
    value: '//div[@role="textbox"][@contenteditable="true"]',
  },
  // 6. 完整 XPath 路径
  {
    type: "xpath",
    value: '//*[@id="message-list-scroller"]/div[1]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]',
  },
  // 7. 绝对路径（最后备选）
  {
    type: "xpath",
    value: '/html[1]/body[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]',
  },

  // ==========================================================
  // 👇 旧版选择器（保留，优先级最低）
  // ==========================================================
  {
    type: "css",
    value: "#tongyi-content-wrapper textarea",
  },
  {
    type: "css",
    value: "textarea.ant-input",
  },
];

const buttonSelectors = [
  // ==========================================================
  // 👇 【新版】发送按钮选择器 (2025-04 修复)
  // ==========================================================
  // 1. 通过 aria-label 定位（最可靠）
  {
    type: "css",
    value: 'button[aria-label="发送消息"]',
  },
  // 2. 通过 bg-black-button 类名定位
  {
    type: "css",
    value: 'button.bg-black-button',
  },
  // 3. 通过 data-icon-type 定位
  {
    type: "css",
    value: 'button[data-icon-type="qwpcicon-sendChat"]',
  },
  // 4. 通过图标父级按钮定位
  {
    type: "xpath",
    value: '//span[@data-icon-type="qwpcicon-sendChat"]/ancestor::button',
  },
  // 5. 通过 #qw-chat-content 层级定位
  {
    type: "xpath",
    value: '//*[@id="qw-chat-content"]//button[@aria-label="发送消息"]',
  },
  // 6. 用户提供的最新 XPath
  {
    type: "xpath",
    value: '//*[@id="qw-chat-content"]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[3]/button[1]',
  },
  // 7. 绝对路径
  {
    type: "xpath",
    value: '/html[1]/body[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]/div[2]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/div[3]/button[1]',
  },

  // ==========================================================
  // 👇 旧版选择器（保留，优先级最低）
  // ==========================================================
  { type: "css", value: "div.operateBtn-JsB9e2" },
];

// ==========================================================
//                     主逻辑：发送消息（2025-04 修复版）
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

    // ========== 关键修复：针对 contenteditable 的输入处理 ==========
    console.log("正在激活输入框...");

    // 1. 点击激活并聚焦
    triggerClick(inputElement);
    inputElement.focus();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // 2. 检测元素类型并使用相应的方法
    const finalMessage = message.trim();
    const isContentEditable = inputElement.isContentEditable ||
                             inputElement.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      // ========== Contenteditable 元素处理（Slate 编辑器） ==========
      console.log("检测到 contenteditable 元素，使用 beforeinput 事件输入");

      // 清空现有内容
      inputElement.textContent = '';
      inputElement.focus();

      // 触发 beforeinput 事件（现代编辑器标准）
      const beforeInputEvent = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: finalMessage,
      });
      inputElement.dispatchEvent(beforeInputEvent);

      // 直接设置 textContent
      inputElement.textContent = finalMessage;

      // 触发 input 事件
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: finalMessage,
      });
      inputElement.dispatchEvent(inputEvent);

      // 触发 change 事件
      inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));

      console.log("✅ beforeinput 事件输入完成");

    } else {
      // ========== Textarea/Input 元素处理（旧版兼容） ==========
      console.log("检测到 textarea/input 元素，使用 value 属性");

      // 使用原生 value setter 设置内容（兼容 React 受控组件）
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(inputElement, finalMessage);
      } else {
        inputElement.value = finalMessage;
      }

      // 派发标准 input 和 change 事件
      inputElement.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true })
      );
      inputElement.dispatchEvent(
        new Event("change", { bubbles: true, cancelable: true })
      );
    }

    console.log("✅ 输入内容已成功注入并激活");

    // 等待输入被处理（Slate 编辑器需要更长的时间来更新按钮状态）
    await new Promise((resolve) => setTimeout(resolve, 500));

    // ========== 查找并点击发送按钮 ==========
    console.log("正在查找发送按钮...");
    const buttonElement = await waitForElement(buttonSelectors, 5000, 100);
    if (!buttonElement) {
      console.error("未找到发送按钮");
      return false;
    }

    // 检查按钮是否被禁用
    const checkButtonEnabled = () => {
      const buttonClass = buttonElement.className || '';
      return !buttonClass.includes('disabled') && !buttonElement.disabled;
    };

    // 如果按钮被禁用，等待其启用（最多重试 5 次，每次 200ms）
    let retryCount = 0;
    const maxRetries = 5;

    while (!checkButtonEnabled() && retryCount < maxRetries) {
      console.warn(`发送按钮仍处于禁用状态，等待启用... (${retryCount + 1}/${maxRetries})`);

      // 尝试重新触发 input 事件
      inputElement.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: finalMessage,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 200));
      retryCount++;
    }

    if (!checkButtonEnabled()) {
      console.error("发送按钮在重试后仍处于禁用状态，可能输入未生效");
      return false;
    }

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
if (!window.location.hostname.includes("qianwen")) {
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
 * 通义千问聊天机器人内容脚本 - 2025-04 修复版
 * ✅ 已解决：新版千问从 textarea 改为 Slate contenteditable 编辑器
 * ✅ 方法：使用 beforeinput 事件 + execCommand('insertText') 一次性注入
 * ✅ 已解决：按钮状态不随 DOM 操作变化的问题
 * ✅ 方法：触发现代编辑器的 beforeinput 事件（Slate 等编辑器使用）
 * ✅ 更新：输入框选择器适配新的 DOM 结构 (role="textbox", data-slate-editor)
 * ✅ 更新：按钮选择器适配新的图标定位方式 (data-icon-type="qwpcicon-sendChat")
 * ✅ 兼容：保留对旧版 textarea 的支持，自动降级
 * ✅ 保留：原有状态锁、异步通信等健壮机制
 *
 * 新版 DOM 结构：
 * - 输入框: div[role="textbox"][contenteditable="true"][data-placeholder="向千问提问"]
 * - 按钮: div[data-icon-type="qwpcicon-sendChat"] (在 operateBtn 父容器内)
 *
 * Slate 编辑器特殊处理：
 * - 触发 beforeinput 事件（现代编辑器标准）
 * - 使用 execCommand('insertText') 一次性插入全部文本
 * - 完整事件链：beforeinput -> insertText -> input -> change -> selectionchange
 * - 按钮启用重试机制，确保状态同步
 */

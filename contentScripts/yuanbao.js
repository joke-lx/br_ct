/**
 * @fileoverview
 * 重构的聊天机器人脚本 - 融合异步等待、重试机制和多选择器策略
 * 
 * 核心特性:
 * 1. 异步等待元素出现,支持超时和重试
 * 2. 混合使用 CSS、XPath、ID 选择器,按优先级查找
 * 3. 状态锁机制,防止重复发送
 * 4. 完整的错误处理和日志输出
 * 5. 智能延时和事件触发
 */

// ==========================================================
//                     通用查找器
// ==========================================================

/**
 * 统一的元素查找器 - 支持多种选择器类型
 * @param {Array<Object>} selectors - 选择器配置数组
 * @returns {Element|null} 找到的元素或 null
 */
function findElement(selectors) {
  for (const selector of selectors) {
    let element = null;
    
    try {
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
          console.warn(`未知的选择器类型: ${selector.type}`);
      }
      
      if (element) {
        console.log(`✓ 成功使用 ${selector.type} 找到元素: ${selector.value}`);
        return element;
      }
    } catch (e) {
      console.warn(`✗ ${selector.type} 选择器失败: ${selector.value}`, e.message);
    }
  }
  
  return null;
}

/**
 * 异步等待元素出现 - 支持超时和重试
 * @param {Array<Object>} selectors - 选择器配置数组
 * @param {number} timeout - 超时时间(毫秒)
 * @param {number} interval - 检查间隔(毫秒)
 * @returns {Promise<Element|null>} 找到的元素或 null
 */
async function waitForElement(selectors, timeout = 3000, interval = 100) {
  const startTime = Date.now();
  const endTime = startTime + timeout;
  
  return new Promise((resolve) => {
    const checkElement = () => {
      const element = findElement(selectors);
      
      if (element) {
        console.log(`⏱ 元素找到,耗时: ${Date.now() - startTime}ms`);
        resolve(element);
        return;
      }
      
      if (Date.now() >= endTime) {
        console.warn(`⏱ 等待超时(${timeout}ms),未找到元素`);
        resolve(null);
        return;
      }
      
      setTimeout(checkElement, interval);
    };
    
    checkElement();
  });
}

// ==========================================================
//                     输入 & 点击工具
// ==========================================================

/**
 * 触发输入元素的完整事件序列
 * @param {Element} element - 目标元素
 */
function triggerInputEvents(element) {
  if (!element) {
    console.warn('无法触发事件: 元素不存在');
    return;
  }
  
  // 触发多个事件以确保兼容性
  const events = ['input', 'change', 'keyup'];
  events.forEach(eventType => {
    const event = new Event(eventType, { 
      bubbles: true, 
      cancelable: true 
    });
    element.dispatchEvent(event);
  });
  
  console.log('✓ 输入事件已触发');
}

/**
 * 触发元素点击 - 带状态检查
 * @param {Element} element - 目标元素
 * @returns {boolean} 是否点击成功
 */
function triggerClick(element) {
  if (!element) {
    console.warn('✗ 元素不存在,无法点击');
    return false;
  }
  
  if (element.offsetParent === null) {
    console.warn('✗ 元素不可见,无法点击');
    return false;
  }
  
  if (element.disabled) {
    console.warn('✗ 元素已禁用,无法点击');
    return false;
  }
  
  try {
    element.click();
    console.log('✓ 点击事件已触发');
    return true;
  } catch (e) {
    console.error('✗ 点击失败:', e.message);
    return false;
  }
}

// ==========================================================
//                     主逻辑
// ==========================================================

let isSending = false; // 全局状态锁

/**
 * 主函数: 异步发送聊天消息
 * @param {string} message - 要发送的消息内容
 * @returns {Promise<boolean>} 发送是否成功
 */
async function sendChatMessage(message) {
  // 1. 状态锁检查
  if (isSending) {
    console.warn('🔒 正在发送中,请勿重复操作');
    return false;
  }
  
  isSending = true;
  console.log('🚀 开始发送流程,已锁定状态');
  console.log(`📝 消息内容: "${message}"`);
  
  try {
    // 2. 定义输入框选择器(按优先级排序)
    const inputSelectors = [
      // 优先级1: 通过 ID 直接定位
      { type: 'id', value: 'prompt-textarea' },
      
      // 优先级2: 通过 CSS 类定位 contenteditable
      { type: 'css', value: '.ql-editor[contenteditable="true"] p' },
      { type: 'css', value: '[contenteditable="true"] p' },
      
      // 优先级3: 通过 ARIA 属性定位
      { type: 'xpath', value: "//div[@role='textbox'][@contenteditable='true']" },
      { type: 'xpath', value: "//div[@role='textbox'][@contenteditable='true']/p" },
      
      // 优先级4: 通过类名定位
      { type: 'css', value: '.style__text-area__edit__content___JcgqO p' },
      { type: 'xpath', value: "//*[contains(@class, 'chat-input-editor')]//p" },
      
      // 优先级5: 通用 contenteditable
      { type: 'css', value: 'div[contenteditable="true"]' },
      { type: 'xpath', value: '//div[@contenteditable="true"]/p' },
      
      // 最后备选: 旧版复杂 XPath
      { type: 'xpath', value: '//*[@id="app"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div/div[3]/div/div[4]/div/div/div[2]/div[2]/div/div/div/p' }
    ];
    
    // 3. 等待输入框出现(最多3秒)
    console.log('⏳ 正在查找输入框...');
    const inputElement = await waitForElement(inputSelectors, 3000, 100);
    
    if (!inputElement) {
      console.error('❌ 未找到输入框元素');
      return false;
    }
    
    // 4. 输入文本内容
    console.log('📝 正在输入文本...');
    try {
      // 兼容多种输入元素类型
      if (inputElement.isContentEditable || inputElement.contentEditable === 'true') {
        inputElement.textContent = message;
      } else if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
        inputElement.value = message;
      } else {
        inputElement.textContent = message;
      }
      
      triggerInputEvents(inputElement);
      console.log('✓ 文本输入完成');
      
      // 等待输入处理完成
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      console.error('❌ 输入文本失败:', e.message);
      return false;
    }
    
    // 5. 定义发送按钮选择器(按优先级排序)
    const buttonSelectors = [
      // 优先级1: 通过 ID 直接定位
      { type: 'id', value: 'yuanbao-send-btn' },
      { type: 'id', value: 'composer-submit-button' },
      
      // 优先级2: 通过 ARIA 属性定位
      { type: 'xpath', value: "//button[@aria-label='Send message']" },
      { type: 'xpath', value: "//button[@aria-label='发送消息']" },
      
      // 优先级3: 通过类名定位
      { type: 'css', value: "button[class*='send-btn']" },
      { type: 'css', value: "button[class*='submit']" },
      { type: 'xpath', value: "//button[contains(@class, 'send-btn')]" },
      
      // 优先级4: 通用发送按钮
      { type: 'xpath', value: "//button[@type='submit']" },
      { type: 'css', value: 'button[type="submit"]' },
      
      // 最后备选: 旧版复杂 XPath
      { type: 'xpath', value: '//*[@id="app"]/div[1]/div[2]/div/div/div[1]/div/div[1]/div/div[3]/div/div[4]/div/div/div[3]/div[2]/button' }
    ];
    
    // 6. 等待发送按钮出现(最多3秒)
    console.log('⏳ 正在查找发送按钮...');
    const buttonElement = await waitForElement(buttonSelectors, 3000, 100);
    
    if (!buttonElement) {
      console.error('❌ 未找到发送按钮(可能被隐藏或禁用)');
      return false;
    }
    
    // 7. 延时点击发送按钮
    console.log('⏳ 准备点击发送按钮...');
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (triggerClick(buttonElement)) {
      console.log('✅ 消息发送成功!');
      return true;
    } else {
      console.error('❌ 点击发送按钮失败');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 发送过程出现异常:', error);
    return false;
    
  } finally {
    // 8. 无论成功失败,都要解锁状态
    setTimeout(() => {
      isSending = false;
      console.log('🔓 发送流程结束,已解锁状态');
    }, 500);
  }
}

// ==========================================================
//                     消息监听(Chrome 扩展)
// ==========================================================

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage") {
      console.log(`📨 收到消息发送请求: "${request.message}"`);
      
      sendChatMessage(request.message).then((success) => {
        sendResponse({
          status: success ? "success" : "failed",
          timestamp: new Date().toISOString()
        });
      }).catch((error) => {
        console.error('消息发送异常:', error);
        sendResponse({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      });
      
      return true; // 保持消息通道开启以支持异步响应
    }
  });
  
  console.log('✓ Chrome 扩展消息监听器已注册');
}

// ==========================================================
//                     调试工具
// ==========================================================

// 暴露到全局作用域,方便控制台调试
window.sendChatMessage = sendChatMessage;
window.findElement = findElement;
window.waitForElement = waitForElement;

console.log('✅ 聊天机器人脚本已加载');
console.log('💡 使用方法: sendChatMessage("你的消息内容")');
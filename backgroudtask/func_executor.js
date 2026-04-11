// func_executor.js

/**
 * 导出函数：执行指定目录下的脚本 funcs/${scriptFile}，并尝试调用其中的 main() 函数。
 * @param {string} scriptFile 要注入的脚本文件名 (例如: 'selector.js')
 * @param {function} sendResponse 异步响应函数
 */
export function executeFunctionScript(scriptFile, sendResponse) {
  // 获取当前活跃的标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      sendResponse({ status: "failed", message: "未找到活跃的标签页。" });
      return;
    }

    const tabId = tabs[0].id;

    // 1. 注入脚本文件 (funcs/xxx.js)
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: [`funcs/${scriptFile}`],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "通用函数脚本注入失败:",
            chrome.runtime.lastError.message
          );
          sendResponse({
            status: "failed",
            message: chrome.runtime.lastError.message,
          });
          return;
        }

        // 2. 注入成功后，执行一个函数，该函数会调用已注入的 main()
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            func: () => {
              // 在被注入的页面环境中调用 main() 函数
              if (typeof main === "function") {
                // 返回 main() 的结果（如果有的话）
                const result = main();
                return { status: "success", result: result };
              }
              return { status: "failed", message: "未找到 main() 函数。" };
            },
          },
          (results) => {
            if (
              chrome.runtime.lastError ||
              !results ||
              results[0].result.status === "failed"
            ) {
              const errorMsg =
                chrome.runtime.lastError?.message || results[0].result.message;
              console.error("main() 函数执行失败:", errorMsg);
              sendResponse({ status: "failed", message: errorMsg });
            } else {
              console.log(`成功执行 ${scriptFile} 中的 main() 函数。`);
              // 将 main() 的返回值传回给 Popup 或其他发起方
              sendResponse({
                status: "success",
                result: results[0].result.result,
              });
            }
          }
        );
      }
    );
  });
}

/**
 * 导出函数：设置消息监听器（处理函数执行相关的消息）
 */
export function setupMessageListener() {
  console.log('[Background] setupMessageListener 开始设置监听器');
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] 收到消息:', request.action, 'from:', sender.tab?.url || 'background');

    if (request.action === "executeFunctionScript") {
      // 处理通用脚本执行请求
      executeFunctionScript(request.file, sendResponse);
      return true;
    }

    // BindDom: 执行绑定点击
    if (request.action === "binddom.executeClick") {
      executeFunctionScript("元素dom/binddom/binddom_wrapper.js", sendResponse);
      return true;
    }

    // BindDom: 接收拾取器选择的结果
    if (request.action === "binddom.elementPicked") {
      console.log('[Background] BindDom 收到选择器:', request.selector, 'URL:', request.url);

      // 先立即响应，避免消息通道关闭问题
      sendResponse({ status: 'ok' });

      // 使用同步方式存储，确保写入完成
      const pendingData = {
        selector: request.selector,
        url: request.url,
        timestamp: Date.now()
      };
      console.log('[Background] 存储 pendingData:', pendingData);
      chrome.storage.local.set({ 'binddom.pending': pendingData }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Background] 存储失败:', chrome.runtime.lastError.message);
        } else {
          console.log('[Background] BindDom 已存储到 pending');
        }
      });

      // 通知所有标签页（popup 收不到，用 storage 机制）
      chrome.tabs.query({}, (tabs) => {
        console.log('[Background] 找到', tabs.length, '个标签页');
        tabs.forEach(tab => {
          try {
            const result = chrome.tabs.sendMessage(tab.id, {
              action: 'binddom.elementPicked',
              selector: request.selector,
              url: request.url
            });
            if (result && typeof result.catch === 'function') {
              result.catch(() => {});
            }
          } catch (e) {
            // 忽略发送失败（popup 等扩展页面没有 content script）
          }
        });
      });
      return true;
    }

    // BindDom: 直接添加绑定（拾取器调用）
    if (request.action === "binddom.addBinding") {
      console.log('[Background] BindDom 添加绑定:', request);

      // 使用 async 方式处理
      const addBinding = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get('binddom.bindings', (result) => {
            console.log('[Background] 读取现有绑定:', result);
            const bindings = result['binddom.bindings'] || [];

            // 添加新绑定
            bindings.push({
              url: request.url,
              selector: request.selector,
              desc: request.desc || '',
              timestamp: Date.now()
            });

            console.log('[Background] 保存新绑定:', bindings.length);

            // 保存
            chrome.storage.local.set({ 'binddom.bindings': bindings }, () => {
              if (chrome.runtime.lastError) {
                console.error('[Background] 添加绑定失败:', chrome.runtime.lastError.message);
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                console.log('[Background] 绑定已保存，共', bindings.length, '条');
                resolve({ success: true, count: bindings.length });
              }
            });
          });
        });
      };

      addBinding().then(result => {
        console.log('[Background] Promise resolved, sending response:', result);
        sendResponse(result);
        console.log('[Background] Response sent');
      }).catch(err => {
        console.error('[Background] Promise rejected:', err);
        sendResponse({ success: false, error: String(err) });
      });
      console.log('[Background] addBinding() called, waiting for Promise...');
      return true; // 保持消息通道开放
    }
  });
}

export function setupFuncCommandListener() {
  // 监听快捷键
  chrome.commands.onCommand.addListener((command) => {
    if (command === "execute_div_copy") {
      executeFunctionScript("元素dom/div_copy_wrapper.js", (response) => {
        console.log("快捷键执行结果:", response);
      });
    }
    if (command === "imgs_picker") {
      executeFunctionScript("元素dom/div_Img_wrapper.js", (response) => {
        console.log("快捷键执行结果:", response);
      });
    }
    if (command === "copy_file") {
      executeFunctionScript("元素dom/copy2file.js", (response) => {
        console.log("快捷键执行结果:", response);
      });
    }
  });
}

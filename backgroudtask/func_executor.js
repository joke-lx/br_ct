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
      sendResponse({ status: 'failed', message: '未找到活跃的标签页。' });
      return;
    }

    const tabId = tabs[0].id;

    // 1. 注入脚本文件 (funcs/xxx.js)
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [`funcs/${scriptFile}`]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("通用函数脚本注入失败:", chrome.runtime.lastError.message);
        sendResponse({ status: 'failed', message: chrome.runtime.lastError.message });
        return;
      }
      
      // 2. 注入成功后，执行一个函数，该函数会调用已注入的 main()
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // 在被注入的页面环境中调用 main() 函数
          if (typeof main === 'function') {
            // 返回 main() 的结果（如果有的话）
            const result = main(); 
            return { status: 'success', result: result };
          }
          return { status: 'failed', message: '未找到 main() 函数。' };
        }
      }, (results) => {
        if (chrome.runtime.lastError || !results || results[0].result.status === 'failed') {
          const errorMsg = chrome.runtime.lastError?.message || results[0].result.message;
          console.error("main() 函数执行失败:", errorMsg);
          sendResponse({ status: 'failed', message: errorMsg });
        } else {
          console.log(`成功执行 ${scriptFile} 中的 main() 函数。`);
          // 将 main() 的返回值传回给 Popup 或其他发起方
          sendResponse({ status: 'success', result: results[0].result.result });
        }
      });
    });
  });
}


export function setupFuncCommandListener() {
  // 监听快捷键
  chrome.commands.onCommand.addListener((command) => {
    if (command === "execute_div_copy") {
      executeFunctionScript("div_copy_wrapper.js", (response) => {
        console.log("快捷键执行结果:", response);
      });
    }
    if (command === "imgs_picker") {
      executeFunctionScript("div_Img_wrapper.js", (response) => {
        console.log("快捷键执行结果:", response);
      });
    }
  });
}

export function setTabTransListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openUrl') {
      const targetUrl = message.url;

      // 解析目标 URL 的域名和路径
      let targetDomain, targetPath;
      try {
        const urlObj = new URL(targetUrl);
        targetDomain = urlObj.hostname;
        // 使用 pathname 进行前缀匹配，它不包含查询参数和哈希
        targetPath = urlObj.pathname;
      } catch (e) {
        console.error("Invalid URL provided:", targetUrl, e);
        sendResponse({ status: 'error', message: 'Invalid URL' });
        return true; // 即使出错也返回 true，因为我们异步调用了 sendResponse
      }

      // 查询所有标签页
      chrome.tabs.query({}, (tabs) => {
        let existingTab = null;

        // 遍历所有标签页，寻找匹配的
        for (const tab of tabs) {
          // 忽略没有有效 URL 的标签页（如 chrome:// 页面）
          if (!tab.url || tab.url.startsWith('chrome://')) {
            continue;
          }

          try {
            const tabUrlObj = new URL(tab.url);
            
            // 1. 域名必须完全相同
            // 2. 目标路径必须是当前标签页路径的前缀
            //    例如：目标 /a/b 可以匹配 /a/b 和 /a/b?c=1，但不能匹配 /a
            if (tabUrlObj.hostname === targetDomain && tabUrlObj.pathname.startsWith(targetPath)) {
              existingTab = tab;
              break; // 找到第一个匹配的就可以停止了
            }
          } catch (e) {
            // 忽略无法解析的标签页 URL
            continue;
          }
        }

        if (existingTab) {
          // 如果找到匹配的标签页，则激活它
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });
          console.log(`Found existing tab for ${targetUrl}, activating tab ${existingTab.id}`);
        } else {
          // 否则，创建新标签页
          chrome.tabs.create({ url: targetUrl });
          console.log(`No existing tab found for ${targetUrl}, creating a new one.`);
        }
      });

      sendResponse({ status: 'ok' });
      return true; // 表示异步响应
    }
  });
}

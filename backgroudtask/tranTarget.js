

export function setTabTransListener() {
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openUrl') {
    const targetUrl = message.url;
    const targetDomain = new URL(targetUrl).hostname;

    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(tab => new URL(tab.url).hostname === targetDomain);
      if (existingTab) {
        chrome.tabs.update(existingTab.id, { active: true });
        chrome.windows.update(existingTab.windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });

    sendResponse({ status: 'ok' });
    return true; // 表示异步响应
  }
});
}
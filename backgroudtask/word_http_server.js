export function startServer() {
// background.js (MV3 service worker)
// 简单代理：接收 content script 的请求，向本地后端请求并返回结果。
// 注意：manifest.json 中已经声明 host_permissions ["http://localhost:8080/*"]

console.log("background service worker started");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== "fetchRandomWord") return;

  (async () => {
    try {
      // const res = await fetch("http://localhost:8901/random-word", {
      const res = await fetch("http://139.9.42.203:8901/random-word", {
        method: "GET",
        // 如果后端需要 cookie/credentials，可以考虑 credentials: 'include'
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        sendResponse({
          success: false,
          status: res.status,
          error: text || `status ${res.status}`
        });
        return;
      }

      // 尝试解析 JSON
      const json = await res.json().catch(() => null);
      sendResponse({ success: true, data: json });
    } catch (err) {
      sendResponse({ success: false, error: err && err.message ? err.message : String(err) });
    }
  })();

  // 返回 true 告诉 chrome 我们会异步调用 sendResponse
  return true;
});
}



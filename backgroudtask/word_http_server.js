export function startServer() {
// background.js (MV3 service worker)
// 简单代理：接收 content script 的请求，向本地后端请求并返回结果。
// 注意：manifest.json 中已经声明 host_permissions ["http://localhost:8080/*"]

console.log("background service worker started");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
   const domain = 'http://localhost:8901'
    
    // ------------------- (1) 随机单词处理 (原有) -------------------
    if (msg && msg.action === "fetchRandomWord") {
        (async () => {
            try {
                // 确保使用正确的地址
                const res = await fetch("http://localhost:8901/random-word", {
                    method: "GET",
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
    }
    
    // ------------------- (2) 收藏单词处理 (新增) -------------------
    if (msg && msg.action === "likeWord" && msg.word) {
        (async () => {
            try {
                const word = msg.word;
                // 注意：对 URL 路径中的单词进行编码，防止特殊字符导致路径错误
                const url = `http://localhost:8901/like/${encodeURIComponent(word)}`;
                
                const res = await fetch(url, {
                    method: "POST", // 收藏操作通常是 POST 或 PUT
                });

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    sendResponse({
                        success: false,
                        status: res.status,
                        error: text || `Status ${res.status} for liking ${word}`
                    });
                    return;
                }
                
                // 假设后端返回成功消息或空
                sendResponse({ success: true, message: `Word ${word} liked successfully.` });

            } catch (err) {
                sendResponse({ success: false, error: err.message || "Network error on liking." });
            }
        })();
        // 必须返回 true 来表示 sendResponse 将被异步调用
        return true; 
    }
});
}



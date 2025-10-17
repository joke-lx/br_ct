export function startServer() {
// background.js (MV3 service worker)
// 简单代理：接收 content script 的请求，向本地后端请求并返回结果。
// 注意：manifest.json 中已经声明 host_permissions ["链接*"]

console.log("background service worker started");

// 可配置的域名前缀 - 可以轻松替换为云服务地址
const domain = 'http://139.9.42.203:8901'; // 替换为你的云服务地址
// 如果需要切换回本地测试，可以改为：'http://localhost:8901'

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // ------------------- (1) 随机单词处理 (原有) -------------------
    if (msg && msg.action === "fetchRandomWord") {
        (async () => {
            try {
                // 使用配置的域名地址
                const res = await fetch(`${domain}/random-word`, {
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
                // 使用配置的域名地址
                const url = `${domain}/like/${encodeURIComponent(word)}`;
                
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
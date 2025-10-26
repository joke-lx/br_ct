// listener.js
// 在 background service worker 中使用

export function setupClipboardToFileListener() {
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'saveTextToFile') {
        try {
            // 创建 Blob URL
            const blob = new Blob([msg.text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            chrome.downloads.download({
                url: url,
                filename: msg.filename || 'clipboard.txt',
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, downloadId });
                }
                // 释放 URL
                URL.revokeObjectURL(url);
            });

            return true; // 保持异步通道
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
        return true;
    }
});

}
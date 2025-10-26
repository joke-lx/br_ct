const btn = document.getElementById('saveClipboardBtn');

btn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();

        // 生成 Blob URL
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        // 调用 chrome.downloads 下载
        chrome.downloads.download({
            url: url,
            filename: 'my_clipboard.txt',
            saveAs: true
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                alert('下载失败: ' + chrome.runtime.lastError.message);
            } else {
                alert('下载成功！downloadId: ' + downloadId);
            }
            URL.revokeObjectURL(url);
        });
    } catch (err) {
        alert('读取剪贴板失败: ' + err.message);
    }
});

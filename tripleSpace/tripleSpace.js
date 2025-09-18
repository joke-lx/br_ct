// tripleSpace.js
console.log("tripleSpace.js loaded");

// 三次空格触发
let spaceCount = 0;
let lastSpaceTime = 0;

document.addEventListener("keydown", function(e) {
    const now = Date.now();

    if (e.code === "Space") {
        if (now - lastSpaceTime < 500) { // 0.5 秒内连续
            spaceCount++;
        } else {
            spaceCount = 1;
        }
        lastSpaceTime = now;

        if (spaceCount === 3) {
            createPopupInput();
            spaceCount = 0;
            e.preventDefault();
        }
    } else {
        spaceCount = 0;
    }
});

// 创建弹出输入框
function createPopupInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const popup = document.createElement("div");
    popup.className = "triple-space-popup";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "输入内容...";
    popup.appendChild(input);

    // 添加发送按钮
    const sendBtn = document.createElement("button");
    sendBtn.textContent = "发送";
    sendBtn.style.marginLeft = "4px";
    sendBtn.style.cursor = "pointer";
    popup.appendChild(sendBtn);

    document.body.appendChild(popup);

    // 定位弹窗
    popup.style.left = rect.left + window.scrollX + "px";
    popup.style.top = rect.bottom + window.scrollY + "px";

    input.focus();

    // 核心发送函数
    const sendMessage = () => {
        const message = input.value.trim();
        if (!message) return;

        const defaultPlatforms = ['yuanbao', 'gemini', 'chatgpt'];
        const actionsQueue = defaultPlatforms.map(platform => ({ platform, message }));

        // 调用后台 AI 分布功能
        chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
            popup.remove();
        });
    };

    // 回车发送
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });

    // 点击发送按钮
    sendBtn.addEventListener("click", sendMessage);

    // 点击页面其他地方关闭弹窗
    const clickHandler = (ev) => {
        if (!popup.contains(ev.target)) {
            popup.remove();
            document.removeEventListener("click", clickHandler);
        }
    };
    document.addEventListener("click", clickHandler);
}

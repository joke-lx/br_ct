console.log("tripleSpace.js loaded");

let spaceCount = 0;
let lastSpaceTime = 0;
let currentMode = "message"; // "message" | "record"

document.addEventListener("keydown", function (e) {
    const now = Date.now();

    if (e.code === "Space") {
        if (now - lastSpaceTime < 500) {
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

function createPopupInput() {
    const selection = window.getSelection();
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range ? range.getBoundingClientRect() : { left: window.innerWidth / 2, bottom: window.innerHeight / 2 };

    const popup = document.createElement("div");
    popup.className = "triple-space-popup";

    // 顶部栏（模式切换 + 关闭）
    const header = document.createElement("div");
    header.className = "popup-header";

    const modeToggle = document.createElement("button");
    modeToggle.textContent = currentMode === "message" ? "切换到记录模式" : "切换到消息模式";
    modeToggle.className = "mode-toggle-btn";
    header.appendChild(modeToggle);

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "×";
    closeBtn.className = "close-btn";
    header.appendChild(closeBtn);

    popup.appendChild(header);

    // 输入区
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "输入内容...";
    popup.appendChild(input);

    // 发送按钮
    const sendBtn = document.createElement("button");
    sendBtn.textContent = "发送";
    sendBtn.className = "send-btn";
    popup.appendChild(sendBtn);

    document.body.appendChild(popup);

    popup.style.left = rect.left + window.scrollX + "px";
    popup.style.top = rect.bottom + window.scrollY + "px";

    input.focus();

    const sendMessage = () => {
        const message = input.value.trim();
        if (!message) return;

        if (currentMode === "message") {
            const defaultPlatforms = ['yuanbao', 'gemini', 'chatgpt'];
            const actionsQueue = defaultPlatforms.map(platform => ({ platform, message }));
            chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
                popup.remove();
            });
        } else {
            console.log("Sending record:", message);
            fetch("https://your-record-api.example.com/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message, time: Date.now() })
            }).then(() => popup.remove());
        }
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });
    sendBtn.addEventListener("click", sendMessage);

    modeToggle.addEventListener("click", () => {
        currentMode = currentMode === "message" ? "record" : "message";
        modeToggle.textContent = currentMode === "message" ? "切换到记录模式" : "切换到消息模式";
    });

    closeBtn.addEventListener("click", () => popup.remove());

    const clickHandler = (ev) => {
        if (!popup.contains(ev.target)) {
            popup.remove();
            document.removeEventListener("click", clickHandler);
        }
    };
    document.addEventListener("click", clickHandler);
}

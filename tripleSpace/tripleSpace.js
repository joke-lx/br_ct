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

    // 顶部栏（模式切换 + 固定按钮 + 关闭）
    const header = document.createElement("div");
    header.className = "popup-header";

    const modeToggle = document.createElement("button");
    modeToggle.textContent = currentMode === "message" ? "记录模式" : "消息模式";
    modeToggle.className = "mode-toggle-btn";
    modeToggle.title = currentMode === "message" ? "切换到记录模式" : "切换到消息模式";
    
    const modeStatus = document.createElement("span");
    modeStatus.className = `status-indicator ${currentMode === "message" ? "status-message" : "status-record"}`;
    modeStatus.textContent = currentMode === "message" ? "消息" : "记录";
    modeToggle.appendChild(modeStatus);
    
    const headerButtons = document.createElement("div");
    headerButtons.className = "header-buttons";
    
    const pinBtn = document.createElement("button");
    pinBtn.innerHTML = "📌";
    pinBtn.className = "pin-btn";
    pinBtn.title = "固定窗口";
    
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.className = "close-btn";
    closeBtn.title = "关闭窗口";
    
    headerButtons.appendChild(pinBtn);
    headerButtons.appendChild(closeBtn);
    
    header.appendChild(modeToggle);
    header.appendChild(headerButtons);
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

    // 初始位置
    popup.style.left = rect.left + window.scrollX + "px";
    popup.style.top = rect.bottom + window.scrollY + "px";

    input.focus();

    // 拖动功能实现
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isPinned = true; // 默认设置为固定状态
    
    header.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        if (e.target !== modeToggle && e.target !== pinBtn && e.target !== closeBtn) {
            isDragging = true;
            dragOffsetX = e.clientX - popup.getBoundingClientRect().left;
            dragOffsetY = e.clientY - popup.getBoundingClientRect().top;
            
            popup.style.cursor = "grabbing";
            popup.style.boxShadow = "0 6px 16px rgba(0,0,0,0.3)";
            
            // 开始拖动时临时移除外部点击监听器
            document.removeEventListener("click", clickHandler);
            
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
        }
    }
    
    function onDrag(e) {
        if (isDragging) {
            popup.style.left = (e.clientX - dragOffsetX) + 'px';
            popup.style.top = (e.clientY - dragOffsetY) + 'px';
        }
    }
    
    function stopDrag() {
        isDragging = false;
        popup.style.cursor = "move";
        popup.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        
        // 拖动结束后重新添加外部点击监听器
        if (!isPinned) {
            document.addEventListener("click", clickHandler);
        }
    }

    // 设置初始固定状态
    pinBtn.classList.add("pinned");
    pinBtn.title = "取消固定";
    popup.style.border = "2px solid #3498db"; // 固定状态的边框样式

    const sendMessage = () => {
        const message = input.value.trim();
        if (!message) return;

        if (currentMode === "message") {
            const defaultPlatforms = ['yuanbao', 'gemini', 'chatgpt'];
            const actionsQueue = defaultPlatforms.map(platform => ({ platform, message }));
            chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
                popup.remove();
                document.removeEventListener("click", clickHandler);
            });
        } else {
            console.log("Sending record:", message);
            fetch("https://your-record-api.example.com/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message, time: Date.now() })
            }).then(() => {
                popup.remove();
                document.removeEventListener("click", clickHandler);
            });
        }
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });
    sendBtn.addEventListener("click", sendMessage);

    modeToggle.addEventListener("click", () => {
        currentMode = currentMode === "message" ? "record" : "message";
        modeToggle.textContent = currentMode === "message" ? "记录模式" : "消息模式";
        modeToggle.title = currentMode === "message" ? "切换到记录模式" : "切换到消息模式";
        
        // 更新状态指示器
        const statusIndicator = modeToggle.querySelector('.status-indicator');
        statusIndicator.textContent = currentMode === "message" ? "消息" : "记录";
        statusIndicator.className = `status-indicator ${currentMode === "message" ? "status-message" : "status-record"}`;
    });

    // 固定按钮功能
    pinBtn.addEventListener("click", () => {
        isPinned = !isPinned;
        pinBtn.classList.toggle("pinned", isPinned);
        pinBtn.title = isPinned ? "取消固定" : "固定窗口";
        
        // 添加视觉反馈
        if (isPinned) {
            popup.style.border = "2px solid #3498db";
            // 固定状态下移除外部点击监听器
            document.removeEventListener("click", clickHandler);
        } else {
            popup.style.border = "1px solid #ccc";
            // 非固定状态下添加外部点击监听器
            document.addEventListener("click", clickHandler);
        }
    });

    closeBtn.addEventListener("click", () => {
        popup.remove();
        document.removeEventListener("click", clickHandler);
    });

    const clickHandler = (ev) => {
        if (!popup.contains(ev.target) && !isPinned) {
            popup.remove();
            document.removeEventListener("click", clickHandler);
        }
    };
    
    // 初始不添加外部点击监听器（因为默认固定）
}
console.log("tripleSpace.js loaded");

let spaceCount = 0;
let lastSpaceTime = 0;
let currentMode = "message"; // "message" | "record"
let activePopup = null; // 跟踪当前活跃的弹窗

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
    // 如果已有弹窗存在，先关闭它
    if (activePopup && document.body.contains(activePopup)) {
        activePopup.remove();
    }

    const selection = window.getSelection();
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    let rect;
    
    if (range) {
        rect = range.getBoundingClientRect();
    } else {
        // 如果没有选择文本，在鼠标位置或屏幕中心创建
        rect = { 
            left: window.innerWidth / 2 - 120, // 120是弹窗宽度的一半
            bottom: window.innerHeight / 2 
        };
    }

    const popup = document.createElement("div");
    popup.className = "triple-space-popup pinned"; // 默认添加pinned类
    activePopup = popup; // 设置为当前活跃弹窗

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
    pinBtn.className = "pin-btn pinned"; // 默认固定状态
    pinBtn.title = "取消固定";
    
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

    // 计算并设置初始位置（使用fixed定位，不需要加scrollX/scrollY）
    let initialLeft = rect.left;
    let initialTop = rect.bottom + 10; // 添加10px间距

    // 确保弹窗在可视区域内
    const popupRect = popup.getBoundingClientRect();
    if (initialLeft + popupRect.width > window.innerWidth) {
        initialLeft = window.innerWidth - popupRect.width - 10;
    }
    if (initialLeft < 10) {
        initialLeft = 10;
    }
    if (initialTop + popupRect.height > window.innerHeight) {
        initialTop = rect.top - popupRect.height - 10;
    }
    if (initialTop < 10) {
        initialTop = 10;
    }

    popup.style.left = initialLeft + "px";
    popup.style.top = initialTop + "px";

    input.focus();

    // 拖动功能实现
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isPinned = true; // 默认设置为固定状态
    let clickOutsideHandler = null;

    // 设置拖动事件
    header.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        // 只有在点击头部区域但不是按钮时才开始拖动
        if (e.target === modeToggle || e.target === pinBtn || e.target === closeBtn || 
            modeToggle.contains(e.target) || pinBtn.contains(e.target) || closeBtn.contains(e.target)) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        isDragging = true;
        const popupRect = popup.getBoundingClientRect();
        dragOffsetX = e.clientX - popupRect.left;
        dragOffsetY = e.clientY - popupRect.top;
        
        popup.classList.add("dragging");
        
        // 临时移除外部点击监听器
        if (clickOutsideHandler) {
            document.removeEventListener("click", clickOutsideHandler);
        }
        
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    function onDrag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;
        
        // 边界检测
        const popupRect = popup.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - popupRect.width));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - popupRect.height));
        
        popup.style.left = newLeft + 'px';
        popup.style.top = newTop + 'px';
    }
    
    function stopDrag(e) {
        if (!isDragging) return;
        
        isDragging = false;
        popup.classList.remove("dragging");
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        
        // 重新添加外部点击监听器（如果未固定）
        updateClickOutsideHandler();
        
        e.preventDefault();
        e.stopPropagation();
    }

    // 外部点击处理函数
    function createClickOutsideHandler() {
        return function(e) {
            // 添加延迟，避免与拖动冲突
            setTimeout(() => {
                if (!isPinned && !popup.contains(e.target) && document.body.contains(popup)) {
                    closePopup();
                }
            }, 0);
        };
    }

    function updateClickOutsideHandler() {
        // 移除旧的监听器
        if (clickOutsideHandler) {
            document.removeEventListener("click", clickOutsideHandler);
        }
        
        // 如果未固定，添加新的监听器
        if (!isPinned) {
            clickOutsideHandler = createClickOutsideHandler();
            // 延迟添加，避免立即触发
            setTimeout(() => {
                document.addEventListener("click", clickOutsideHandler);
            }, 100);
        }
    }

    function closePopup() {
        if (clickOutsideHandler) {
            document.removeEventListener("click", clickOutsideHandler);
        }
        if (document.body.contains(popup)) {
            popup.remove();
        }
        if (activePopup === popup) {
            activePopup = null;
        }
    }

    const sendMessage = () => {
        const message = input.value.trim();
        if (!message) return;

        if (currentMode === "message") {
            const defaultPlatforms = ['yuanbao', 'gemini', 'chatgpt'];
            const actionsQueue = defaultPlatforms.map(platform => ({ platform, message }));
            
            // 检查chrome.runtime是否可用
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ action: "processTaskQueue", queue: actionsQueue }, () => {
                    closePopup();
                });
            } else {
                console.log("Chrome runtime not available, message:", message);
                closePopup();
            }
        } else {
            console.log("Sending record:", message);
            // 这里可以添加记录功能的实际实现
            fetch("https://your-record-api.example.com/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message, time: Date.now() })
            }).then(() => {
                closePopup();
            }).catch(err => {
                console.log("Record saved locally:", message);
                closePopup();
            });
        }
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        } else if (e.key === "Escape") {
            closePopup();
        }
    });
    
    sendBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendMessage();
    });

    modeToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        currentMode = currentMode === "message" ? "record" : "message";
        modeToggle.textContent = currentMode === "message" ? "记录模式" : "消息模式";
        modeToggle.title = currentMode === "message" ? "切换到记录模式" : "切换到消息模式";
        
        // 更新状态指示器
        const statusIndicator = modeToggle.querySelector('.status-indicator');
        statusIndicator.textContent = currentMode === "message" ? "消息" : "记录";
        statusIndicator.className = `status-indicator ${currentMode === "message" ? "status-message" : "status-record"}`;
    });

    // 固定按钮功能
    pinBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isPinned = !isPinned;
        
        if (isPinned) {
            pinBtn.classList.add("pinned");
            pinBtn.title = "取消固定";
            popup.classList.add("pinned");
        } else {
            pinBtn.classList.remove("pinned");
            pinBtn.title = "固定窗口";
            popup.classList.remove("pinned");
        }
        
        updateClickOutsideHandler();
    });

    closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closePopup();
    });

    // 初始化外部点击监听器（默认固定状态下不需要）
    updateClickOutsideHandler();
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (activePopup && document.body.contains(activePopup)) {
        activePopup.remove();
    }
});
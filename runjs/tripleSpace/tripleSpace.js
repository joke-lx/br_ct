console.log("tripleSpace.js loaded - Quick Notes Mode");

// 状态变量
let spaceCount = 0;
let lastSpaceTime = 0;
let activeBar = null;
let notesData = [];

// 初始化：从 chrome.storage.local 加载笔记
function loadNotes(callback) {
    chrome.storage.local.get(['quickNotes'], (result) => {
        notesData = result.quickNotes || [];
        if (callback) callback();
    });
}

// 保存笔记到 chrome.storage.local
function saveNotesToStorage(callback) {
    chrome.storage.local.set({ quickNotes: notesData }, () => {
        if (callback) callback();
    });
}

// 三击空格监听
document.addEventListener("keydown", function (e) {
    const now = Date.now();

    if (e.code === "Space") {
        // 检查是否在可编辑元素中
        const target = e.target;
        const isEditable = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

        if (isEditable) return; // 在输入框中不触发

        if (now - lastSpaceTime < 500) {
            spaceCount++;
        } else {
            spaceCount = 1;
        }
        lastSpaceTime = now;

        if (spaceCount === 3) {
            loadNotes(() => createNotesBar());
            spaceCount = 0;
            e.preventDefault();
        }
    } else {
        spaceCount = 0;
    }
});

// 创建横向悬浮长条
function createNotesBar() {
    // 如果已存在长条，先移除
    if (activeBar && document.body.contains(activeBar)) {
        activeBar.remove();
    }

    // 创建容器
    const bar = document.createElement("div");
    bar.className = "notes-bar";
    activeBar = bar;

    // 加载保存的位置
    chrome.storage.local.get(['quickNotesBarPosition'], (result) => {
        if (result.quickNotesBarPosition) {
            try {
                const pos = result.quickNotesBarPosition;
                bar.style.left = pos.left + 'px';
                bar.style.top = pos.top + 'px';
                bar.style.transform = 'none';
            } catch (e) {
                console.error('Failed to load position:', e);
            }
        }
    });

    // 关闭按钮
    const closeBtn = document.createElement("div");
    closeBtn.className = "notes-close";
    closeBtn.innerHTML = "×";
    closeBtn.title = "关闭 (ESC)";
    bar.appendChild(closeBtn);

    // 输入容器
    const inputContainer = document.createElement("div");
    inputContainer.className = "notes-input-container";

    // 可编辑内容区域
    const content = document.createElement("div");
    content.className = "notes-content";
    content.contentEditable = true;
    inputContainer.appendChild(content);
    bar.appendChild(inputContainer);

    // 按钮组
    const actions = document.createElement("div");
    actions.className = "notes-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "notes-btn notes-btn-cancel";
    cancelBtn.textContent = "取消";
    cancelBtn.type = "button";

    const saveBtn = document.createElement("button");
    saveBtn.className = "notes-btn notes-btn-save";
    saveBtn.innerHTML = '<span>💾</span><span>保存</span>';
    saveBtn.type = "button";

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    bar.appendChild(actions);

    document.body.appendChild(bar);

    // 聚焦到输入区域
    setTimeout(() => content.focus(), 100);

    // 拖动功能
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    bar.addEventListener('mousedown', (e) => {
        // 不要在输入框、按钮上开始拖动
        if (e.target === content ||
            e.target === inputContainer ||
            e.target === closeBtn ||
            e.target.closest('.notes-btn') ||
            e.target.classList.contains('placeholder-chip')) {
            return;
        }

        isDragging = true;
        const rect = bar.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });

    function onDrag(e) {
        if (!isDragging) return;

        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;

        // 边界检测
        const rect = bar.getBoundingClientRect();
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

        bar.style.left = newLeft + 'px';
        bar.style.top = newTop + 'px';
        bar.style.transform = 'none';
    }

    function stopDrag() {
        if (!isDragging) return;

        isDragging = false;

        // 保存位置
        const rect = bar.getBoundingClientRect();
        const position = {
            left: rect.left,
            top: rect.top
        };
        chrome.storage.local.set({ quickNotesBarPosition: position });

        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // 监听输入，实时转换 "00" 为色块
    content.addEventListener("input", handleInput);

    // 监听按键
    content.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveNote();
        } else if (e.key === "Escape") {
            closeBar();
        }
    });

    // 按钮事件
    closeBtn.addEventListener("click", closeBar);
    cancelBtn.addEventListener("click", closeBar);
    saveBtn.addEventListener("click", saveNote);

    // 处理输入，转换 "00" 为色块
    function handleInput(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const textContent = content.textContent;

        // 检测到 "00" 输入
        if (textContent.includes("00")) {
            // 获取光标位置
            const cursorPosition = getCaretCharacterOffsetWithin(content);

            // 替换所有 "00" 为色块
            const newContent = content.textContent.replace(/00/g, 'PLACEHOLDER');

            // 清空并重新构建内容
            content.innerHTML = '';
            const parts = newContent.split('PLACEHOLDER');

            parts.forEach((part, index) => {
                if (part) {
                    content.appendChild(document.createTextNode(part));
                }
                if (index < parts.length - 1) {
                    const chip = createPlaceholderChip();
                    content.appendChild(chip);
                }
            });

            // 恢复光标位置
            setCaretPosition(content, cursorPosition);
        }
    }

    // 创建色块占位符
    function createPlaceholderChip() {
        const chip = document.createElement("span");
        chip.className = "placeholder-chip";
        chip.textContent = "";
        chip.contentEditable = "false";
        chip.dataset.placeholder = "%s";

        // 点击色块可以删除
        chip.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            chip.remove();
            content.focus();
        });

        return chip;
    }

    // 保存笔记
    function saveNote() {
        // 提取内容，将色块转换为 %s
        let noteContent = '';
        const childNodes = content.childNodes;

        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                noteContent += node.textContent;
            } else if (node.classList && node.classList.contains('placeholder-chip')) {
                noteContent += '%s';
            }
        });

        noteContent = noteContent.trim();

        if (!noteContent) {
            content.focus();
            return;
        }

        // 创建笔记对象
        const note = {
            id: Date.now().toString(),
            content: noteContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 添加到数据数组开头
        notesData.unshift(note);

        // 保存到 chrome.storage.local
        saveNotesToStorage(() => {
            // 显示成功动画
            bar.classList.add("success");
            setTimeout(() => {
                closeBar();
            }, 600);

            console.log("Note saved:", note);
        });
    }

    // 关闭长条
    function closeBar() {
        if (document.body.contains(bar)) {
            bar.remove();
        }
        activeBar = null;
    }
}

// 获取光标在可编辑区域中的字符位置
function getCaretCharacterOffsetWithin(element) {
    let caretOffset = 0;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
}

// 设置光标位置
function setCaretPosition(element, position) {
    const range = document.createRange();
    const selection = window.getSelection();

    let charCount = 0;
    let found = false;

    function traverseNodes(node) {
        if (found) return;

        if (node.nodeType === Node.TEXT_NODE) {
            const nextCount = charCount + node.length;
            if (position <= nextCount) {
                range.setStart(node, position - charCount);
                range.collapse(true);
                found = true;
            }
            charCount = nextCount;
        } else {
            for (let i = 0; i < node.childNodes.length && !found; i++) {
                traverseNodes(node.childNodes[i]);
            }
        }
    }

    traverseNodes(element);

    if (!found) {
        range.selectNodeContents(element);
        range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (activeBar && document.body.contains(activeBar)) {
        activeBar.remove();
    }
});

// 导出数据供其他模块使用
if (typeof window !== 'undefined') {
    window.QuickNotes = {
        getNotes: (callback) => {
            loadNotes(() => callback(notesData));
        },
        addNote: (content, callback) => {
            loadNotes(() => {
                const note = {
                    id: Date.now().toString(),
                    content: content,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                notesData.unshift(note);
                saveNotesToStorage(() => callback(note));
            });
        },
        updateNote: (id, newContent, callback) => {
            loadNotes(() => {
                const index = notesData.findIndex(n => n.id === id);
                if (index !== -1) {
                    notesData[index].content = newContent;
                    notesData[index].updatedAt = new Date().toISOString();
                    saveNotesToStorage(() => callback(notesData[index]));
                }
            });
        },
        deleteNote: (id, callback) => {
            loadNotes(() => {
                const index = notesData.findIndex(n => n.id === id);
                if (index !== -1) {
                    notesData.splice(index, 1);
                    saveNotesToStorage(() => callback(true));
                } else {
                    callback(false);
                }
            });
        }
    };
}

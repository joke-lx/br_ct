console.log("📘 English Trainer Content Script loaded");

// 向 background 请求单词
function requestWordFromBackend() {
    return new Promise((resolve) => {
        // 使用 chrome.runtime.sendMessage 向 background/service worker 发送消息
        // 请求一个随机单词
        chrome.runtime.sendMessage({ action: "fetchRandomWord" }, (resp) => {
            if (chrome.runtime.lastError) {
                // 如果出现错误，通常是脚本没有权限或 background/service worker 没有响应
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(resp);
        });
    });
}

let currentWordData = null; // 存储当前正在测试的单词数据
let inputElement = null; // 存储输入框 DOM 元素
let translationBox = null; // 存储翻译框 DOM 元素

// ** 新增/修改：用于 Backspace 三击检测的状态 **
let lastBackspaceTimes = []; // 存储最近的 Backspace 按下时间戳
const BACKSPACE_TIMEOUT = 400; // 两次 Backspace 之间的最大间隔（毫秒）
const TRIGGER_CLICKS = 3; // 触发次数

// ** 单词训练模式状态 **
let isTrainerModeActive = false;

/**
 * 创建并显示输入框，获取新单词
 */
async function createInputBox() {
    // 1. 清理现有元素（如果有）
    if (inputElement) inputElement.remove();
    inputElement = null;
    hideTranslation(); // 隐藏翻译框，确保是新的开始

    // 2. 获取单词数据
    const resp = await requestWordFromBackend();
    let randomWord = { en: "unknown", zh: "", phrases: [], translations: [] };

    if (resp && resp.success && resp.data) {
        const data = resp.data;
        randomWord.en = data.word || "unknown";
        // 提取翻译
        if (Array.isArray(data.translations)) {
            randomWord.translations = data.translations.map(t => {
                if (typeof t === "string") return t;
                if (t && typeof t === "object" && "translation" in t) return t.translation;
                return "";
            }).filter(Boolean);
        }
        // 提取短语
        if (Array.isArray(data.phrases)) {
            randomWord.phrases = data.phrases.map(p => {
                if (typeof p === "string") return p;
                if (p && typeof p === "object") {
                    const ph = p.phrase || "";
                    const tr = p.translation || "";
                    return ph && tr ? `${ph} → ${tr}` : ph || tr || "";
                }
                return "";
            }).filter(Boolean);
        }
    } else {
        // 本地回退词库
        const words = [
            { en: "apple", zh: "苹果" },
            { en: "banana", zh: "香蕉" },
            { en: "computer", zh: "电脑" },
            { en: "river", zh: "河流" },
            { en: "mountain", zh: "山" }
        ];
        const w = words[Math.floor(Math.random() * words.length)];
        randomWord.en = w.en;
        randomWord.translations = [w.zh];
        randomWord.phrases = [];
        console.warn("使用本地词库，原因：", resp && resp.error ? resp.error : "no response");
    }

    currentWordData = randomWord; // 更新当前单词数据

    // 3. 创建输入框
    inputElement = document.createElement("input");
    inputElement.type = "text";
    inputElement.placeholder = `${randomWord.en}`;
    
    // 设置样式
    inputElement.style.position = "fixed";
    // 随机位置（与原代码保持一致）
    inputElement.style.left = Math.random() * (window.innerWidth - 220) + "px";
    inputElement.style.top = Math.random() * (window.innerHeight - 60) + "px";
    
    inputElement.style.padding = "10px";
    inputElement.style.fontSize = "18px";
    inputElement.style.border = "2px solid #666";
    inputElement.style.borderRadius = "8px";
    inputElement.style.zIndex = 2147483647;
    inputElement.style.background = "rgba(255,255,255,0.95)";
    inputElement.style.outline = "none"; // 移除默认焦点轮廓
    
    document.body.appendChild(inputElement);
    inputElement.focus();
    
    // 4. 监听输入事件（input 事件在每次输入时触发）
    inputElement.addEventListener("input", handleWordInput);
}

/**
 * 处理输入框的输入事件，用于判断单词是否完整输入
 */
function handleWordInput() {
    if (!currentWordData || !inputElement) return;

    const inputValue = inputElement.value.trim().toLowerCase();
    const targetWord = currentWordData.en.toLowerCase();

    // 检查是否输入正确
    if (inputValue === targetWord) {
        console.log(`✅ Correct: ${currentWordData.en}`);
        
        // 成功输入，立即展示翻译结果
        inputElement.removeEventListener("input", handleWordInput); // 移除监听，防止重复触发
        inputElement.remove(); // 移除输入框
        inputElement = null;
        
        showTranslation(currentWordData);
        
        // 模式保持激活，等待任意键进入下一轮
        
    } else if (targetWord.startsWith(inputValue) && inputValue.length > 0) {
        // 正在输入中，是正确的前缀，边框设为正常
        inputElement.style.borderColor = "#666";
    } else if (inputValue.length >= targetWord.length) {
         // 输入长度达到或超过目标长度，但不正确，清空输入并提示错误
        inputElement.style.borderColor = "red";
        inputElement.value = ""; // 清空，让用户重新输入
    } else if (inputValue.length > 0 && !targetWord.startsWith(inputValue)) {
         // 输入了错误的字符，提示错误
         inputElement.style.borderColor = "orange";
    } else {
        // 输入为空
        inputElement.style.borderColor = "#666";
    }
}


/**
 * 显示翻译和短语信息框
 */
function showTranslation(wordData) {
    if (translationBox) translationBox.remove();
    
    translationBox = document.createElement("div");
    let content = `✅ ${wordData.en}\n`;
    
    if (Array.isArray(wordData.translations) && wordData.translations.length) {
        content += `翻译: ${wordData.translations.join(", ")}\n`;
    }
    if (Array.isArray(wordData.phrases) && wordData.phrases.length) {
        content += `短语:\n${wordData.phrases.join("\n")}`;
    }

    translationBox.textContent = content;
    translationBox.style.whiteSpace = "pre-line";
    translationBox.style.position = "fixed";
    translationBox.style.left = "50%";
    translationBox.style.top = "50%";
    translationBox.style.transform = "translate(-50%, -50%)";
    translationBox.style.background = "#222";
    translationBox.style.color = "#fff";
    translationBox.style.padding = "20px 40px";
    translationBox.style.borderRadius = "12px";
    translationBox.style.fontSize = "20px";
    translationBox.style.zIndex = 2147483647;
    translationBox.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    translationBox.id = "english-trainer-translation-box"; // 方便识别
    
    document.body.appendChild(translationBox);
}

/**
 * 隐藏翻译框
 */
function hideTranslation() {
    if (translationBox) {
        translationBox.remove();
        translationBox = null;
    }
}

/**
 * 退出训练模式，清理所有元素和状态
 */
function exitTrainerMode() {
    if (inputElement) {
        inputElement.removeEventListener("input", handleWordInput);
        inputElement.remove();
    }
    inputElement = null;
    hideTranslation();
    currentWordData = null;
    isTrainerModeActive = false;
    lastBackspaceTimes = []; // 重置三击状态
    console.log("❌ 英语学习脚本已退出模式。");
}

/**
 * 处理 Backspace 三击逻辑
 * @param {Event} e 键盘事件对象
 */
function handleBackspaceTripleClick(e) {
    const now = Date.now();
    
    // 1. 过滤掉超过时间间隔的旧记录
    lastBackspaceTimes = lastBackspaceTimes.filter(time => now - time < BACKSPACE_TIMEOUT);
    
    // 2. 添加当前时间
    lastBackspaceTimes.push(now);

    // 3. 检查是否达到三击次数
    if (lastBackspaceTimes.length >= TRIGGER_CLICKS) {
        // 如果输入框没有聚焦（即不是在输入时按 Backspace），则启动模式
        const activeEl = document.activeElement;
        const isInputFocus = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

        if (!isInputFocus && !isTrainerModeActive) {
            e.preventDefault(); // 阻止 Backspace 的默认行为 (如浏览器历史回退)
            isTrainerModeActive = true;
            lastBackspaceTimes = []; // 清空状态，避免重复触发
            console.log("🚀 Backspace 三击触发，进入英语学习模式！");
            createInputBox(); // 启动第一轮
            return true; // 触发成功
        }
        
        // 即使在输入框聚焦，也要清空状态，以保证只有快速的三击才有效
        // 并且避免在输入框中触发模式
        lastBackspaceTimes = [];
    }
    return false; // 未触发
}


/**
 * 全局键盘事件监听器 (启动/退出/下一轮)
 */
document.addEventListener("keydown", (e) => {
    // 1. ESC 退出模式
    if (e.key === "Escape") {
        if (isTrainerModeActive) {
            e.preventDefault(); // 阻止浏览器默认行为，如关闭全屏
            exitTrainerMode();
            return;
        }
    }

    // 2. Backspace 三击启动逻辑
    if (e.key === "Backspace" && !isTrainerModeActive) {
        // 尝试触发三击
        if (handleBackspaceTripleClick(e)) {
            // 如果成功启动，则在此处结束
            return;
        }
    }


    // 3. 训练模式激活时，任意键进入下一轮 (在翻译框显示时)
    // 检查是否有翻译框显示，且按下的不是功能键
    // 注意：这里的判断逻辑是为了排除 Alt, Ctrl, Shift, Meta 等修饰键，以及它们自身的键名
    if (isTrainerModeActive && translationBox && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key.length === 1 && e.key.toLowerCase() !== "escape") {
        e.preventDefault(); // 阻止其他可能影响页面的默认行为 (例如：按 'a' 会选中所有)
        // 隐藏翻译框，并加载下一个单词
        createInputBox();
        return;
    }
    
    // 针对用户可能按下的特殊键（例如：空格键 ' '），这些键长度不为 1，但可以用于进入下一轮
    if (isTrainerModeActive && translationBox && (e.key === " " || e.key === "Enter")) {
         e.preventDefault();
         createInputBox();
         return;
    }
});

console.log("✅ 英语学习脚本已加载！请在页面任意位置快速连按 Backspace 键 3 次启动。按 'Esc' 退出。");
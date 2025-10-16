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
    // 随机位置
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
    console.log("❌ 英语学习脚本已退出模式。");
}

// ** 移除 Backspace 三击逻辑 **

/**
 * 全局键盘事件监听器 (启动/退出/下一轮)
 */
document.addEventListener("keydown", (e) => {
    
    // 1. Alt + L 启动/切换模式
    // 注意：同时按下 Alt 和 L (或 l)
    if (e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault(); // 阻止 Alt+L 可能触发的浏览器默认行为（例如：菜单栏快捷键）
        
        if (isTrainerModeActive) {
            // 如果已经激活，Alt+L 视为退出
            exitTrainerMode();
        } else {
            // 启动模式
            isTrainerModeActive = true;
            console.log("🚀 Alt+L 组合键触发，进入英语学习模式！");
            createInputBox(); // 启动第一轮
        }
        return;
    }
    
    // 2. ESC 退出模式
    if (e.key === "Escape") {
        if (isTrainerModeActive) {
            e.preventDefault(); // 阻止浏览器默认行为，如关闭全屏
            exitTrainerMode();
            return;
        }
    }

    // 3. 训练模式激活时，任意键进入下一轮 (在翻译框显示时)
    // 检查是否有翻译框显示，且按下的不是修饰键
    const isModifierKey = e.altKey || e.ctrlKey || e.shiftKey || e.metaKey;
    const isNavigationKey = e.key.length > 1 && e.key !== " " && e.key !== "Enter";
    
    if (isTrainerModeActive && translationBox && !isModifierKey && !isNavigationKey) {
        e.preventDefault(); // 阻止其他可能影响页面的默认行为
        // 隐藏翻译框，并加载下一个单词
        createInputBox();
        return;
    }
    
});

console.log("✅ 英语学习脚本已加载！请快速连按 Alt + L 组合键启动/退出。按 'Esc' 退出。");
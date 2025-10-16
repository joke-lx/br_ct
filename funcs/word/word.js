// content.js
console.log("📘 English Trainer Content Script loaded");
function requestWordFromBackend() {
 return new Promise((resolve) => {
 chrome.runtime.sendMessage({ action: "fetchRandomWord" }, (resp) => {
 // 如果 chrome.runtime.lastError 存在，说明通信有问题
 if (chrome.runtime.lastError) {
 resolve({ success: false, error: chrome.runtime.lastError.message });
 return;
 }
 resolve(resp);
 });
 });
}
let current = null;
let input = null;
let translationBox = null;
let lastBackspace = 0;
async function createInputBox() {
 if (input) return;
 // 向 background 请求单词（如果本地后端不可用，会返回失败）
 const resp = await requestWordFromBackend();
 let randomWord;
 if (resp && resp.success && resp.data) {
 // 假设后端返回形如：{"phrases":[...],"translations":[...],"word":"investigate"}
 const data = resp.data;
 // 若后端返回单词字段为 word
 randomWord = { en: data.word || (data.word && data.word.en) || "unknown", zh: "" };
 // 优先使用 translations 或 phrases 提供的翻译（按你后端返回结构）
 if (Array.isArray(data.translations) && data.translations.length) {
 // 取第一个 translation 字段（示例结构可能是 {type: "vt", translation: "调查"}）
 randomWord.zh = data.translations[0].translation || "";
 } else if (Array.isArray(data.phrases) && data.phrases.length) {
 randomWord.zh = data.phrases[0].translation || "";
 } else {
 // fallback
 randomWord.zh = data.translation || "";
 }
 } else {
 // 无法从后端获取：回退到本地随机库
 const words = [
 { en: "apple", zh: "苹果" },
 { en: "banana", zh: "香蕉" },
 { en: "computer", zh: "电脑" },
 { en: "river", zh: "河流" },
 { en: "mountain", zh: "山" }
 ];
 randomWord = words[Math.floor(Math.random() * words.length)];
 console.warn("使用本地词库，原因：", resp && resp.error ? resp.error : "no response");
 }
 current = randomWord;
 input = document.createElement("input");
 input.type = "text";
 input.placeholder = 请输入单词: ${randomWord.en};
 input.style.position = "fixed";
 input.style.left = Math.random() * (window.innerWidth - 220) + "px";
 input.style.top = Math.random() * (window.innerHeight - 60) + "px";
 input.style.padding = "10px";
 input.style.fontSize = "18px";
 input.style.border = "2px solid #666";
 input.style.borderRadius = "8px";
 input.style.zIndex = 2147483647; // 更高的 zIndex
 input.style.background = "rgba(255,255,255,0.95)";
 document.body.appendChild(input);
 input.focus();
 input.addEventListener("keydown", (e) => {
 if (e.key === "Enter") {
 if (input.value.trim().toLowerCase() === current.en.toLowerCase()) {
 console.log(✅ Correct: ${current.en});
 showTranslation(current.zh || "（无翻译）");
 input.remove();
 input = null;
 } else {
 input.style.borderColor = "red";
 input.value = "";
 }
 }
 });
}
function showTranslation(zh) {
 if (translationBox) translationBox.remove();
 translationBox = document.createElement("div");
 translationBox.textContent = zh;
 translationBox.style.position = "fixed";
 translationBox.style.left = "50%";
 translationBox.style.top = "50%";
 translationBox.style.transform = "translate(-50%, -50%)";
 translationBox.style.background = "#222";
 translationBox.style.color = "#fff";
 translationBox.style.padding = "20px 40px";
 translationBox.style.borderRadius = "12px";
 translationBox.style.fontSize = "24px";
 translationBox.style.zIndex = 2147483647;
 translationBox.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
 document.body.appendChild(translationBox);
 setTimeout(() => {
 translationBox.remove();
 translationBox = null;
 }, 5000);
}
document.addEventListener("keydown", (e) => {
 if (e.key === "Backspace") {
 const now = Date.now();
 if (now - lastBackspace < 400) {
 createInputBox(); // 会异步请求后端
 }
 lastBackspace = now;
 }
});
// 立即告知用户脚本已加载（可选）
console.log("✅ 英语学习脚本已加载！双击 Backspace 召唤输入框。");
还有要对短语等字段进行展示
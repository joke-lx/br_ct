console.log("📘 English Trainer Content Script loaded");

// 向 background 请求单词
function requestWordFromBackend() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchRandomWord" }, (resp) => {
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

  const resp = await requestWordFromBackend();

  let randomWord = { en: "unknown", zh: "", phrases: [], translations: [] };

  if (resp && resp.success && resp.data) {
    const data = resp.data;
    randomWord.en = data.word || "unknown";

    if (Array.isArray(data.translations)) {
      randomWord.translations = data.translations.map(t => {
        if (typeof t === "string") return t;
        if (t && typeof t === "object" && "translation" in t) return t.translation;
        return "";
      }).filter(Boolean);
    }

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

  current = randomWord;

  input = document.createElement("input");
  input.type = "text";
  input.placeholder = `请输入单词: ${randomWord.en}`;
  input.style.position = "fixed";
  input.style.left = Math.random() * (window.innerWidth - 220) + "px";
  input.style.top = Math.random() * (window.innerHeight - 60) + "px";
  input.style.padding = "10px";
  input.style.fontSize = "18px";
  input.style.border = "2px solid #666";
  input.style.borderRadius = "8px";
  input.style.zIndex = 2147483647;
  input.style.background = "rgba(255,255,255,0.95)";
  document.body.appendChild(input);

  input.focus();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (input.value.trim().toLowerCase() === current.en.toLowerCase()) {
        console.log(`✅ Correct: ${current.en}`);
        showTranslation(current);
        input.remove();
        input = null;
      } else {
        input.style.borderColor = "red";
        input.value = "";
      }
    }
  });
}

function showTranslation(wordData) {
  if (translationBox) translationBox.remove();

  translationBox = document.createElement("div");

  let content = ` ${wordData.en}\n`;

  if (Array.isArray(wordData.translations) && wordData.translations.length) {
    content += `翻译: ${wordData.translations.join(", ")}\n`;
  }

  if (Array.isArray(wordData.phrases) && wordData.phrases.length) {
    content += `短语:\n${wordData.phres.join("\n")}`;
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
  document.body.appendChild(translationBox);

  setTimeout(() => {
    translationBox.remove();
    translationBox = null;
  }, 7000);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Backspace") {
    const now = Date.now();
    if (now - lastBackspace < 400) {
      createInputBox();
    }
    lastBackspace = now;
  }
});

console.log("✅ 英语学习脚本已加载！双击 Backspace 召唤输入框。");

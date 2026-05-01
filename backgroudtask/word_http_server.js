export function startServer() {
console.log("background service worker started (word module)");

// ==========================================================
//                     本地伪数据
// ==========================================================

const LOCAL_WORDBOOK = [
    { word: "paradigm", translations: ["范式", "样板", "典范"], phrases: [{ phrase: "paradigm shift", translation: "范式转变" }, { phrase: "a new paradigm", translation: "一种新范式" }] },
    { word: "ubiquitous", translations: ["无处不在的", "普遍存在的"], phrases: [{ phrase: "ubiquitous computing", translation: "普适计算" }, { phrase: "ubiquitous presence", translation: "无处不在" }] },
    { word: "eloquent", translations: ["雄辩的", "口才好的"], phrases: [{ phrase: "eloquent speech", translation: "雄辩演讲" }, { phrase: "visually eloquent", translation: "视觉动人" }] },
    { word: "resilient", translations: ["有韧性的", "复原力强的"], phrases: [{ phrase: "resilient material", translation: "弹性材料" }, { phrase: "psychologically resilient", translation: "心理坚韧" }] },
    { word: "pragmatic", translations: ["务实的", "实用主义的"], phrases: [{ phrase: "pragmatic approach", translation: "务实方法" }, { phrase: "pragmatic solutions", translation: "可行方案" }] },
    { word: "ambiguous", translations: ["模糊的", "不明确的"], phrases: [{ phrase: "ambiguous statement", translation: "含糊声明" }, { phrase: "highly ambiguous", translation: "非常模糊" }] },
    { word: "meticulous", translations: ["一丝不苟的", "极仔细的"], phrases: [{ phrase: "meticulous planning", translation: "细致计划" }, { phrase: "meticulous attention", translation: "精益求精" }] },
    { word: "profound", translations: ["深刻的", "意义深远的"], phrases: [{ phrase: "profound impact", translation: "深远影响" }, { phrase: "profound knowledge", translation: "渊博知识" }] },
    { word: "inevitable", translations: ["不可避免的", "必然的"], phrases: [{ phrase: "inevitable conclusion", translation: "必然结论" }, { phrase: "seemingly inevitable", translation: "看似必然" }] },
    { word: "scrutinize", translations: ["仔细检查", "详细审查"], phrases: [{ phrase: "scrutinize documents", translation: "审查文件" }, { phrase: "closely scrutinize", translation: "密切审视" }] },
    { word: "hypothesis", translations: ["假设", "假说"], phrases: [{ phrase: "test hypothesis", translation: "检验假设" }, { phrase: "formulate hypothesis", translation: "提出假设" }] },
    { word: "synthesis", translations: ["综合", "合成"], phrases: [{ phrase: "data synthesis", translation: "数据综合" }, { phrase: "protein synthesis", translation: "蛋白质合成" }] },
    { word: "correlation", translations: ["相关性", "关联"], phrases: [{ phrase: "positive correlation", translation: "正相关" }, { phrase: "correlation coefficient", translation: "相关系数" }] },
    { word: "phenomenon", translations: ["现象", "奇迹"], phrases: [{ phrase: "natural phenomenon", translation: "自然现象" }, { phrase: "social phenomenon", translation: "社会现象" }] },
    { word: "hierarchy", translations: ["等级制度", "层级"], phrases: [{ phrase: "social hierarchy", translation: "社会等级" }, { phrase: "management hierarchy", translation: "管理层级" }] },
    { word: "algorithm", translations: ["算法", "计算程序"], phrases: [{ phrase: "sorting algorithm", translation: "排序算法" }, { phrase: "machine learning algorithm", translation: "机器学习算法" }] },
    { word: "infrastructure", translations: ["基础设施", "公共建设"], phrases: [{ phrase: "transportation infrastructure", translation: "交通基础设施" }, { phrase: "digital infrastructure", translation: "数字基础设施" }] },
    { word: "sustainable", translations: ["可持续的", "能维持的"], phrases: [{ phrase: "sustainable development", translation: "可持续发展" }, { phrase: "environmentally sustainable", translation: "环境可持续" }] },
    { word: "comprehensive", translations: ["全面的", "综合的"], phrases: [{ phrase: "comprehensive analysis", translation: "全面分析" }, { phrase: "comprehensive review", translation: "综合审查" }] },
    { word: "empirical", translations: ["经验主义的", "以经验为依据的"], phrases: [{ phrase: "empirical research", translation: "实证研究" }, { phrase: "empirical evidence", translation: "经验证据" }] }
];

let lastWordIndex = -1;

function getRandomWordLocal() {
    let index;
    do {
        index = Math.floor(Math.random() * LOCAL_WORDBOOK.length);
    } while (index === lastWordIndex && LOCAL_WORDBOOK.length > 1);
    lastWordIndex = index;
    return LOCAL_WORDBOOK[index];
}

// ==========================================================
//                     消息监听
// ==========================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "fetchRandomWord") {
        sendResponse({ success: true, data: getRandomWordLocal() });
        return true;
    }

    if (msg && msg.action === "likeWord" && msg.word) {
        sendResponse({ success: true, message: `Word ${msg.word} liked` });
        return true;
    }
});
}
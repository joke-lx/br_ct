# 平台剪贴板捕获系统状态

## 已完成的平台（4个）
| 平台 | config | responseListener | 特点 |
|------|--------|-----------------|------|
| ChatGPT | ✅ chatgpt.js | ✅ chatgptResponseListener.js | 按钮在 turn 内 |
| Claude | ✅ claude.js | ✅ claudeResponseListener.js | 按钮在 turn 外，需 getCopyBtnRoot |
| Gemini | ✅ gemini.js | ✅ geminiResponseListener.js | 按钮在 turn 内 |
| 豆包 | ✅ doubao.js | ✅ doubaoResponseListener.js | 按钮在 turn 外 |

## 待配置的平台（11个）
| 平台 | contentScript 状态 | DOM 线索 | 策略 |
|------|-------------------|----------|------|
| 元宝 | ✅ yuanbao.js | 输入框 #prompt-textarea | 需先登录腾讯系 |
| 智谱 | ✅ glm.js | 需分析 | 需浏览器加载 |
| GAS | ✅ googlestudio.js | 需分析 | 需浏览器加载 |
| 通义 | ✅ tongyi.js | 需分析 | 需浏览器加载 |
| Grok | ✅ grok.js | 需分析 | 需浏览器加载 |
| NotionAI | ✅ notionai.js | 需分析 | 需浏览器加载 |
| Zai | ✅ zai.js (?) | 需分析 | 新平台 |
| DeepSeek | 需确认 | 需分析 | 需浏览器加载 |
| Kimi | 需确认 | 需分析 | 需浏览器加载 |
| CoderQwen | 需确认 | 需分析 | 需浏览器加载 |
| Coze | 需确认 | 需分析 | 需浏览器加载 |

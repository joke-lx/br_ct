# Chrome Extension 架构设计规范

## 概述

本 skill 记录 Bro Chat 扩展开发中的架构决策、正确案例和错误案例，供后续开发参考。

---

## 一、ai_platform_processor.js 架构

### 1.1 核心设计原则

**单注入路径 + 幂等分发**

```
setupTabUpdateListener          → 用户自己打开 Tab 时自动注入
    ↓
processSingleTask              → 任务触发时只发消息，不注入
    ↓
findOrCreatePlatformTab        → 三层查找：已注入 → 已存在 → 创建
```

### 1.2 Tab 注入记录结构

```javascript
// platform → Set<tabId>  优于  tabId → Set<platform>
// 查询"该平台已注入哪些Tab"是主路径，反向索引更高效
const injectedTabs = new Map(); // platform -> Set<tabId>
```

**错误案例：用 tabId 作为 Map 的 key**

```javascript
// ❌ 错误：查询"该平台已注入哪些Tab"需要遍历全量 tabId
const injectedTabs = new Map(); // tabId -> Set<platform>

// ✅ 正确：直接查该平台已注入的 Tab
const injectedTabs = new Map(); // platform -> Set<tabId>
function getInjectedTab(platform) {
  if (!hasInjected(platform)) return null;
  const tabIds = [...injectedTabs.get(platform)];
  return tabIds[0] || null;
}
```

### 1.3 findOrCreatePlatformTab 三层查找

```javascript
async function findOrCreatePlatformTab(platform, isFirst = false, shouldJump = true) {
  const targetUrl = platformUrls[platform];

  // 1. 优先复用已注入的 Tab（内存记录）
  const injectedTabId = getInjectedTab(platform);
  if (injectedTabId !== null) {
    try {
      const tab = await chrome.tabs.get(injectedTabId);
      if (shouldJump) await chrome.tabs.update(tab.id, { active: true });
      return tab;
    } catch (e) { /* Tab 已失效 */ }
  }

  // 2. 查找已存在的匹配 Tab（SW 重启后内存丢失，tabs.query 兜底）
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(tab => tab.url && tab.url.includes(targetUrl));
  if (existing) {
    if (shouldJump) await chrome.tabs.update(existing.id, { active: true });
    return existing;
  }

  // 3. 创建新 Tab
  return chrome.tabs.create({ url: targetUrl, active: isFirst });
}
```

### 1.4 跳转逻辑

**需求**：用户打开 A、B、C 三个 Tab，选了 B+C，优先跳 B（不在已选范围内）；当前在 C 时选 B+C 不跳转（已在范围内）。

```javascript
// 记录当前活跃 Tab
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
const selectedPlatforms = queue.map(t => t.platform);
const activeTabMatches = activeTab && selectedPlatforms.some(p => {
  const url = platformUrls[p];
  return url && activeTab.url && activeTab.url.includes(url);
});

// 活跃页不在已选平台范围内才跳转
shouldJump: !activeTabMatches
```

**错误案例：只有第一个任务跳转，其余静默**

```javascript
// ❌ 错误：所有任务都只在 isFirst=true 时才激活，用户看不到跳转
active: isFirst // 只有第一个任务激活

// ✅ 正确：第一个任务跳转（isFirst=true），其余静默
active: isFirst
```

### 1.5 双注入路径竞态

| 路径 | 触发时机 |
|-----|---------|
| `setupTabUpdateListener` | Tab 加载完成时自动注入 |
| `processSingleTask` | 任务触发时注入（现已移除，改为纯发消息） |

```javascript
// setupTabUpdateListener 中用 hasInjected 防重
if (hasInjected(platform)) {
  console.log(`[${platform}] Tab ${tabId} 已注入，跳过`);
  return;
}
injectScript(tabId, platform);
```

**教训**：双注入路径必须用幂等检查，禁止用锁机制。

---

## 二、内容脚本输入重复问题（kimi.js）

### 2.1 问题现象

发送 "123" → 输入框出现 "123123" 或 "123123123"

### 2.2 根因分析

| 根因 | 错误代码 | 问题 |
|-----|---------|------|
| 根因1 | `simulateContenteditableInput` + `triggerInputEvents` 重复触发 | `focus` + `input` + `change` 事件被触发两次 |
| 根因2 | `waitForButtonEnabled` 重试循环里每次 `dispatchEvent(InputEvent with data)` | 每次重试都重新向 Lexical 插入文本 |
| 根因3 | `beforeinput(data)` + `execCommand('insertText')` + `input(data)` 三次插入 | beforeinput 让 Lexical 插入一次，input 又带 data 导致 Lexical 二次消费 |

### 2.3 正确方案

```javascript
// simulateContenteditableInput：只发 beforeinput 让 Lexical 自己插入，input 不带 data
async function simulateContenteditableInput(element, text) {
  element.focus();
  await delay(50);

  document.execCommand('selectAll', false, null);
  await delay(30);

  // beforeinput 带 data：Lexical 从 data 中获取文本插入
  const beforeInputEvent = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,  // ✅ Lexical 从这里获取文本
  });
  element.dispatchEvent(beforeInputEvent);

  // input 不带 data：只通知内容已变化，不重复插入
  element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  // ✅ 不带 data，避免 Lexical 二次消费

  return true;
}

// waitForButtonEnabled 重试：只发无 data 的 input 事件
for (let i = 0; i < maxRetries; i++) {
  inputElement.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    // ✅ 不带 data，只触发状态检查，不重新插入
  }));
  await delay(retryInterval);
}
```

### 2.4 核心教训

> **对有内置编辑器的网站（Lexical、ProseMirror、Slate），必须先确认其事件监听器行为。禁止堆叠多个插入方案。**

---

## 三、常见错误案例

### 3.1 内容脚本缺少守卫

```javascript
// ❌ kimi.js 没有 window.kimiInjected 守卫
// 导致刷新或 SW 重启后可能重复注入

// ✅ 每个内容脚本头部加守卫
if (window.kimiInjected) return;
window.kimiInjected = true;
```

### 3.2 URL 匹配用 includes 太宽泛

```javascript
// ❌ "https://yuanbao.com" 会误匹配 "https://yuanbao.com/chat"
if (url.includes(platformUrl))

// ✅ 用 startsWith 或 URL 对象比较
if (url.startsWith(platformUrl))
```

### 3.3 SW 重启后 injectedTabs 丢失

```javascript
// ❌ 只依赖内存 Map
const injectedTabs = new Map(); // SW 重启后丢失

// ✅ 用 tabs.query 兜底（已有 Tab 仍存在，只是内存记录丢了）
const existing = tabs.find(tab => tab.url && tab.url.includes(targetUrl));
```

---

## 四、验证检查清单

每次提交前确认：

- [ ] 内容脚本有 `window.{platform}Injected` 守卫
- [ ] `injectedTabs` 用 `platform → Set<tabId>` 结构
- [ ] `findOrCreatePlatformTab` 有三层查找逻辑
- [ ] 跳转逻辑判断 `activeTabMatches`
- [ ] Lexical/编辑器输入只用一种插入方案，不堆叠
- [ ] 重试逻辑不发带 `data` 的 `input` 事件
- [ ] URL 匹配用 `startsWith` 而非 `includes`

---

## 五、相关文件

- `backgroudtask/ai_platform_processor.js` — 核心处理器
- `contentScripts/kimi.js` — Lexical 编辑器输入案例
- `contentScripts/notionai.js` — 参考实现

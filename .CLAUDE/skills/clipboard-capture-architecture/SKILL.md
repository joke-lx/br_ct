---
name: clipboard-capture-architecture
description: 当需要理解或排查剪贴板捕获问题，或为新平台适配剪贴板捕获时使用。涵盖原型层替换 vs DOM 事件捕获的根本差异、simulateCopy 点击策略、各平台适配细节
---

# 浏览器剪贴板拦截与模拟点击 — 通用技术原理

## 场景

需要在用户无感知的情况下，拦截 AI 平台（或任意 Web 应用）的"复制"行为，获取复制的内容（含 HTML 格式），并转发到自己的扩展/应用中。

## 两条技术路径

### 路径 A：navigator.clipboard.write 原型替换（推荐，一次性解决）

**核心原理**：在页面主世界（main world）替换 `navigator.clipboard` 原型链上的 `write` / `writeText` 方法。

```js
var proto = Object.getPrototypeOf(navigator.clipboard);
Object.defineProperty(proto, 'write', {
  value: async function(items) {
    // 1. 读取 ClipboardItem 内容（不需要真实剪贴板权限）
    var html = null, text = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].types.includes('text/html')) {
        var b = await items[i].getType('text/html');
        html = await b.text();
      }
      if (items[i].types.includes('text/plain')) {
        var b = await items[i].getType('text/plain');
        text = await b.text();
      }
    }
    // 2. 通过 postMessage 发给 content script
    window.postMessage({ payload: { html, text, source: 'clipboard.write' } }, '*');
    // 3. 不调原生方法，直接 resolve（浏览器从不介入）
    return Promise.resolve();
  },
  configurable: true, writable: true
});
```

**为什么能绕过安全性**：
- `Object.defineProperty` 在原型上替换方法，调用方（React/Vue/Angular/原生 JS）无感知
- 不调用浏览器的原生 `clipboard.write()`，所以 `isTrusted`、`transient activation`、权限弹窗**全部不检查**
- 平台代码看到 Promise resolved 即认为"复制成功"

**这是 JavaScript 对象模型层面的彻底拦截。不是事件拦截、不是 DOM 拦截，是方法级别的替换，调用者无从感知。**

**适用条件**：目标平台必须使用 `navigator.clipboard.write()` API。现代 AI 平台（ChatGPT、Claude、Gemini、Grok、DeepSeek 等）普遍使用此 API。

**局限性**：无法拦截使用 `document.execCommand('copy')` 的平台（如智谱清言）。

### 路径 B：copy 事件捕获 + Selection fallback（逐案适配）

**核心原理**：在 capture 阶段监听全局 `copy` 事件，利用 `window.getSelection()` 读取被复制的内容。

```js
document.addEventListener('copy', function(e) {
  // 先尝试 clipboardData（通常为空，因为此时还没有数据被写入）
  var text = null, html = null;
  try { text = e.clipboardData.getData('text/plain'); } catch(ex) {}
  try { html = e.clipboardData.getData('text/html'); } catch(ex) {}

  // 为空时走 Selection fallback
  if (!text && !html) {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      text = sel.toString() || null;
      try {
        var range = sel.getRangeAt(0);
        var div = document.createElement('div');
        div.appendChild(range.cloneContents());
        html = div.innerHTML || null;
      } catch(ex) {}
      // textarea 替换元素的 cloneContents 不产生 HTML，用 text 兜底
      if (!html && text) html = text;
    }
  }

  if (text || html) {
    window.postMessage({ payload: { html, text, source: 'copy.event' } }, '*');
  }
}, true); // capture 阶段
```

**⚠️ 关键陷阱**：
- `e.clipboardData.getData()` 在 copy 事件中永远返回空（只能 setData，不能 getData）
- `range.cloneContents()` 对 `<textarea>` 等替换元素不产生 DOM HTML，只会产生纯文本节点
- capture 阶段（第三个参数 `true`）在目标事件的 handler 之前触发，此时平台的 handler 尚未执行

**适用条件**：使用 `execCommand('copy')` 且通过 textarea 方式复制的平台。只能拿纯文本，HTML 质量不可控。

---

## 模拟点击策略

拦截到内容需要一个前提：**先触发平台的复制按钮**。

### 方式 1：element.click() — 最简单

```js
btn.focus();
btn.click();
```

| 优点 | 缺点 |
|------|------|
| 最简单直接 | 某些框架（Angular）的合成事件系统会忽略非信任事件 |
| 原生 `<button>` 行为可靠 | 对 `<div>` 等非表单元素可能不触发框架的 handler |

**适用**：Gemini（Angular 下 dispatchEvent 会抛 "No ID or name found" 错误）

### 方式 2：dispatchEvent 鼠标事件序列 — 最完整

```js
function simulateClick(target) {
  var rect = target.getBoundingClientRect();
  var x = rect.left + rect.width / 2;
  var y = rect.top + rect.height / 2;
  
  var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
  target.dispatchEvent(new MouseEvent('pointerdown', opts));
  target.dispatchEvent(new MouseEvent('mousedown', opts));
  target.dispatchEvent(new MouseEvent('pointerup', opts));
  target.dispatchEvent(new MouseEvent('mouseup', opts));
  target.dispatchEvent(new MouseEvent('click', opts));
}
```

| 优点 | 缺点 |
|------|------|
| 最接近真实用户操作的鼠标事件序列 | 某些平台检查 `e.isTrusted`（`dispatchEvent` 产生的 `isTrusted` 为 false） |
| 覆盖 pointer + mouse + click 三层事件 | 需要精确的 DOM 遍历找到 handler 所在的元素 |

**适用**：大多数现代框架（React、Vue 的合成事件系统通常不检查 isTrusted）

### 目标元素定位

dispatchEvent 的关键在于 **找到事件处理器实际绑定的元素**。dispatchEvent 在目标元素上触发事件，然后向外冒泡，**不会向内传播**到子元素。

```
错误的示例（元宝）：
  div.copy-wrapper              ← findCopyBtn 找到这个
    div.copy-icon-wrap
      span.iconfont-yb          ← 实际 onClick 在这里
        (dropdown arrow)        ← lastElementChild

dispatchEvent 在 div.copy-wrapper 上触发 → 事件向外冒泡 → 到不了内部 span
```

**正确的遍历策略**：

```js
function findInnermostClickTarget(btn) {
  var target = btn;
  var child = target;
  while (child.firstElementChild) {
    var next = child.firstElementChild;
    // 跳过 SVG 容器（SVG 子元素是视觉元素，handler 在 SVG 父元素上）
    if (next.tagName && next.tagName.toLowerCase() === 'svg') break;
    child = next;
  }
  target = child;
  
  // 如果无子元素，用常见交互元素选择器兜底
  if (target === btn) {
    var leaf = btn.querySelector('span, i, svg, img, button, a, [class*="icon"], [onclick]');
    if (leaf) target = leaf;
  }
  
  // 如果内层元素不可见，回退到外层
  var rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    target = btn;
  }
  
  return target;
}
```

### DOM 兜底

即使模拟点击不成功，也应始终准备 DOM 备用方案：

```js
function getDomContent(turnRoot, getContentRoot) {
  var root = getContentRoot(turnRoot);
  return {
    html: root instanceof Element ? root.innerHTML : null,
    text: extractTextFrom(root)
  };
}

// capture
_capture({ html, text, source: 'dom.auto' });
```

---

## 操作栏延迟渲染重试策略

AI 平台通常是流式输出：**内容先渲染，操作栏（含复制按钮）后渲染**。两者之间可能有数十到数百毫秒的延迟。

```js
var RETRY_INTERVALS = [100, 300, 700, 1500];

function tryFindCopyBtn(turnRoot, btnSelector, retryIndex) {
  var btn = findCopyBtn(turnRoot);
  if (btn) {
    triggerCopy(btn, btnSelector);
    return;
  }
  if (retryIndex < RETRY_INTERVALS.length) {
    setTimeout(function() {
      tryFindCopyBtn(turnRoot, btnSelector, retryIndex + 1);
    }, RETRY_INTERVALS[retryIndex]);
  }
}

function autoCapture(turnRoot) {
  openContext(turnRoot);
  
  // DOM 兜底始终立即执行
  var domContent = getDomContent(turnRoot, config.getContentRoot);
  if (domContent.html) _capture({ ...domContent, source: 'dom.auto' });
  
  // 复制按钮查找 + 重试
  var btn = findCopyBtn(turnRoot);
  if (btn) {
    triggerCopy(btn, buildSelector(turnRoot));
  } else {
    tryFindCopyBtn(turnRoot, buildSelector(turnRoot), 0);
  }
}
```

**注意**：DOM 兜底立即执行不受重试影响，侧边栏/UI 可以立刻显示内容。重试成功后的 clipboard API 数据作为格式增强（HTML 更完整）。

---

## 平台复制按钮 DOM 结构分类

### A 类：标准 `<button>` 元素（最友好）

```html
<button data-testid="copy-turn-action-button">
  <svg><path/></svg>
</button>
```

**策略**：`firstElementChild` 遍历到 button 自身（内部有 SVG，跳过），直接 dispatchEvent 触发。

**代表**：ChatGPT、Claude、Grok

### B 类：`<div>` 容器 + 内层图标元素

```html
<div class="copy-wrapper">
  <div class="copy-icon-wrap">
    <span class="iconfont">    ← onClick 在此
      <svg><path/></svg>
    </span>
    <div class="dropdown-arrow">  ← 兄弟元素，不能点
    </div>
  </div>
</div>
```

**策略**：`firstElementChild` 遍历到 `<span>`，跳过兄弟级下拉箭头。**切忌**用 `lastElementChild`。

**代表**：元宝

### C 类：`<div>` 容器 + `<i>` + `<svg>`

```html
<div class="copy">
  <i class="shim copy">         ← onClick 在此
    <svg><path/></svg>
  </i>
</div>
```

**策略**：`firstElementChild` 遍历到 `<i>`，遇 `<svg>` 停止。

**代表**：智谱清言

---

## 架构决策表

| 维度 | clipboard.write 原型替换 | execCommand + copy 事件 |
|------|------------------------|------------------------|
| 拦截可靠性 | ★★★★★ — 安装即拦截所有调用 | ★★☆☆☆ — 依赖 DOM 事件时序 |
| HTML 完整度 | ★★★★★ — text/html 原生格式 | ★☆☆☆☆ — textarea 无 HTML，Selection 可能有但不完整 |
| isTrusted 依赖 | ❌ 不需要 | ❌ 不需要（原生 copy 事件 isTrusted = true）|
| 框架影响 | ❌ 无影响 | ✅ 平台 UI 变化可能打破 Selection fallback |
| 一次性适配 | ✅ 全部平台一次解决 | ❌ 每个平台需要单独看实现细节 |
| 当前适用 | Gemini、GPT、Claude、Grok、DS | 智谱（需要继续完善）|

---

## 各平台点击目标汇总

| 平台 | 复制按钮 | simulateCopy 目标 | 特殊处理 |
|------|---------|------------------|---------|
| Gemini | `<button data-test-id="copy-button">` | `btn.click()` | Angular BardChatUi 在 dispatchEvent 下报错，改用原生 click() |
| ChatGPT | `<button data-testid="copy-turn-action-button">` | `<button>` 自身 | — |
| Claude | `<button data-testid="action-bar-copy">` | `<button>` 自身 | — |
| Grok | `<button aria-label="复制">` | `<button>` 自身 | — |
| DeepSeek | `<div class="ds-icon-button">` | `firstElementChild` 停在 `<div>` | — |
| 元宝 | `<div class="...copy-wrapper">` > `<span>` | 最初用 `lastElementChild` 拿到了下拉箭头 | 修复为 `firstElementChild` 遍历到 `<span>` |
| 智谱 | `<div class="copy">` > `<i>` > `<svg>` | SVG 跳过策略停在 `<i>` | — |

---

## 错误案例

| 错误 | 根因 | 正确做法 |
|------|------|---------|
| 凭类名含 "question" 就认为 AI 回复没有复制按钮 | 没有用 CDP 实际验证 DOM 结构 | 任何关于 DOM 的假设都必须用浏览器验证 |
| 用 lastElementChild 定位点击目标 | 拿到兄弟元素（如下拉箭头）而非目标元素 | 用 firstElementChild 遍历，跳过附属元素 |
| 不跳过 SVG 容器 | 遍历进入 `<svg>` 走到 `<path>`，handler 不触发 | 遇 `<svg>` 停止，handler 在 SVG 父元素上 |
| 复制按钮搜索限定在内容区域内 | 操作栏在内容区域外，搜索不到 | 用 getCopyBtnRoot 扩大搜索范围 |
| 认为 DOM fallback 总是够 | 流式输出时内容可能不完整 | DOM fallback + clipboard 原型替换双保险 |
| 清除复制按钮选择器 | 类名推测导致搜索不到按钮 | 用 CDP 实际验证 DOM 结构 |

## 调试检查清单

- [ ] 确认平台使用哪种 API：`clipboard.write()` vs `execCommand('copy')`
- [ ] 若使用 clipboard.write：检查 mainWorldHook 是否已注入 (`window.__ccCaptureHook`)
- [ ] 若使用 execCommand：检查 copy 事件 capture-phase handler 的 Selection fallback 是否捕获到内容
- [ ] 检查复制按钮是 `<button>` 还是 `<div>/<span>`
- [ ] 确认 simulateCopy 的 firstElementChild 遍历停在正确的元素上
- [ ] 检查目标元素的 getBoundingClientRect 尺寸是否为 0（触发回退逻辑）
- [ ] 检查 isTrusted check：平台 handler 是否因 isTrusted=false 跳过

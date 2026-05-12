---
name: clipboard-capture-architecture
description: 当需要理解或排查剪贴板捕获问题，或为新平台适配剪贴板捕获时使用。涵盖原型层替换 vs DOM 事件捕获的根本差异、simulateCopy 点击策略、各平台适配细节
---

# 浏览器剪贴板拦截与模拟点击 — 通用技术原理

## 场景

需要在用户无感知的情况下，拦截 AI 平台（或任意 Web 应用）的"复制"行为，获取复制的内容（含 HTML 格式），并转发到自己的扩展/应用中。

## 两条技术路径（历史三条 → 现两条）

> **⚠️ 路径 B（copy 事件 + Selection fallback）已于实际实现中移除。**
> 原因：copy 事件 capture handler 会拦截**所有**真实用户发起的复制操作（Ctrl+C、右键复制等）。`dispatchEvent` 无 transient activation，copy 事件仅在用户真实手势时触发，意味着路径 B 仅在用户自发复制时生效——恰好是我们**不应**拦截的场景。execCommand 平台已由路径 C 覆盖，无需路径 B 兜底。

### 路径 A：navigator.clipboard.write 原型替换（推荐，一次性解决）

**核心原理**：在页面主世界（main world）替换 `navigator.clipboard` 原型链上的 `write` / `writeText` 方法。

```js
var proto = Object.getPrototypeOf(navigator.clipboard);
var _origWrite = proto.write;          // ← 保存原始方法（关键！）
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
    // 2. capture guard 检查：仅 auto-capture 时拦截
    if (isCaptureActive()) {
      window.postMessage({ payload: { html, text, source: 'clipboard.write' } }, '*');
      return Promise.resolve();  // 不写入真实剪贴板
    }
    // 3. 用户自发复制：放行到真实剪贴板
    return _origWrite.apply(this, arguments);
  },
  configurable: true, writable: true
});
```

**为什么能绕过安全性**：
- `Object.defineProperty` 在原型上替换方法，调用方（React/Vue/Angular/原生 JS）无感知
- 拦截模式下不调用浏览器的原生 `clipboard.write()`，所以 `isTrusted`、`transient activation`、权限弹窗**全部不检查**
- 平台代码看到 Promise resolved 即认为"复制成功"

**关键设计约束**：必须保存原始方法并在非拦截时调用。否则用户自发复制会无声丢失（页面显示"已复制"但剪贴板为空）。

**适用条件**：目标平台必须使用 `navigator.clipboard.write()` API。现代 AI 平台（ChatGPT、Claude、Gemini、Grok、DeepSeek 等）普遍使用此 API。

**局限性**：无法拦截使用 `document.execCommand('copy')` 的平台（如智谱清言）。但可通过**路径 C** 的方案来补全。

### 路径 C：document.execCommand 方法级替换（补充方案，路径 A 的镜像）

**核心原理**：在 main world 直接替换 `document.execCommand` 方法。当平台调用 `execCommand('copy')` 时，在当前执行线程（同线程同步）中读取 DOM Selection 数据并转发。**在浏览器安全检查之前，在 copy 事件触发之前，在 transient activation 校验之前。**

```js
var _origExecCommand = document.execCommand.bind(document);
document.execCommand = function(command, showUI, value) {
  if (command === 'copy' || command === 'cut') {
    // 此时平台已经创建了 textarea、设值、.select()，Selection 中有完整数据
    var text = null, html = null;
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      text = sel.toString() || null;
      try {
        var range = sel.getRangeAt(0);
        var div = document.createElement('div');
        div.appendChild(range.cloneContents());
        html = div.innerHTML || null;
      } catch(ex) {}
      if (!html && text) html = text;
    }
    // 转发数据（与路径 A 相同的 postMessage 协议）
    if (text || html) {
      window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data',
        payload: { html, text, source: 'execCommand.hook' } }, '*');
    }
    // 尝试原始方法（有 TA 时正常复制，无 TA 时静默失败，不阻塞）
    try { return _origExecCommand(command, showUI, value); } catch(e) { return false; }
  }
  return _origExecCommand(command, showUI, value);
};
```

**为什么能绕过安全性**：
- 和路径 A 相同原理：在 main world 替换方法，调用方（Vue/React/原生 JS）无感知
- 拦截发生在 `execCommand()` 被调用的瞬间，**早于**浏览器内部的 transient activation 校验
- 此时平台的准备工作（创建 textarea、填充内容、.select()）**已经完成**，Selection 中有完整数据
- 是**方法级别的同步拦截**，不需要等待任何异步事件

**执行时序对比**：

```
路径 A（clipboard.write）:
  click → 平台调用 clipboard.write()  →  [proto hook]  →  读取 ClipboardItem  →  postMessage
                                  浏览器安全检查 ✗（不需要）                            

路径 C（execCommand hook）:
  click → 平台 execCommand('copy')  →  [execCommand hook ← 你现在在这里]  →  postMessage ✓
                                     ↓ 此时 textarea 已创建、已 select()
                                     ↓ 同线程同步，无需等待
                                     ↓
                                    原始 execCommand → [TA 校验] → 有 TA 则正常复制，无 TA 则失败
                                    我们的数据已经 postMessage 出去了
```

**适用条件**：使用 `execCommand('copy')` 的平台（如智谱清言）。与路径 A 互补，覆盖 clipboard.write 到达不到的旧 API。

**局限性**：
- 数据来自 DOM Selection，HTML 质量取决于平台如何组织 textarea/选区内容
- 通常配合 DOM fallback（`deriveHtmlFallback`）一起使用，DOM 提供完整 HTML，hook 提供精确的纯文本

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

## 操作栏延迟渲染策略（Observer 模式）

AI 平台通常是流式输出：**内容先渲染，操作栏（含复制按钮）后渲染**。两者之间可能有数十到数百毫秒的延迟。

**设计模式：事件驱动（MutationObserver），代替固定间隔轮询。**

```js
// 用 MutationObserver 等待复制按钮出现，按钮一渲染到 DOM 就触发回调
function waitForCopyBtn(turnRoot, callback, timeoutMs) {
  // 先同步查一次——按钮可能已经渲染好了
  var btn = findCopyBtn(turnRoot);
  if (btn) { callback(btn); return; }

  // 事件驱动：监听 DOM 变化，按钮一出现就触发
  var root = getSearchRoot(turnRoot);
  if (!(root instanceof Element)) return;

  var observer = new MutationObserver(function() {
    var found = findCopyBtn(turnRoot);
    if (found) {
      observer.disconnect();
      callback(found);
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  // 安全网超时：防止 observer 常驻泄漏
  if (timeoutMs > 0) {
    setTimeout(function() { observer.disconnect(); }, timeoutMs);
  }
}

function autoCapture(turnRoot) {
  openContext(turnRoot);
  setCaptureActive(true);

  // DOM 兜底始终立即执行（不等待按钮）
  var domContent = getDomContent(turnRoot, config.getContentRoot);
  if (domContent.html) _capture({ ...domContent, source: 'dom.auto' });

  // 事件驱动等待复制按钮出现（Observer），零延迟、零浪费
  waitForCopyBtn(turnRoot, function(btn) {
    triggerDirectCopy(btn);
  }, 4500);
}
```

**为什么放弃 Polling：**

| 维度 | Polling（旧） | Observer（新） |
|------|:---:|:---:|
| 响应速度 | 取决于轮询间隔，平均 ~间隔/2 | 微秒级，DOM 变化即触发 |
| 浪费 | 固定重试，按钮已出现仍空转 | `observer.disconnect()` 即停止 |
| 漏捕获 | 按钮在末次重试后渲染 → 错过 | 超时前一直等待 |
| 内存 | 多个定时器 + closure 链 | 1 个 observer + 1 个超时 |

**注意**：DOM 兜底始终立即执行，不受按钮等待影响。侧边栏/UI 可以立刻显示内容。clipboard API 数据（等待按钮出现后获取）作为格式增强（HTML 更完整）。

---

## 扩展配置项

### `skipDomFallback` — 跳过 DOM 兜底

Angular 虚拟滚动平台（如 Google AI Studio）的 AI 回复内容不在 DOM 中，DOM fallback 只会捕获到 Angular placeholder（`<!---->`）或不完整的流式输出片段。

```js
skipDomFallback: true, // 跳过 DOM 兜底，只依赖 clipboard/execCommand hook
```

### `settleTimeMs` — 流式输出稳定等待

流式平台在生成过程中内容不断变化，`isGenerating` 可能不准确（如 AI Studio 无 Stop 按钮）。`settleTimeMs` 让 autoCapture 等内容稳定后再触发，内容变化时自动重置计时。

```js
settleTimeMs: 1500, // ms，内容无变化后延迟多久触发捕获
```

在 responseListenerCore 中实现：每次 `handleResponseUpdate` 检测到内容变化但尚在生成 → 重置 timer；内容稳定超时 → 执行 `capture.autoCapture`。



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

| 维度 | clipboard.write 原型替换（路径 A） | execCommand 方法级替换（路径 C） |
|------|------------------------|------------------------|
| 拦截可靠性 | ★★★★★ — 安装即拦截所有调用 | ★★★★★ — 安装即拦截所有 execCommand('copy') 调用 |
| HTML 完整度 | ★★★★★ — text/html 原生格式 | ★★★☆☆ — Selection 数据，textarea 场景无 HTML |
| isTrusted 依赖 | ❌ 不需要 | ❌ 不需要（在 TA 校验之前拦截） |
| TA 依赖 | ❌ 不需要 | ❌ 不需要（同线程同步，早于浏览器校验）|
| 框架影响 | ❌ 无影响 | ❌ 无影响 |
| 一次性适配 | ✅ 全部平台一次解决 | ✅ 全部 execCommand 平台一次解决 |
| 当前适用 | Gemini、GPT、Claude、Grok、DS | **GLM（智谱清言）**、其他 execCommand 平台 |

---

## 各平台点击目标汇总

| 平台 | 复制按钮 | simulateCopy 目标 | 数据来源 | 特殊处理 |
|------|---------|------------------|---------|---------|
| Gemini | `<button data-test-id="copy-button">` | `btn.click()` | clipboard.write（路径 A） | Angular BardChatUi 在 dispatchEvent 下报错，改用原生 click() |
| ChatGPT | `<button data-testid="copy-turn-action-button">` | `<button>` 自身 | clipboard.write（路径 A） | — |
| Claude | `<button data-testid="action-bar-copy">` | `<button>` 自身 | clipboard.write（路径 A） | — |
| Grok | `<button aria-label="复制">` | `<button>` 自身 | clipboard.write（路径 A） | — |
| DeepSeek | `<div class="ds-icon-button">` | `firstElementChild` 停在 `<div>` | clipboard.write（路径 A） | — |
| 元宝 | `<div class="...copy-wrapper">` > `<span>` | `firstElementChild` 遍历到 `<span>` | clipboard.write（路径 A） | 修复：避免用 `lastElementChild` 拿到下拉箭头 |
| 智谱（GLM） | `<div class="copy">` > `<i>` > `<svg>` | SVG 跳过策略停在 `<i>` | **execCommand hook（路径 C）** + DOM fallback | GLM 用 `document.execCommand('copy')`，dispatchEvent 无 TA，需路径 C 拦截 |
| **Google AI Studio** | **无直接复制按钮** → `button[aria-label="Open options"]`（more_vert）→ 下拉菜单 "Copy as text" | **两步流程**：`__ccSimulateCopy(more_vert)` → 等 500ms → `__ccSimulateCopy("Copy as text")` | **execCommand hook（路径 C）** — 纯文本无 HTML | Angular 虚拟滚动，内容不在 DOM 中，需 `skipDomFallback: true` + `settleTimeMs: 1500` |

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
| simulateCopy 触发 DOM 变化 → MutationObserver → autoCapture 循环 | copy 按钮点击后页面 UI 变化（tooltip、"已复制"状态）触发 observer，observer 回调又调 autoCapture，形成死循环 | autoCapture 内加**基于 messageId 的去重锁**：同一个 turn 只执行一次捕获流程，5 秒超时后释放 |
| 认为 copy 事件 capture handler 能拦截 execCommand 模拟点击 | **dispatchEvent 没有 transient activation** → execCommand 静默失败 → copy 事件不触发 | 对于 execCommand 平台，使用路径 C 的 `document.execCommand` 方法级替换 |
| 用路径 A 试图拦截 GLM 的复制 | GLM 不使用 `navigator.clipboard.write()`，使用 `execCommand('copy')` | 路径 C 的 execCommand hook + DOM fallback |
| 在 Angular 虚拟滚动平台使用 DOM fallback 捕获流式内容 | DOM fallback 执行时 AI 尚未生成完，只捕获到首个 token（如"由于"） | 走 execCommand hook 或设置 `skipDomFallback: true`，并在 response listener 添加 `settleTimeMs` |
| 在 AI Studio 点击 more_vert 后不点 Copy as text | more_vert 只打开菜单，不触发复制 | 两步流程：先点 more_vert，等 menu 渲染后点 "Copy as text"（mainWorldHook 内实现） |
| 平台 isGenerating 不准确时 autoCapture 过早触发 | isGenerating 返回 false 但 AI 仍在生成，autoCapture 获取到不完整内容 | responseListenerCore 新增 `settleTimeMs` 配置：内容稳定后再触发，流式输出时自动重置计时 |
| 路径 B（copy 事件 capture）拦截用户自发复制 | copy 事件 capture handler 在 capture 阶段监听所有 copy 事件，用户手动 Ctrl+C/右键复制均被拦截 | **路径 B 已从代码中移除**：copy 事件仅在真实用户手势时触发（dispatchEvent 无 TA），因此路径 B 恰好只拦截用户自发复制，违背"不拦截用户"的原则。execCommand 平台已由路径 C 覆盖，无需路径 B 兜底。

## 调试检查清单

- [ ] 确认平台使用哪种 API：`clipboard.write()` vs `execCommand('copy')`
- [ ] 若使用 clipboard.write：检查 mainWorldHook 是否已注入 (`window.__ccCaptureHook`)，`Object.getOwnPropertyDescriptor` 的 `native` 标志
- [ ] 若使用 execCommand：路径 C（execCommand hook）是否已注入（mainWorldHook.js 中查找 `_origExecCommand`）
- [ ] 检查复制按钮是 `<button>` 还是 `<div>/<span>`
- [ ] 确认 simulateCopy 的 firstElementChild 遍历停在正确的元素上
- [ ] 检查目标元素的 getBoundingClientRect 尺寸是否为 0（触发回退逻辑）
- [ ] 检查 isTrusted check：平台 handler 是否因 isTrusted=false 跳过
- [ ] 确认两条路径覆盖关系：
  - 路径 A（clipboard.write proto hook）→ 现代平台（GPT、Claude、Grok、Gemini）
  - 路径 C（execCommand hook）+ DOM fallback → 旧平台（GLM）

---
name: clipboard-capture-architecture
description: 当需要理解或解释为什么某些平台的剪贴板捕获能工作而另一些不能时使用。涵盖原型层替换 vs DOM 事件捕获的根本差异、simulateCopy 点击策略、各平台的 API 选择
---

# 剪贴板捕获架构：为什么有些平台能工作

## 一句话根因

Gemini、ChatGPT、Claude、Grok、DeepSeek 全部使用 `navigator.clipboard.write()`，因此被原型层替换**一次性彻底拦截**。

智谱使用 `execCommand('copy')`，走的是完全不同的事件路径，需要 Selection fallback 逐案适配。

## 核心机制：原型层替换

`mainWorldHook.js` 在页面主世界执行，替换 `navigator.clipboard` 原型链上的 `write` 方法：

```js
var proto = Object.getPrototypeOf(navigator.clipboard);
Object.defineProperty(proto, 'write', {
  value: async function(items) {
    // 1. 从 ClipboardItem 读取内容（不需要真实剪贴板权限）
    var b = await items[i].getType('text/plain');
    text = await b.text();
    // 2. 通过 postMessage 发给 content script
    window.postMessage({ payload: { html, text } }, '*');
    // 3. 直接 resolve，浏览器从不介入
    return Promise.resolve();
  },
  configurable: true, writable: true
});
```

这个替换做了三件决定性的事：

| 动作 | 效果 |
|------|------|
| 替换 prototype.write | JavaScript 原型继承下，页面上 **所有** `clipboard.write()` 调用都走到这里。框架内部调用也不例外 |
| 同步读 ClipboardItem | `getType()` 返回的 Blob 可同步 `.text()` 读取，不需要真实剪贴板权限 |
| 跳过原生实现 | 浏览器从不检查 `isTrusted`、`transient activation`、权限弹窗。平台代码看到 Promise resolved 就认为"复制成功" |

**这是 JavaScript 对象模型层面的彻底拦截。不是事件拦截、不是 DOM 拦截，是方法级别的替换，调用者无从感知。**

## 另一条路：execCommand + copy 事件

智谱（ChatGLM）使用 `document.execCommand('copy')` + textarea 选择，流程完全不同：

1. 平台创建临时 `<textarea>`，设置值、选中内容
2. 调用 `execCommand('copy')`，浏览器派发 `copy` 事件
3. 我们的 capture-phase handler 触发（`document.addEventListener('copy', handler, true)`）
4. 此时 clipboardData 为空（平台还没 setData），走 Selection fallback
5. `sel.toString()` 拿到纯文本，但 `range.cloneContents()` 对 textarea 替换元素不产生结构化 HTML
6. 只能捕获到 tab/空格分隔的纯文本

这条路径的问题：
- **每次都可能不同** — 依赖平台的实现细节（textarea 创建方式、selection 设置时机）
- **丢失 HTML 结构** — textarea 的 cloneContents 不产生 DOM HTML，只能用纯文本兜底
- **不可靠** — capture-phase 和 bubble-phase 的时序依赖、selection 可能被平台后续代码清除

## simulateCopy 点击策略

```js
// firstElementChild 遍历，遇 SVG 容器停止
while (child.firstElementChild) {
  var next = child.firstElementChild;
  if (next.tagName && next.tagName.toLowerCase() === 'svg') break;
  child = next;
}
```

| 策略 | 目的 |
|------|------|
| firstElementChild 遍历 | 找到最内层可点击元素，避免 dispatchEvent 从外层触发向外冒泡到不了内层的 onClick |
| 跳过 SVG 容器 | SVG 子元素（path/circle）是纯视觉元素，事件处理器在 SVG 父元素上。不跳过会走到视觉元素上导致 handler 不触发 |
| 叶子元素不可见时回退 | 内层元素若尺寸为 0，回退到外层按钮 |

### 各平台点击目标

| 平台 | 复制按钮 | simulateCopy 目标 | 特殊处理 |
|------|---------|------------------|---------|
| Gemini | `<button data-test-id="copy-button">` | `btn.click()` | Angular BardChatUi 在 dispatchEvent 下报错，改用原生 click() |
| ChatGPT | `<button data-testid="copy-turn-action-button">` | `<button>` 自身 | — |
| Claude | `<button data-testid="action-bar-copy">` | `<button>` 自身 | — |
| Grok | `<button aria-label="复制">` | `<button>` 自身 | — |
| DeepSeek | `<div class="ds-icon-button">` | `firstElementChild` 停在 `<div>` | — |
| 元宝 | `<div class="...copy-wrapper">` > `<span>` | 最初用 `lastElementChild` 拿到了下拉箭头 | 修复为 `firstElementChild` 遍历到 `<span>` |
| 智谱 | `<div class="copy">` > `<i>` > `<svg>` | SVG 跳过策略停在 `<i>` | — |

## 架构决策对照

| 维度 | clipboard.write 路径 | execCommand 路径 |
|------|-------------------|-----------------|
| 拦截方式 | 原型替换 | DOM 事件捕获 |
| 一次性解决 | ✅ 安装即拦截所有调用 | ❌ 每个平台可能不同 |
| HTML 捕获 | ✅ 原生支持（text/html MIME） | ❌ textarea 不产生 HTML |
| isTrusted 依赖 | ❌ 不需要 | ✅ 原生 copy 事件不检查 |
| 框架影响 | ❌ 无影响 | ✅ 平台 UI 变化可能打破 |
| 当前适配平台 | 5 个 | 1 个（智谱，未完全解决） |

## 错误案例

| 错误操作 | 实际后果 | 正确做法 |
|---------|---------|---------|
| 清除复制按钮选择器（元宝） | 类名含 "question" 就认为 AI 回复没有复制按钮 | 用 CDP 实际验证 DOM 结构，不要凭类名推测 |
| 用 lastElementChild 遍历点击目标（元宝） | 拿到复制按钮旁边的下拉箭头 | 用 firstElementChild 遍历到第一个子元素，跳过兄弟级附属元素 |
| 不跳过 SVG 容器（智谱） | firstElementChild 进入 `<svg>` 走到 `<path>`，事件 handler 不触发 | 遇 SVG 容器停止，handler 在 SVG 父元素上 |
| 复制按钮选择器限定在内容区域内（元宝） | 复制按钮在操作栏中不在内容区域内，搜索不到 | getCopyBtnRoot 不限定搜索根 |

## 调试检查清单

- [ ] 确认平台使用哪种 API：`clipboard.write()` vs `execCommand('copy')`
- [ ] 若使用 clipboard.write：检查 mainWorldHook 是否已注入 (`window.__ccCaptureHook`)
- [ ] 若使用 execCommand：检查 copy 事件 capture-phase handler 的 Selection fallback 是否捕获到内容
- [ ] 检查复制按钮是 `<button>` 还是 `<div>/<span>`
- [ ] 确认 simulateCopy 的 firstElementChild 遍历停在正确的元素上
- [ ] 检查目标元素的 getBoundingClientRect 尺寸是否为 0（触发回退逻辑）
- [ ] 检查 isTrusted check：平台 handler 是否因 isTrusted=false 跳过

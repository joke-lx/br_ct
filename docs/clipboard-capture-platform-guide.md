# 剪贴板捕获平台接入指南

为新的 AI 平台添加剪贴板捕获支持，使侧边栏能获取平台回复的完整 HTML（表格、代码块等格式保留）。

## 整体流程

```
分析平台 DOM → 创建配置 → 创建 responseListener → 注册脚本
```

---

## 一、分析平台 DOM

使用浏览器 DevTools 或 CDP 分析目标平台的 DOM 结构，确认以下关键信息：

### 1.1 复制按钮位置

```javascript
// 在平台页面执行
document.querySelectorAll('button[aria-label*="Copy"], button[aria-label*="copy"], button[aria-label*="复制"]')
```

**关键问题：复制按钮是否在回复容器内？**

- **ChatGPT/Gemini 模式**：复制按钮在 `article` 或 `message` 容器内部 → `getCopyBtnRoot` 可省略
- **Claude 模式**：复制按钮在 `div.contents` 外部，两者同属一个父容器 → 需要 `getCopyBtnRoot`
- **豆包模式**：复制按钮在独立的 action bar 中 → 可能需要不同的搜索策略

### 1.2 回复容器结构

```javascript
// 找到每条回复的容器
document.querySelectorAll('div.contents')        // Claude
document.querySelectorAll('[data-message-author-role="assistant"]') // ChatGPT
document.querySelectorAll('message-content')      // Gemini/Doubao
```

**关键信息：**
- 每条回复/每个 turn 的容器选择器（`responseSelectors`）
- 回复内容所在的元素（`getContentRoot` 返回值）
- 纯文本内容的选择器（如 Claude 的 `.whitespace-pre-wrap`）

### 1.3 对话 ID 提取

```javascript
// Claude: URL path 中提取
window.location.pathname  // /chat/<conversation-id>

// ChatGPT: 从页面元素或 URL 提取
// 豆包: 从 URL query 或页面数据提取
```

---

## 二、创建配置

在 `contentScripts/clipboardCapture/configs/{platform}.js` 创建配置：

```javascript
/**
 * {平台名称} 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 */
(function() {
  if (window.{platform}CaptureConfig) return;

  window.{platform}CaptureConfig = {
    name: '{platformId}',
    action: '{platformId}CopyCapture',

    // ============= 复制按钮选择器 =============
    // 主选择器（自动复制时使用）
    copyBtnPrimarySelector: 'button[data-testid="copy-button"]',
    // 后备选择器列表
    copyBtnSelectors: [
      'button[data-testid="copy-button"]',
      'button[aria-label*="Copy"]',
      'button[aria-label*="复制"]',
      'button[aria-label*="copy"]',
    ],

    // ============= 复制按钮搜索根 =============
    // 当复制按钮不在 turn 容器内时，返回包含按钮的父容器
    // 如果复制按钮在 turn 容器内，省略此方法
    getCopyBtnRoot: function(turnRoot) {
      return turnRoot.parentElement || turnRoot;
    },

    // ============= 内容定位 =============
    getContentRoot: function(turnRoot) {
      // 从 turn 容器中定位包含回复内容的元素
      // 返回的元素将作为 innerHTML 提取的来源
      var contentEl = turnRoot.querySelector('.response-content');
      if (contentEl) return contentEl;
      return turnRoot;
    },

    // ============= 标识提取 =============
    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'chat' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      if (!element.dataset.testid) {
        window.__{platformId}TurnSeq = (window.__{platformId}TurnSeq || 0) + 1;
        element.dataset.testid = '{platformId}-turn-' + window.__{platformId}TurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    // ============= 事件检测 =============
    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      // 从点击目标向上查找所属的 turn 容器
      var turn = target.closest('.turn-container');
      if (turn) return turn;
      return null;
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      // 判断元素是否是复制按钮
      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // ============= 可选配置 =============
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
```

### 配置项说明

| 配置 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 平台标识，与 PLATFORM_CONFIG 中的 key 一致 |
| `action` | 是 | 消息 action 名，格式 `{platform}CopyCapture` |
| `copyBtnPrimarySelector` | 是 | 复制按钮的精确 CSS 选择器 |
| `copyBtnSelectors` | 是 | 复制按钮的后备选择器列表 |
| `getCopyBtnRoot` | 视情况 | 当复制按钮在 turn 容器外时需要 |
| `getContentRoot` | 推荐 | 返回包含回复内容的 DOM 元素 |
| `getConversationId` | 推荐 | 提取当前对话的 ID |
| `getMessageId` | 推荐 | 为每个 turn 生成唯一 ID |
| `detectTurn` | 推荐 | 从点击目标定位所属 turn 容器 |
| `isCopyControl` | 推荐 | 判断元素是否为复制相关控件 |

---

## 三、创建 Response Listener

在 `contentScripts/chatResponse/{platform}ResponseListener.js` 创建：

```javascript
/**
 * {平台名称} 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__{platformId}ResponseListenerInjected) return;
  window.__{platformId}ResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[{platformName} Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: '{platformId}',
    hostnames: ['{platform-domain}.com'],

    // 每条回复的容器选择器（从 document 中匹配所有回复）
    responseSelectors: [
      '.message-container',
    ],

    // turn（单轮对话）的容器选择器，用于 autoCapture 定位
    turnSelectors: [
      '.turn-container',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    // 引用配置名（即 window.{platform}CaptureConfig）
    captureConfig: '{platformId}CaptureConfig',

    getConversationId: function() {
      try {
        // 从 URL 或页面元素中提取对话 ID
        return window.location.pathname.split('/').filter(Boolean).pop() || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      if (!element.dataset.testid) {
        window.__{platformId}TurnSeq = (window.__{platformId}TurnSeq || 0) + 1;
        element.dataset.testid = '{platformId}-turn-' + window.__{platformId}TurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    isGenerating: function() {
      // 检测平台是否仍在生成回复
      var stopBtn = document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"]');
      if (stopBtn && !stopBtn.disabled) return true;
      return false;
    },
  });
})();
```

---

## 四、注册脚本

### 4.1 更新 platformScriptFiles.js

在 `backgroudtask/platformScriptFiles.js` 的 `getPlatformScriptFiles` 函数中添加：

```javascript
if (platform === '{platformId}') {
  return [
    "contentScripts/clipboardCapture/core.js",
    "contentScripts/clipboardCapture/configs/{platformId}.js",
    "contentScripts/{platformId}.js",          // 平台内容脚本（已有的）
    "contentScripts/chatResponse/responseListenerCore.js",
    "contentScripts/chatResponse/{platformId}ResponseListener.js",
  ];
}
```

### 4.2 Manifest 配置

如果 mainWorldHook.js 需要新增为 web_accessible_resources（通常已有），确认 manifest.json 中包含：

```json
"web_accessible_resources": [{
  "resources": [
    "contentScripts/clipboardCapture/mainWorldHook.js",
    "contentScripts/clipboardCapture/configs/{platformId}.js"
  ],
  "matches": ["https://{platform-domain}/*"]
}]
```

---

## 五、测试验证

### 5.1 自动测试流程

```
1. 侧边栏发送消息
2. 平台控制台检查：
   - 是否有 [name Copy Capture] context.open 日志
   - 是否有 [name Copy Capture] autoCopy.triggerSent 日志
   - 是否有 [name Copy Capture] capture 日志
3. 侧边栏检查：
   - 回复渲染正常
   - 捕获数据 source 为 clipboard.write（非 dom.auto）
   - 表格/代码等富格式完整保留
```

### 5.2 手动测试

```javascript
// 在平台页面 DevTools 控制台执行：

// 1. 检查配置是否加载
window.{platform}CaptureConfig  // 应显示配置对象

// 2. 手动触发复制
var btn = document.querySelector('button[data-testid="copy-button"]');
window.__ccSimulateCopy(btn);  // 应在 console 看到 [CC-Hook] simulateCopy click

// 3. 检查是否捕获到数据
// 侧边栏应显示 clipboard.write 来源的渲染内容
```

### 5.3 常见问题排查

| 现象 | 原因 | 检查 |
|------|------|------|
| `hasBtn: false` | 复制按钮未找到 | `getCopyBtnRoot` 配置是否正确 |
| 捕获 source 为 `dom.auto` | 自动复制未成功 | mainWorldHook 的 trigger-copy handler 的 selector 解析 |
| `htmlMissing: true` | HTML 内容丢失 | `getContentRoot` 返回的元素是否正确 |
| 无捕获数据 | responseListener 未触发 | `responseSelectors` 和 `turnSelectors` 是否匹配实际 DOM |

---

## 六、架构说明

### 核心文件

```
contentScripts/clipboardCapture/
├── core.js              # 捕获核心引擎（不修改）
├── mainWorldHook.js     # 主世界钩子（修复了 /g bug 的版本，不修改）
└── configs/
    ├── chatgpt.js       # ChatGPT 配置
    ├── claude.js        # Claude 配置（参考：按钮在 turn 容器外的处理）
    ├── gemini.js        # Gemini 配置
    └── doubao.js        # 豆包配置
contentScripts/chatResponse/
├── responseListenerCore.js   # 响应监听核心（不修改）
├── chatgptResponseListener.js
├── claudeResponseListener.js
└── geminiResponseListener.js
```

### 数据流

```
平台回复完成
  → responseListener detected
    → sendResponseToSidebar(text content)
    → capture.autoCapture(turnRoot)
      → openContext(turnRoot)
      → findCopyBtn(turnRoot)
      → postMessage(trigger-copy)          ← 主世界监听
        → __ccSimulateCopy(btn)            ← 模拟点击复制按钮
        → navigator.clipboard.write()      ← 平台复制处理
          → clipboard hook                  ← mainWorldHook 拦截
          → postMessage(clipboard-data)
      → _capture({html, text, 'dom.auto'}) ← DOM 兜底
    → chrome.runtime.sendMessage(claudeCopyCapture)
      → sidebar.handlePlatformCapture()
        → renderPlatformCapture()          ← 优先渲染 HTML
```

### 复制按钮定位策略（按优先级）

1. **Turn 作用域**：`[data-testid="turn-xxx"] button.copy-btn` — 精确定位到对应 turn
2. **直接选择器**：`document.querySelector(selector)` — 全局查找
3. **Unscoped 回退**：去掉 `[data-testid="..."]` 前缀，取最后一个匹配按钮 — 适用于按钮在 turn 容器外的平台

> **注意**：第 3 步的 regex **不**能使用 `/g` 标志，否则会连按钮本身的 `[data-testid="..."]` 一起移除（`mainWorldHook.js:112` 已有修复）。

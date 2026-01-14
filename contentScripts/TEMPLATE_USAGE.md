# AI 平台内容脚本使用指南

## 快速开始

1. 复制 `platform.template.js` 并重命名为 `{platform_name}.js`
2. 修改 `PLATFORM_CONFIG` 配置对象
3. 填写 `INPUT_SELECTORS` 和 `BUTTON_SELECTORS`
4. 在 `manifest.json` 中注册脚本

---

## 配置参数说明

### PLATFORM_CONFIG

```javascript
const PLATFORM_CONFIG = {
  // 平台标识（用于日志和响应）
  name: 'platform_name',

  // 域名检查（支持部分匹配）
  hostname: 'platform-domain.com',

  // 点击模式：'click' | 'mouseup' | 'both'
  clickMode: 'click',

  // 输入模式：'value' | 'textContent' | 'nativeSetter' | 'custom'
  inputMode: 'value',

  // 是否需要先激活输入框（点击 + focus）
  needActivateInput: false,

  // 激活后延迟时间（毫秒）
  activateDelay: 100,

  // 输入后延迟时间（毫秒）
  inputDelay: 100,

  // 点击后延迟时间（毫秒）
  clickDelay: 100,

  // 元素查找超时时间（毫秒）
  elementTimeout: 5000,

  // 元素查找重试间隔（毫秒）
  retryInterval: 100,

  // 是否输出详细日志
  verboseLogging: true,
};
```

### 点击模式 (clickMode)

| 值 | 说明 | 适用平台 |
|---|---|---|
| `click` | 普通 click 事件 | ChatGPT, Claude, Gemini, Doubao, Tongyi, GoogleStudio, Yuanbao |
| `mouseup` | 只用 mouseup 触发（GLM 特殊） | GLM |
| `both` | 先尝试 click，失败后尝试 mouseup | - |

### 输入模式 (inputMode)

| 值 | 说明 | 适用元素 |
|---|---|---|
| `value` | 设置 `.value` 属性 | `<input>`, `<textarea>` |
| `textContent` | 设置 `.textContent` | contenteditable 元素 |
| `nativeSetter` | 使用原生 setter（React 受控组件） | React 控制的输入框 |
| `custom` | 自定义逻辑（自动判断） | 混合类型 |

---

## 现有平台配置参考

### GLM (智谱清言)

```javascript
const PLATFORM_CONFIG = {
  name: 'glm',
  hostname: 'glm',
  clickMode: 'mouseup',     // GLM 特殊：只用 mouseup
  inputMode: 'value',
  needActivateInput: false,
  elementTimeout: 3000,
};

const INPUT_SELECTORS = [
  { type: 'xpath', value: '//*[@id="search-input-box"]/div/div[1]/textarea' },
  { type: 'xpath', value: '//textarea[@placeholder="和我聊聊天吧"]' },
];

const BUTTON_SELECTORS = [
  { type: 'xpath', value: '//*[@id="search-input-box"]/div/div[2]/div[2]/div/div' },
];
```

### ChatGPT

```javascript
const PLATFORM_CONFIG = {
  name: 'chatgpt',
  hostname: 'chatgpt',
  clickMode: 'click',
  inputMode: 'textContent',     // contenteditable 元素
  elementTimeout: 3000,
};

const INPUT_SELECTORS = [
  { type: 'xpath', value: '//rich-textarea/div[1]/p' },
  { type: 'xpath', value: '//div[@role="textbox"][@contenteditable="true"]/p' },
];

const BUTTON_SELECTORS = [
  { type: 'xpath', value: '//button[@aria-label="Send message"]' },
];
```

### Claude

```javascript
const PLATFORM_CONFIG = {
  name: 'claude',
  hostname: 'claude.ai',
  clickMode: 'click',
  inputMode: 'textContent',
  elementTimeout: 5000,
};

const INPUT_SELECTORS = [
  { type: 'css', value: '.ProseMirror p' },
  { type: 'xpath', value: '//div[@contenteditable="true"]/p' },
  { type: 'xpath', value: '//div[@role="textbox"][@contenteditable="true"]//p' },
];

const BUTTON_SELECTORS = [
  { type: 'xpath', value: '//button[@aria-label="Send message"]' },
  { type: 'css', value: 'button[data-testid="send-button"]' },
];
```

### Doubao (豆包)

```javascript
const PLATFORM_CONFIG = {
  name: 'doubao',
  hostname: 'doubao',
  clickMode: 'click',
  inputMode: 'value',
  elementTimeout: 5000,
};

const INPUT_SELECTORS = [
  { type: 'xpath', value: '//*[@id="chat-route-layout"]/main/div/div/div[2]/div/div/div[2]/div[2]/div[2]/div/div/div[2]/div[2]/div/textarea' },
  { type: 'css', value: '#chat-route-layout textarea' },
];

const BUTTON_SELECTORS = [
  { type: 'xpath', value: '//*[@id="flow-end-msg-send"]' },
  { type: 'css', value: '#flow-end-msg-send' },
];
```

### Tongyi (通义千问)

```javascript
const PLATFORM_CONFIG = {
  name: 'tongyi',
  hostname: 'qianwen',
  clickMode: 'click',
  inputMode: 'nativeSetter',    // React 受控组件
  needActivateInput: true,      // 需要先激活
  elementTimeout: 5000,
};

const INPUT_SELECTORS = [
  { type: 'css', value: '#tongyi-content-wrapper textarea' },
  { type: 'css', value: 'textarea.ant-input' },
];

const BUTTON_SELECTORS = [
  { type: 'css', value: 'div.operateBtn-JsB9e2' },
];
```

### Google Studio

```javascript
const PLATFORM_CONFIG = {
  name: 'google-aistudio',
  hostname: 'aistudio.google.com',
  clickMode: 'click',
  inputMode: 'value',
  elementTimeout: 5000,
};

const INPUT_SELECTORS = [
  { type: 'css', value: 'textarea[placeholder="Start typing a prompt"]' },
  { type: 'css', value: 'ms-text-chunk textarea' },
];

const BUTTON_SELECTORS = [
  { type: 'css', value: 'button[aria-label="Run"]' },
  { type: 'css', value: 'ms-run-button button' },
];
```

### Yuanbao (元宝)

```javascript
const PLATFORM_CONFIG = {
  name: 'yuanbao',
  hostname: 'yuanbao',
  clickMode: 'click',
  inputMode: 'custom',     // 自动判断
  elementTimeout: 3000,
};

const INPUT_SELECTORS = [
  { type: 'id', value: 'prompt-textarea' },
  { type: 'css', value: '.ql-editor[contenteditable="true"] p' },
];

const BUTTON_SELECTORS = [
  { type: 'id', value: 'yuanbao-send-btn' },
  { type: 'xpath', value: '//button[@aria-label="Send message"]' },
];
```

### Grok

```javascript
const PLATFORM_CONFIG = {
  name: 'grok',
  hostname: 'grok.com',
  clickMode: 'click',
  inputMode: 'textContent',    // TipTap/ProseMirror 编辑器
  needActivateInput: true,      // 需要先激活
  elementTimeout: 5000,
};

const INPUT_SELECTORS = [
  { type: 'css', value: 'div.ProseMirror' },
  { type: 'css', value: 'div.tiptap.ProseMirror' },
  { type: 'xpath', value: '//p[@data-placeholder="What do you want to know?"]' },
];

const BUTTON_SELECTORS = [
  { type: 'xpath', value: '//button[@aria-label="Send message"]' },
  { type: 'xpath', value: '//button[@aria-label="Send"]' },
  { type: 'xpath', value: '//button[.//svg]' },
];
```

---

## 选择器优先级建议

按稳定性排序（从高到低）：

1. **ID 选择器** - 最稳定
   ```javascript
   { type: 'id', value: 'element-id' }
   ```

2. **带属性的 CSS 选择器** - 较稳定
   ```javascript
   { type: 'css', value: 'button[aria-label="Send"]' }
   { type: 'css', value: 'textarea[placeholder="Type..."]' }
   ```

3. **ARIA 属性的 XPath** - 较稳定
   ```javascript
   { type: 'xpath', value: '//button[@aria-label="Send message"]' }
   ```

4. **类名 CSS 选择器** - 可能变化
   ```javascript
   { type: 'css', value: 'button.send-btn' }
   ```

5. **完整 DOM 路径** - 最不稳定，仅作最后备选
   ```javascript
   { type: 'xpath', value: '/html/body/div[1]/div[2]/.../button' }
   ```

---

## 调试工具

脚本会自动暴露调试工具到 `window.__platformScript`：

```javascript
// 在控制台中调试
window.__platformScript.sendChatMessage("测试消息");
window.__platformScript.config;  // 查看配置
window.__platformScript.findElementBySelectors(INPUT_SELECTORS);
```

---

## 常见问题

### 1. 元素找不到

- 检查选择器是否正确
- 增加超时时间 `elementTimeout`
- 检查页面是否完全加载

### 2. 输入后内容消失

- 设置 `needActivateInput: true`
- 尝试 `inputMode: 'nativeSetter'`
- 增加 `activateDelay`

### 3. 点击无反应

- 检查 `clickMode` 设置
- GLM 平台需要 `clickMode: 'mouseup'`
- 检查按钮是否被禁用

### 4. React/Angular 组件不响应

- 使用 `inputMode: 'nativeSetter'`
- 确保触发了完整的事件序列

---

## manifest.json 配置示例

```json
{
  "content_scripts": [
    {
      "matches": ["https://platform-domain.com/*"],
      "js": ["contentScripts/platform_name.js"],
      "run_at": "document_idle"
    }
  ]
}
```

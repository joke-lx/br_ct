# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bro Chat (AI Assistant) is a browser extension that provides a unified interface for interacting with multiple AI platforms. It automates message sending across different AI platforms by simulating user interactions, and provides various utility features including a circular navigation menu, backup system, function execution, translation/OCR, and video control capabilities.

**Supported AI Platforms**: Yuanbao, Gemini, ChatGPT, Claude, Doubao, GLM, Tongyi, Google Studio, Grok, Notion AI

## Development Commands

### Loading the Extension
```bash
# In Chrome/Edge:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this directory (ext/)
```

### Testing
- Manual testing required for each AI platform
- Test each platform by navigating to its URL and using the popup
- Use DevTools (F12) for debugging:
  - **Service Worker**: chrome://extensions/ → Service worker link
  - **Popup**: Right-click popup → Inspect
  - **Content Scripts**: DevTools on the target page
  - **Options Page**: Right-click settings page → Inspect

### Building
- No build process - direct loading of source files
- Ensure [manifest.json](manifest.json) paths are correct for all referenced files
- ES6 modules are loaded directly by the browser

## Architecture

### Entry Point

**[background.js](background.js)** - Service worker that initializes all modules:

```javascript
// Initialization order matters:
setupTabUpdateListener();           // AI platform processor (legacy)
setupAIProcessorListener();         // AI platform message listener
setupFuncCommandListener();         // Function executor commands
setupFuncExecutorListener();        // Function executor messages
setTabTransListener();              // Goto/navigation server
startServer();                      // Word HTTP server
initVideoPlaneServer();             // Video plane server
initContextMenu();                  // Right-click menu
initBackupService();                // Backup service
setupBackupMessageListener();       // Backup message handler
setupTranslationModule();           // Translation/OCR module
```

### Directory Structure

```
ext/
├── manifest.json                    # Manifest v3 configuration
├── background.js                    # Service worker entry point
│
├── config/                          # Unified configuration
│   └── platformConfig.js            # Platform registry (add new platforms here)
│
├── popup/                           # Extension popup UI
│   ├── main/                        # Main popup module
│   │   ├── main.html               # Entry point
│   │   ├── main.js                 # Main popup logic
│   │   ├── mainUtils.js            # Core utilities
│   │   ├── main.css                # Styles
│   │   ├── dragDropHandler.js       # Drag-drop input
│   │   ├── platformRenderer.js      # Platform options renderer
│   │   ├── modules/                 # Sub-modules
│   │   │   ├── storage.js
│   │   │   ├── platformVisibility.js
│   │   │   └── uiHelpers.js
│   │   └── prompts/                # Message templates
│   │       ├── prompts.js
│   │       ├── promptsUI.js
│   │       └── groups/              # Prompt groups
│   ├── func_execute/                # Function execution UI
│   ├── translation/                 # Translation interface
│   └── binddom/                     # DOM binding UI
│
├── options/                         # Settings pages (iframe-based multi-page)
│   ├── options.html                 # Main settings wrapper with sidebar
│   ├── options.js                   # Navigation logic
│   ├── options.css                  # Blue theme styling
│   ├── platform/                    # Platform visibility settings
│   ├── storage/                     # Storage debugging tools
│   ├── menu/                        # Menu configuration (visual + JSON)
│   ├── backup/                      # Backup settings
│   └── api/                         # API settings
│
├── contentScripts/                  # Platform-specific content scripts
│   ├── chatgpt.js
│   ├── gemini.js
│   ├── claude.js
│   ├── doubao.js
│   ├── glm.js
│   ├── yuanbao.js
│   ├── tongyi.js
│   ├── googlestudio.js
│   ├── grok.js
│   ├── notionai.js
│   └── platform.template.js         # Template for new platforms
│
├── backgroudtask/                   # Background service modules
│   ├── ai_platform_processor.js     # AI platform task queue manager
│   ├── func_executor.js             # Generic function executor
│   ├── gotoServer.js                # Navigation & menu server
│   ├── word_http_server.js          # HTTP server for Word integration
│   ├── message_http_server.js       # Message server
│   ├── video_plane_server.js        # Video plane server
│   ├── backupService.js             # Backup service
│   └── translation/                 # Translation/OCR modules
│       ├── index.js                 # Main translation module
│       ├── contextMenu.js           # Translation context menu
│       ├── messageHandler.js        # Message handling
│       ├── ocr.js                   # OCR functionality
│       └── storage.js               # Translation storage
│
├── runjs/                           # Runtime scripts (injected content scripts)
│   ├── tripleSpace/
│   │   ├── tripleSpace.js           # Triple-click space popup
│   │   └── tripleSpace.css
│   ├── goto/
│   │   └── goto.js                  # Circular menu + navigation
│   ├── word/
│   │   └── word.js                  # Word integration
│   ├── bilibiliCleaner/
│   │   └── bilibiliCleaner.js       # Bilibili video page cleaner
│   └── translation/
│       ├── content.js               # Translation overlay
│       ├── content-ocr.js           # OCR overlay
│       ├── content.css
│       ├── content-ocr.css
│       └── lib/
│           ├── marked.min.js        # Markdown parser
│           └── katex.min.js         # Math rendering
│
├── funcs/                           # Executable utility functions
│   ├── 元素dom/                     # DOM manipulation
│   │   ├── input.js
│   │   ├── div_copy_input_dom.js
│   │   ├── div_Img_wrapper.js
│   │   └── videoControllerPlane/
│   ├── 平台专属/                    # Platform-specific scrapers
│   │   ├── bili/
│   │   ├── leecode/
│   │   ├── 腾讯文档/
│   │   └── boss直聘/
│   ├── goto/                        # Navigation utilities
│   ├── word/                        # Word-related utilities
│   └── x/                           # Experimental features
│
└── icons/                           # Extension icons (16, 48, 128)
```

### Core Background Modules

#### [ai_platform_processor.js](backgroudtask/ai_platform_processor.js)

**Purpose**: Manages message queuing and delivery to AI platforms

**Key Features**:
- Serial and concurrent processing modes
- Tab lifecycle management (find/create/activate)
- Dynamic content script injection
- Timeout management and error recovery
- Smart tab reuse for same domains

**Key Functions**:
- `processTaskQueueConcurrent(queue, config)` - Concurrent batch processing
- `processSingleTaskConcurrent(task, options)` - Single task execution
- `findOrCreatePlatformTab(platform, shouldActive)` - Tab management
- `waitForTabComplete(tabId, timeout)` - Page load waiting
- `injectAndExecuteScript(tabId, platform, message, timeout)` - Script injection
- `closeAllAITabs()` - Close all AI platform tabs

**Configuration Options**:
```javascript
{
  maxConcurrent: 3,      // Max concurrent platforms
  batchDelay: 300,       // Delay between batches (ms)
  tabLoadTimeout: 8000,  // Page load timeout (ms)
  scriptTimeout: 5000    // Script execution timeout (ms)
}
```

**Platform URLs**:
```javascript
export const platformUrls = {
    yuanbao: 'https://yuanbao.tencent.com/chat/',
    gemini: 'https://gemini.google.com/app',
    chatgpt: 'https://chatgpt.com',
    claude: 'https://claude.ai',
    doubao: 'https://www.doubao.com/chat/',
    glm: "https://chatglm.cn/main/alltoolsdetail",
    tongyi: "https://www.qianwen.com",
    googlestudio: 'https://aistudio.google.com/',
};
```

#### [func_executor.js](backgroudtask/func_executor.js)

**Purpose**: Executes utility functions from `funcs/` directory

**Key Features**:
- Keyboard shortcut handling (Alt+C, Alt+D, Alt+F)
- Dynamic script injection via `chrome.scripting.executeScript`
- Calls `main()` function in injected scripts

**Key Functions**:
- `executeFunctionScript(scriptFile, sendResponse)` - Execute a function script
- `setupFuncCommandListener()` - Register keyboard shortcuts
- `setupMessageListener()` - Handle "executeFunctionScript" messages

**Function Script Pattern**:
```javascript
// funcs/custom/myFunction.js
export async function main() {
  // Function logic
  return { success: true, data: ... };
}
```

#### [gotoServer.js](backgroudtask/gotoServer.js)

**Purpose**: Handles URL navigation, circular menu, and context menu

**Key Features**:
- Smart tab management (reuse existing tabs when possible)
- Browser history retrieval (last 24 hours)
- Context menu for adding links to circular menu
- Domain name extraction for clean display
- Custom menu configuration management

**Actions**:
- `openUrl` - Open URL with smart tab reuse
- `getMenuData` - Get menu configuration
- `getHistory` - Get browser history

**Context Menu**:
- `addToCircularMenu` - Add link to "📄 我的收藏" group

**Domain Name Mapping**:
```javascript
const domainMap = {
  'bilibili': 'B站',
  'github': 'GitHub',
  'zhihu': '知乎',
  'taobao': '淘宝',
  // ... and more
};
```

**Storage Keys**:
- `customMenuConfig` - User-defined menu items (takes precedence over default)

#### [backupService.js](backgroudtask/backupService.js)

**Purpose**: Automated and manual backup of chrome.storage.local

**Key Features**:
- Scheduled backups via chrome.alarms
- Exports to JSON files in Downloads folder
- Automatic cleanup of old backups
- Configurable backup interval and retention

**Key Functions**:
- `initBackupService()` - Initialize backup service
- `performBackup()` - Execute automatic backup (silent)
- `performManualBackup(saveAs)` - Execute manual backup
- `updateBackupSettings(settings)` - Update backup configuration
- `cleanupOldBackups(settings)` - Remove old backup files

**Storage Keys**:
- `backupSettings` - Backup configuration
- `lastBackupTime` - Timestamp of last successful backup

**Default Settings**:
```javascript
{
  enabled: false,
  intervalHours: 24,
  maxBackups: 7,
  folderName: 'bro_chat_backups',
  saveAs: false
}
```

**Important Notes**:
- Uses chrome.downloads API (Service Worker limitation)
- Auto-backup always uses `saveAs: false`
- Manual backup respects user's `saveAs` setting

#### translation/index.js

**Purpose**: Translation and OCR functionality

**Key Features**:
- Text translation overlay
- OCR for images
- Context menu integration
- Markdown rendering with KaTeX support

### Runtime Scripts (runjs/)

#### [goto/goto.js](runjs/goto/goto.js) - Circular Menu

**Features**:
- Floating circular menu activated by hover
- Displays custom menu + browser history (last 24 hours)
- Drag to reposition, position saved to localStorage
- Smart tab navigation for URLs (reuses existing tabs)

**Storage**:
- `localStorage.menuPosition` - Menu position {left, top}
- `chrome.storage.local.customMenuConfig` - Custom menu configuration

**Menu Structure**:
1. Default menu from `gotoServer.js` menuData
2. Custom menu from `customMenuConfig` (takes precedence)
3. History group from browser history

**Interaction**:
- Hover to expand
- Click to close
- Drag to reposition
- Scroll to auto-close

#### tripleSpace/tripleSpace.js

**Features**:
- Triple-click activation popup
- Quick message input
- Recording functionality

### Content Scripts Pattern

Each AI platform script ([contentScripts/{platform}.js](contentScripts/)) follows this pattern:

```javascript
// 1. Prevent duplicate injection
if (window.{platform}Injected) return;
window.{platform}Injected = true;

// 2. Define selectors
const SELECTORS = {
  input: '//xpath_to_input',
  sendButton: '//xpath_to_send_button'
};

// 3. Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendMessage') {
    // Implementation
    sendResponse({ status: 'ok' });
  }
  return true; // Keep message channel open
});
```

### Storage Architecture

**chrome.storage.local keys:**

| Key | Type | Description |
|-----|------|-------------|
| `messageHistory` | Array | Last 5 sent messages |
| `platformStates` | Object | Platform checkbox states |
| `platformVisibility` | Object | Show/hide platform options |
| `customMenuConfig` | Object | User-defined circular menu items |
| `backupSettings` | Object | Backup configuration |
| `lastBackupTime` | Number | Timestamp of last backup |
| `promptQueue` | Array | Queue of messages to process |
| `currentTasks` | Object | Active task processing state |

**localStorage keys:**

| Key | Type | Description |
|-----|------|-------------|
| `menuPosition` | Object | Circular menu position {left, top} |

### Message Passing Patterns

```
Popup → Background (action: processTaskQueue)
  → Background manages queue
  → For each platform: find/create tab → inject content script
  → Content script → Background (status: ok/error)
  → Continue to next platform

Popup → Background (action: executeFunctionScript)
  → Background injects script from funcs/
  → Script's main() executes
  → Result returned to popup

Context Menu → Background (menuItemId: addToCircularMenu)
  → addToCustomMenu() adds to customMenuConfig
  → Notification shown to user

Runtime Scripts ↔ Background
  → goto.js: getMenuData, getHistory, openUrl
  → Translation scripts: translation messages
```

### Options Page Architecture

The options page uses an iframe-based multi-page architecture:

1. **[options.html](options/options.html)** - Sidebar navigation + iframe container
2. **[options.js](options/options.js)** - Handles nav item clicks by updating iframe.src
3. **Sub-pages**: platform/, storage/, menu/, backup/, api/ loaded in iframe

**CSS Theme**: Blue (#3b82f6) theme throughout

### Keyboard Shortcuts (Manifest)

| Shortcut | Command | File |
|----------|---------|------|
| `Alt+C` | execute_div_copy | [元素dom/div_copy_wrapper.js](funcs/元素dom/div_copy_wrapper.js) |
| `Alt+D` | imgs_picker | [元素dom/div_Img_wrapper.js](funcs/元素dom/div_Img_wrapper.js) |
| `Alt+F` | copy_file | [元素dom/copy2file.js](funcs/元素dom/copy2file.js) |

### Circular Menu System

The circular menu ([runjs/goto/goto.js](runjs/goto/goto.js)) provides:

**Default Menu**: From [gotoServer.js](backgroudtask/gotoServer.js) menuData (feed, 面包, 网站跳转3)

**Custom Menu**: From `customMenuConfig` storage (takes precedence if exists)

**History Group**: Browser history from last 24 hours, with clean domain names

**Navigation**: Smart tab reuse for same domains

**Adding items via right-click**:
- Right-click any link or page → "➕ 添加到圆形菜单"
- Adds to "📄 我的收藏" group in customMenuConfig
- Domain names extracted cleanly (www.taobao.com → "淘宝")

## Common Development Tasks

### Adding a New AI Platform

**统一配置架构**: 所有平台配置集中在 [config/platformConfig.js](config/platformConfig.js)，添加新平台只需修改 2 个文件：

#### 步骤 1: 创建 Content Script
复制 [contentScripts/platform.template.js](contentScripts/platform.template.js) 创建新文件 `contentScripts/{platform}.js`

```javascript
// 修改平台配置
const PLATFORM_CONFIG = {
  name: 'YourPlatform',        // 平台名称
  hostname: 'example.com',     // 域名检查
  // ... 其他配置保持默认
};

// 配置选择器
const INPUT_SELECTORS = [
  { type: 'css', value: 'your_input_selector' },
];

const BUTTON_SELECTORS = [
  { type: 'css', value: 'your_button_selector' },
];
```

#### 步骤 2: 更新平台配置
在 [config/platformConfig.js](config/platformConfig.js) 中添加:

```javascript
export const PLATFORM_CONFIG = {
  // ...existing platforms
  yourplatform: {
    name: 'YourPlatform',
    icon: 'Y',
    shortIcon: 'Y',
    color: '#ff0000',
    url: 'https://example.com',
    defaultVisible: true
  }
};
```

#### 自动生效的模块（无需手动修改）:
- ✅ Popup 平台选项 (动态从 PLATFORM_CONFIG 生成)
- ✅ 设置页面平台列表
- ✅ HTTP API 平台验证
- ✅ AI 消息处理器

### Adding a New Function

1. **Create file in** `funcs/{category}/{functionName}.js`:
   ```javascript
   export async function main() {
     // Function logic
     return { success: true, data: ... };
   }
   ```

2. **Add to popup UI** or register in [manifest.json](manifest.json) for keyboard shortcut

3. **Register in** [func_executor.js](backgroudtask/func_executor.js) if using keyboard shortcut

### Adding a New Settings Page

1. **Create HTML file** in `options/{pageName}/`:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <link rel="stylesheet" href="../options.css">
   </head>
   <body>
     <!-- Your content -->
     <script src="settings.js"></script>
   </body>
   </html>
   ```

2. **Add nav item** to [options/options.html](options/options.html):
   ```html
   <div class="nav-item" data-page="pageName/index.html">Page Name</div>
   ```

## Debugging Tips

### Service Worker
- Visit `chrome://extensions/`
- Find extension, click "Service worker" link
- View console logs
- Use `console.log('[ModuleName]', ...)` for better filtering

### Popup
- Right-click extension icon → "检查"
- DevTools opens for popup
- Check background.js in Service Worker DevTools

### Content Scripts
- Open target platform page
- Press F12
- Check console for content script logs
- Look for `{platform}Injected` checks

### Common Issues

1. **"Content script not found"**
   - Check [manifest.json](manifest.json) web_accessible_resources
   - Verify file path in `chrome.scripting.executeScript`

2. **"Message not received"**
   - Ensure `return true` for async responses
   - Check if listener is properly registered

3. **"Tab not found"**
   - Check platform URL matching logic
   - Verify tab is fully loaded before injection

4. **"Storage quota exceeded"**
   - Check if storing too much data
   - Implement cleanup for old data

## Important Technical Notes

### ES Modules
- All imports use ES6 module syntax
- Use `export` and `import` statements
- Service Worker supports modules natively

### Content Security Policy
- No inline event handlers allowed
- Use `addEventListener` instead of `onclick`
- No `eval()` or similar functions

### Service Worker Limitations
- No DOM access
- No `URL.createObjectURL` (use Data URIs instead)
- No `XMLHttpRequest` (use `fetch` instead)
- Lifetime is unpredictable (may be terminated)

### Data URI for Downloads
```javascript
// Service Worker compatible approach
const encoder = new TextEncoder();
const data = encoder.encode(content);
let binary = '';
for (let i = 0; i < data.length; i++) {
  binary += String.fromCharCode(data[i]);
}
const base64Content = btoa(binary);
const dataUri = `data:application/json;base64,${base64Content}`;
```

### Chrome Storage API
- All async operations use callbacks
- Consider wrapping in Promises for cleaner code
- Storage quota is ~10MB per extension

### Tab Management Best Practices
- Reuse existing tabs for same domains
- Use `active: false` for background operations
- Wait for `status: 'complete'` before injecting scripts
- Handle tab close events gracefully

### Context Menus
- Requires `contextMenus` permission in [manifest.json](manifest.json)
- Create in `chrome.runtime.onInstalled` listener
- Handle clicks in `chrome.contextMenus.onClicked`

## Known Issues & Limitations

1. **Backup Storage**: Uses chrome.downloads API
   - Cannot specify arbitrary file paths
   - Files go to Downloads folder by default
   - User wants specific directory support (not possible in Chrome)

2. **Service Worker Persistence**: SW may be terminated
   - No guaranteed long-running background
   - State must be stored in chrome.storage
   - Use chrome.alarms for scheduled tasks

3. **Content Script Injection Race Conditions**
   - Page may not be fully ready
   - Add delays or wait for specific elements
   - Use `run_at: 'document_idle'` when possible

4. **XPath Selector Fragility**
   - Platform UI changes may break selectors
   - Keep selectors updated with platform changes
   - Consider multiple selector strategies

## Testing Checklist

Before committing changes:

- [ ] Service Worker starts without errors
- [ ] Popup opens and functions correctly
- [ ] At least one AI platform sends messages successfully
- [ ] Circular menu displays and navigation works
- [ ] New functions execute properly
- [ ] Storage operations complete without errors
- [ ] No console errors in DevTools
- [ ] All existing features still work

## Code Style Guidelines

- Use ES6+ features (async/await, arrow functions, template literals)
- Follow the existing file structure
- Add JSDoc comments for exported functions
- Use meaningful variable and function names
- Keep functions focused and small
- Handle errors appropriately with try/catch
- Use console.log with module prefixes for debugging

## File References

- [manifest.json](manifest.json) - Extension configuration
- [background.js](background.js) - Service worker entry point
- [backgroudtask/ai_platform_processor.js](backgroudtask/ai_platform_processor.js) - AI platform manager
- [backgroudtask/func_executor.js](backgroudtask/func_executor.js) - Function executor
- [backgroudtask/gotoServer.js](backgroudtask/gotoServer.js) - Navigation/menu server
- [backgroudtask/backupService.js](backgroudtask/backupService.js) - Backup service
- [popup/main/mainUtils.js](popup/main/mainUtils.js) - Popup core logic
- [runjs/goto/goto.js](runjs/goto/goto.js) - Circular menu
- [contentScripts/platform.template.js](contentScripts/platform.template.js) - Platform template

## Quick Reference

### Platform URLs
| Platform | URL |
|----------|-----|
| Yuanbao | https://yuanbao.tencent.com/chat/ |
| Gemini | https://gemini.google.com/app |
| ChatGPT | https://chatgpt.com |
| Claude | https://claude.ai |
| Doubao | https://www.doubao.com/chat/ |
| GLM | https://chatglm.cn/main/alltoolsdetail |
| Tongyi | https://www.qianwen.com |
| Google Studio | https://aistudio.google.com/ |

### Storage Keys Reference
- `customMenuConfig` - Custom circular menu
- `backupSettings` - Backup configuration
- `messageHistory` - Message history (5 items)
- `platformStates` - Platform selection state
- `platformVisibility` - Platform visibility settings
- `menuPosition` (localStorage) - Menu position

### Message Actions
- `processTaskQueue` - Send messages to AI platforms
- `executeFunctionScript` - Run a function script
- `openUrl` - Open URL with smart tab reuse
- `getMenuData` - Get circular menu data
- `getHistory` - Get browser history
- `performBackup` - Execute backup
- `performManualBackup` - Execute manual backup
- `getBackupSettings` - Get backup settings
- `updateBackupSettings` - Update backup settings

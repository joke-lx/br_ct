# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bro Chat (AI Assistant) is a browser extension that provides a unified interface for interacting with multiple AI platforms. It automates message sending across different AI platforms by simulating user interactions, and provides various utility features including a circular navigation menu, backup system, and function execution capabilities.

**Supported AI Platforms**: Yuanbao, Gemini, ChatGPT, Claude, Doubao, GLM, Tongyi, Google Studio

## Development Commands

### Loading the Extension
```bash
# In Chrome/Edge:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this directory
```

### Testing
- Manual testing required for each AI platform
- Test each platform by navigating to its URL and using the popup
- Use DevTools (F12) for debugging popup, content scripts, and service worker

### Building
- No build process - direct loading of source files
- Ensure manifest.json paths are correct for all referenced files

## Architecture

### Entry Point

**background.js** - Service worker that initializes all modules:
- `setupTabUpdateListener()` - AI platform processor
- `setupFuncCommandListener()` / `setupFuncExecutorListener()` - Function executor
- `setTabTransListener()` / `initContextMenu()` - Goto/navigation server
- `startServer()` - Word HTTP server
- `initVideoPlaneServer()` - Video plane server
- `initBackupService()` / `setupBackupMessageListener()` - Backup service

### Directory Structure

```
/
├── manifest.json              # Manifest v3 configuration
├── background.js              # Service worker entry point
│
├── popup/                     # Extension popup UI
│   ├── popup.html
│   ├── popup/
│   │   ├── popup.js           # Main popup logic
│   │   ├── popupUtils.js      # Core utilities
│   │   └── dragDropHandler.js # Drag-drop input
│   ├── promots/               # Message templates
│   └── func_execute/          # Function execution UI
│
├── options/                   # Settings pages (iframe-based multi-page)
│   ├── options.html           # Main settings wrapper with sidebar
│   ├── options.js             # Navigation logic
│   ├── options.css            # Blue theme styling
│   ├── platform.html          # Platform visibility settings
│   ├── platform.js
│   ├── storage.html           # Storage debugging tools
│   ├── storage.js
│   ├── menu.html              # Menu configuration (visual + JSON)
│   ├── menu.js
│   └── backup.html            # Backup settings
│       └── backup.js
│
├── contentScripts/            # Platform-specific content scripts
│   ├── chatgpt.js
│   ├── gemini.js
│   ├── claude.js
│   ├── doubao.js
│   ├── glm.js
│   ├── yuanbao.js
│   └── ...
│
├── backgroudtask/            # Background service modules
│   ├── ai_platform_processor.js  # AI platform task queue manager
│   ├── func_executor.js          # Generic function executor
│   ├── gotoServer.js              # Navigation & menu server
│   ├── word_http_server.js        # HTTP server for Word integration
│   ├── message_http_server.js    # Message server
│   ├── video_plane_server.js     # Video plane server
│   └── backupService.js           # Backup service
│
├── runjs/                     # Runtime scripts (injected content scripts)
│   ├── tripleSpace/
│   │   ├── tripleSpace.js        # Triple-click space popup
│   │   └── tripleSpace.css
│   ├── goto/
│   │   └── goto.js                # Circular menu + navigation
│   └── word/
│       └── word.js                # Word integration
│
├── funcs/                     # Executable utility functions
│   ├── 平台专属/             # Platform-specific scrapers
│   ├── 元素dom/              # DOM manipulation
│   ├── goto/                 # Navigation utilities
│   └── word/                 # Word-related utilities
│
└── icons/                    # Extension icons
```

### Core Background Modules

#### ai_platform_processor.js
- **Purpose**: Manages message queuing and delivery to AI platforms
- **Features**:
  - Serial and concurrent processing modes
  - Tab lifecycle management (find/create/activate)
  - Dynamic content script injection
  - Timeout management and error recovery
- **Key Function**: `processTaskQueue(tasks, mode)`

#### func_executor.js
- **Purpose**: Executes utility functions from `funcs/` directory
- **Features**:
  - Keyboard shortcut handling (Alt+C, Alt+D, Alt+F)
  - Dynamic script injection via `chrome.scripting.executeScript`
  - Calls `main()` function in injected scripts
- **Key Functions**: `executeFunctionScript(funcPath)`, `setupFuncCommandListener()`

#### gotoServer.js
- **Purpose**: Handles URL navigation, circular menu, and context menu
- **Features**:
  - Smart tab management (reuse existing tabs when possible)
  - Browser history retrieval
  - Context menu for adding links to circular menu
  - Domain name extraction for clean display (taobao.com → "淘宝")
- **Actions**: `openUrl`, `getMenuData`, `getHistory`, `addToCircularMenu`
- **Storage Key**: `customMenuConfig` - user-defined menu items

#### backupService.js
- **Purpose**: Automated and manual backup of chrome.storage.local
- **Features**:
  - Scheduled backups via chrome.alarms
  - Exports to JSON files in Downloads/bro_chat_backups/
  - Automatic cleanup of old backups
- **Known Issue**: `downloads.search` uses wrong format for `filenameRegex` (should be string, not object)

### Runtime Scripts (runjs/)

#### goto/goto.js - Circular Menu
- **Features**:
  - Floating circular menu activated by hover
  - Displays custom menu + browser history (last 24 hours)
  - Drag to reposition, position saved to localStorage
  - Smart tab navigation for URLs (reuses existing tabs)
- **Storage**: localStorage for `menuPosition`, chrome.storage.local for `customMenuConfig`
- **Menu Structure**:
  - Default menu from `gotoServer.js` (feed, 面包, 网站跳转3)
  - Custom menu from `customMenuConfig` (takes precedence)
  - History group from browser history

#### tripleSpace/tripleSpace.js
- **Features**:
  - Triple-click activation popup
  - Quick message input
  - Recording functionality

### Content Scripts Pattern

Each AI platform script (`contentScripts/{platform}.js`) follows this pattern:

1. **State Management**: Check `window.{platform}Injected` to prevent duplicate injection
2. **Selectors**: Define XPath selectors for input fields and buttons
3. **Message Handler**: Listen for `sendMessage` action from background
4. **Execution**: Find elements, populate input, trigger click, report result

### Storage Architecture

**chrome.storage.local keys:**
- `messageHistory` - Last 5 sent messages
- `platformStates` - Platform checkbox states
- `platformVisibility` - Show/hide platform options
- `lastMessage` - Auto-saved input content
- `selectedOptimizer` - Prompt optimizer selection
- `customMenuConfig` - User-defined circular menu items
- `backupSettings` - Backup configuration (enabled, intervalHours, maxBackups)
- `lastBackupTime` - Timestamp of last successful backup
- `promptQueue` - Queue of messages to process
- `currentTasks` - Active task processing state

**localStorage keys:**
- `menuPosition` - Circular menu position {left, top}

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
  → Always adds to "📄 我的收藏" group

Options → Background (various actions)
  → getMenuData, getHistory, performBackup, etc.
```

### Options Page Navigation

The options page uses an iframe-based multi-page architecture:

1. **options.html** - Sidebar navigation + iframe container
2. **options.js** - Handles nav item clicks by updating iframe.src
3. **Sub-pages**: platform.html, storage.html, menu.html, backup.html loaded in iframe

**CSS Theme**: Blue (#3b82f6) theme throughout

### Keyboard Shortcuts (Manifest)

- `Alt+C` - Execute div copy script
- `Alt+D` - Execute image picker
- `Alt+F` - Save clipboard content to file

### Circular Menu System

The circular menu (`runjs/goto/goto.js`) provides:
- **Default menu**: From `gotoServer.js` menuData (feed, 面包, 网站跳转3)
- **Custom menu**: From `customMenuConfig` storage (takes precedence if exists)
- **History group**: Browser history from last 24 hours, with clean domain names
- **Navigation**: Smart tab reuse for same domains

**Adding items via right-click**:
- Right-click any link or page → "➕ 添加到圆形菜单"
- Adds to "📄 我的收藏" group in customMenuConfig
- Domain names extracted cleanly (www.taobao.com → "淘宝")

**Domain Name Mapping** (gotoServer.js):
```javascript
const domainMap = {
  'bilibili': 'B站', 'github': 'GitHub', 'gitee': 'Gitee',
  'zhihu': '知乎', 'douyin': '抖音', 'notion': 'Notion',
  'amap': '高德地图', 'taobao': '淘宝', 'tmall': '天猫',
  'jd': '京东', 'google': 'Google', 'baidu': '百度',
  // ... and more
};
```

## Common Development Tasks

### Adding a New AI Platform

1. Create `contentScripts/{platform}.js`:
   ```javascript
   if (window.{platform}Injected) return;
   window.{platform}Injected = true;

   const SELECTORS = {
     input: '//xpath_to_input',
     sendButton: '//xpath_to_send_button'
   };

   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.action === 'sendMessage') {
       // Implementation
     }
   });
   ```

2. Add to `backgroudtask/ai_platform_processor.js`:
   ```javascript
   platformUrls: {
     // ...existing
     '{platform}': 'https://{platform-domain}.com'
   }
   ```

3. Add to popup checkbox list in `popup/popup.html`

### Adding a New Function

1. Create file in `funcs/{category}/{functionName}.js`:
   ```javascript
   export async function main() {
     // Function logic
     return { success: true, data: ... };
   }
   ```

2. Add to popup UI or register in manifest.json for keyboard shortcut

### Debugging Tips

- **Service Worker**: chrome://extensions/ → Service worker link
- **Popup**: Right-click popup → Inspect
- **Content Scripts**: DevTools on the target page
- **Options Page**: Right-click settings page → Inspect
- **Console logs**: Preserved across all modules

### Known Issues

1. **backupService.js line 218**: `downloads.search` uses wrong format
   - Current: `{ filenameRegex: '^bro_chat_backups/bro_chat_backup_.*\\.json$' }`
   - Should be: `filenameRegex: '^bro_chat_backups/bro_chat_backup_.*\\.json$'` (string directly in query)
   - Error: "Invalid type: expected string, found object"

2. **Backup Storage**: Currently uses chrome.downloads API
   - User wants to save to specific directory instead
   - Chrome extensions have limited filesystem access (cannot specify arbitrary paths)

## Important Technical Notes

1. **ES Modules**: All imports use ES6 module syntax
2. **Content Security Policy**: No inline event handlers allowed
3. **Service Worker Limitations**: No DOM access, no URL.createObjectURL
4. **Data URI for Downloads**: Use base64-encoded data URIs for file downloads in service worker
5. **Chrome Storage API**: All async operations use callbacks
6. **Tab Management**: Reuse existing tabs for same domain/path when possible
7. **Context Menus**: Requires `contextMenus` permission in manifest.json

# Project Index: Bro Chat (AI Assistant Extension)

Generated: 2026-04-10

## Project Overview

**Type:** Chrome Extension (Manifest V3)
**Purpose:** Multi-platform AI assistant orchestration tool supporting 11 AI platforms
**Tech Stack:** Vanilla JS, ES6 Modules, Chrome Extension APIs

## Entry Points

| File | Type | Description |
|------|------|-------------|
| `background.js` | Service Worker | Main entry - initializes all modules |
| `manifest.json` | Config | Extension configuration (v3) |
| `popup/main/main.js` | Popup | Main popup UI logic |

## Platform Configuration (11 Platforms)

| Platform | ID | URL |
|----------|-----|-----|
| 元宝 | `yuanbao` | https://yuanbao.tencent.com/chat/ |
| Gemini | `gemini` | https://gemini.google.com/app |
| ChatGPT | `chatgpt` | https://chatgpt.com |
| Claude | `claude` | https://claude.ai |
| 豆包 | `doubao` | https://www.doubao.com/chat/ |
| 智谱 | `glm` | https://chatglm.cn/main/alltoolsdetail |
| GAS | `googlestudio` | https://aistudio.google.com/ |
| 通义 | `tongyi` | https://www.qianwen.com |
| Grok | `grok` | https://grok.com |
| NotionAI | `notionai` | https://www.notion.so/chat |
| Zai | `zai` | https://chat.z.ai/ |

## Directory Structure

```
ext/
├── background.js              # Service worker entry point
├── manifest.json              # Extension manifest v3
├── config/
│   └── platformConfig.js      # Unified platform registry
├── contentScripts/            # Platform-specific scripts (11 files)
│   ├── gemini.js, chatgpt.js, claude.js, doubao.js
│   ├── yuanbao.js, glm.js, googlestudio.js, tongyi.js
│   ├── grok.js, notionai.js, zai.js
│   └── platform.template.js   # Template for new platforms
├── backgroudtask/            # Background service modules
│   ├── ai_platform_processor.js   # AI message queue & delivery
│   ├── func_executor.js           # Utility function executor
│   ├── gotoServer.js              # Navigation & circular menu
│   ├── backupService.js           # Chrome storage backup
│   ├── video_plane_server.js      # Video plane server
│   ├── word_http_server.js       # Word HTTP server
│   ├── message_http_server.js    # Message server
│   └── translation/              # Translation/OCR module
│       ├── index.js, contextMenu.js, messageHandler.js
│       ├── ocr.js, storage.js
├── popup/                     # Extension popup UI
│   ├── main/                  # Main popup module
│   │   ├── main.html         # Entry point
│   │   ├── main.js          # Main popup logic
│   │   ├── mainUtils.js     # Core utilities
│   │   ├── main.css         # Styles
│   │   ├── dragDropHandler.js   # Drag-drop input
│   │   ├── platformRenderer.js  # Dynamic platform options
│   │   ├── modules/         # Sub-modules
│   │   │   ├── storage.js
│   │   │   ├── platformVisibility.js
│   │   │   └── uiHelpers.js
│   │   └── prompts/         # Message templates
│   │       ├── prompts.js, promptsUI.js
│   │       ├── promptsUI.css
│   │       └── groups/      # Prompt groups
│   ├── func_execute/         # Function execution UI
│   ├── translation/          # Translation interface
│   └── binddom/             # DOM binding UI
├── options/                   # Settings pages (iframe-based)
│   ├── options.html, options.js, options.css
│   ├── platform/, storage/, menu/, backup/, api/
│   └── ocr/
├── runjs/                     # Runtime injected scripts
│   ├── goto/goto.js          # Circular navigation menu
│   ├── tripleSpace/           # Triple-click space popup
│   ├── word/word.js           # Word integration
│   ├── bilibiliCleaner/       # Bilibili video cleaner
│   └── translation/           # Translation overlay + lib/
├── funcs/                     # Executable utility functions
│   ├── 元素dom/               # DOM manipulation
│   ├── 平台专属/              # Platform scrapers (bili, leecode, 腾讯文档, boss直聘)
│   └── x/                     # Experimental features
└── modules/                   # Shared modules
    ├── bookmarks/
    └── translation/
```

## Core Modules

### AI Platform Processor (`backgroudtask/ai_platform_processor.js`)
- **Exports:** `processTaskQueueConcurrent()`, `setupMessageListener()`, `setupTabUpdateListener()`, `closeAllAITabs()`
- **Purpose:** Manages message queuing and delivery to AI platforms with concurrent processing

### Function Executor (`backgroudtask/func_executor.js`)
- **Exports:** `executeFunctionScript()`, `setupFuncCommandListener()`
- **Purpose:** Executes utility functions from `funcs/` directory via keyboard shortcuts (Alt+C/D/F)

### Goto Server (`backgroudtask/gotoServer.js`)
- **Exports:** `setTabTransListener()`, `initContextMenu()`
- **Purpose:** URL navigation, circular menu, context menu management

### Backup Service (`backgroudtask/backupService.js`)
- **Exports:** `initBackupService()`, `performBackup()`, `setupBackupMessageListener()`
- **Purpose:** Automated Chrome storage backup to Downloads folder

### Platform Config (`config/platformConfig.js`)
- **Exports:** `PLATFORM_CONFIG`, `getPlatformUrls()`, `getPlatformIds()`, `getPlatformConfig()`
- **Purpose:** Unified configuration for all AI platforms

## Keyboard Shortcuts

| Shortcut | Action | File |
|----------|--------|------|
| `Alt+C` | Execute div copy | `funcs/元素dom/div_copy_wrapper.js` |
| `Alt+D` | Image picker | `funcs/元素dom/div_Img_wrapper.js` |
| `Alt+F` | Copy file | `funcs/元素dom/copy2file.js` |

## Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `messageHistory` | Array | Last 5 sent messages |
| `platformStates` | Object | Platform checkbox states |
| `platformVisibility` | Object | Show/hide platform options |
| `customMenuConfig` | Object | User-defined circular menu |
| `backupSettings` | Object | Backup configuration |
| `lastBackupTime` | Number | Last backup timestamp |
| `promptQueue` | Array | Message queue to process |
| `actionsQueue` | Array | AI task queue |

## Content Script Pattern

Each platform in `contentScripts/{platform}.js` follows this pattern:
1. Duplicate injection prevention (`window.{platform}Injected`)
2. Platform config (hostname, selectors, click/input mode)
3. `INPUT_SELECTORS` / `BUTTON_SELECTORS` array
4. `waitForElement()` with fallback smart discovery
5. `sendChatMessage()` main function
6. `chrome.runtime.onMessage` listener for `sendMessage` action

## Quick Reference

**Load Extension:** `chrome://extensions/` → Developer mode → Load unpacked → select `ext/`
**Debug Service Worker:** `chrome://extensions/` → Service worker link
**Debug Popup:** Right-click popup → Inspect
**Debug Content Script:** F12 on target page → Console

## Adding New Platform

1. Copy `contentScripts/platform.template.js` → `contentScripts/{platform}.js`
2. Update selectors in new file
3. Add entry in `config/platformConfig.js`
4. Auto-registered (popup, settings, processor update automatically)

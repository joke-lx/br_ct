# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension called "Bro Chat" (AI Assistant) that provides a unified interface for interacting with multiple AI platforms including Yuanbao, Gemini, ChatGPT, Claude, Doubao, and GLM. The extension automates message sending across different AI platforms by simulating user interactions.

## Architecture

### Core Components

- **background.js**: Main service worker that coordinates between popup, content scripts, and backend tasks
- **popup/**: Extension popup interface with drag-drop functionality and message management
- **contentScripts/**: Platform-specific scripts for each AI platform (Yuanbao, Gemini, ChatGPT, etc.)
- **backgroudtask/**: Background processing modules including AI platform processor and function executor
- **funcs/**: Reusable utility functions organized by functionality
- **tripleSpace/**: Triple-click space functionality

### Key Patterns

1. **Platform-Specific Adapters**: Each AI platform has its own content script with unified messaging interface
2. **Task Queue System**: Background processes actions sequentially using chrome.storage.local
3. **Dynamic Script Injection**: Functions are injected on-demand using chrome.scripting.executeScript
4. **ES Modules**: Uses modern ES module imports throughout the codebase

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
```bash
# No automated tests - manual testing required
# Test each platform by navigating to its URL and using the popup
```

### Building
```bash
# No build process - direct loading of source files
# Ensure manifest.json paths are correct for all referenced files
```

## File Structure

```
/
├── manifest.json              # Extension manifest (manifest v3)
├── background.js              # Service worker entry point
├── popup/                     # Extension popup UI
│   ├── popup.html
│   ├── popup/
│   │   ├── popup.js
│   │   ├── popupUtils.js
│   │   └── dragDropHandler.js
│   ├── promots/              # Message templates
│   ├── func_execute/         # Function execution UI
│   └── options/              # Options page
├── contentScripts/           # Platform-specific scripts
│   ├── chatgpt.js
│   ├── gemini.js
│   ├── claude.js
│   ├── doubao.js
│   ├── glm.js
│   └── yuanbao.js
├── backgroudtask/            # Background processors
│   ├── ai_platform_processor.js  # AI platform task queue
│   ├── func_executor.js          # Generic function execution
│   ├── word_http_server.js       # HTTP server for Word integration
│   └── clipboard2file.js         # Clipboard to file functionality
├── funcs/                     # Reusable functions
│   ├── 平台专属/             # Platform-specific utilities
│   ├── 元素dom/              # DOM manipulation utilities
│   ├── goto/                 # Navigation utilities
│   └── word/                 # Word integration
└── tripleSpace/              # Triple-click space feature
    ├── tripleSpace.js
    └── tripleSpace.css
```

## Key Technical Details

### Platform Detection and Script Injection
- Each AI platform script (`contentScripts/{platform}.js`) is injected based on URL matching
- Scripts use XPath and CSS selectors to find input elements and buttons
- Unified message passing via `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`

### Function Execution System
- Functions in `funcs/` directory can be executed via the popup or keyboard shortcuts
- Each function script should export a `main()` function
- Execution handled by `backgroudtask/func_executor.js`

### Storage
- Uses `chrome.storage.local` for persisting:
  - Message history (last 5 messages)
  - Selected optimizer settings
  - Task queues for background processing

### Keyboard Shortcuts
- `Alt+C`: Execute div copy script
- `Alt+D`: Execute image picker
- `Alt+F`: Save clipboard content to file

## Common Development Tasks

### Adding a New AI Platform
1. Create `contentScripts/{platform}.js` with platform-specific selectors and logic
2. Add platform URL to `backgroudtask/ai_platform_processor.js` platformUrls object
3. Include platform in popup UI checkboxes if needed

### Adding a New Function
1. Create function file in appropriate `funcs/` subdirectory
2. Export a `main()` function that contains the core logic
3. Add function to popup UI or keyboard shortcuts in manifest.json

### Debugging
- Use browser DevTools for popup and content script debugging
- Service worker debugging via chrome://extensions/ service worker inspector
- Console logs are preserved across all modules

## Platform-Specific Notes

### Content Script Structure
Each platform script should:
- Export XPath selectors for input fields and send buttons
- Implement message sending logic with proper event triggering
- Handle platform-specific edge cases and rate limiting
- Use the unified messaging interface for coordination

### Message Flow
1. Popup creates task queue and sends to background script
2. Background script processes queue sequentially
3. For each task, navigates to platform URL and injects appropriate content script
4. Content script executes message sending and reports completion
5. Background script continues to next task in queue

This modular architecture allows for easy extension to new AI platforms and functionality.
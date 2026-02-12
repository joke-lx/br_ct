# Bro Chat 开发者快速入门指南

## 欢迎加入 Bro Chat 开发

本文档旨在帮助新开发者快速了解 Bro Chat 项目，并能够独立进行功能扩展开发。

---

## 目录

1. [项目简介](#1-项目简介)
2. [开发环境准备](#2-开发环境准备)
3. [项目架构概览](#3-项目架构概览)
4. [核心概念理解](#4-核心概念理解)
5. [快速上手：添加新功能](#5-快速上手添加新功能)
6. [常见开发场景](#6-常见开发场景)
7. [调试技巧](#7-调试技巧)
8. [最佳实践](#8-最佳实践)
9. [常见问题](#9-常见问题)

---

## 1. 项目简介

### 1.1 Bro Chat 是什么？

Bro Chat 是一个 Chrome 浏览器扩展，核心功能是：

- **多平台消息调度**：一键向多个 AI 平台（ChatGPT、Claude、Gemini 等）发送消息
- **实用工具集成**：翻译、OCR、文件处理、快捷操作等
- **圆形导航菜单**：快速访问常用链接和浏览历史

### 1.2 技术栈

| 技术            | 版本/说明                  |
| --------------- | -------------------------- |
| Chrome 扩展标准 | Manifest V3                |
| JavaScript      | ES6+ Modules               |
| CSS             | 原生 CSS（无框架）         |
| 存储            | chrome.storage.local       |
| 通信            | chrome.runtime.sendMessage |

---

## 2. 开发环境准备

### 2.1 安装扩展

1. 克隆项目到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录（包含 `manifest.json` 的目录）

### 2.2 开发工具

- **Chrome DevTools**：调试 Popup、Content Scripts、Service Worker
- **VS Code**：推荐用于代码编辑
- **Chrome Extensions API 文档**：[https://developer.chrome.com/docs/extensions/](https://developer.chrome.com/docs/extensions/)

### 2.3 项目目录结构速览

```
bro_chat/
├── manifest.json              # 扩展配置文件
├── background.js              # Service Worker 入口
├── contentScripts/            # AI 平台适配脚本
├── backgroudtask/             # 后台服务模块
├── popup/                     # 弹窗界面
├── options/                   # 设置页面
├── runjs/                     # 页面注入脚本
├── funcs/                     # 可执行函数库
└── docs/                      # 项目文档
```

---

## 3. 项目架构概览

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Bro Chat 扩展架构                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        用户交互层 (UI Layer)                          │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐   │   │
│  │  │   Popup     │   │   Options   │   │   Context Menu          │   │   │
│  │  │   (弹窗)     │   │   (设置页)  │   │   (右键菜单)             │   │   │
│  │  └──────┬──────┘   └──────┬──────┘   └──────────┬──────────────┘   │   │
│  └─────────┼──────────────────┼─────────────────────┼──────────────────┘   │
│            │                  │                     │                      │
│            ▼                  ▼                     ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      服务层 (Service Layer)                          │   │
│  │                    background.js (Service Worker)                    │   │
│  │  ┌──────────────────┬──────────────────┬─────────────────────────┐  │   │
│  │  │ AI Platform      │ Function         │ Goto/Backup/           │  │   │
│  │  │ Processor        │ Executor         │ Translation            │  │   │
│  │  │ (消息队列管理)    │ (函数执行器)     │ (导航/备份/翻译)         │  │   │
│  │  └────────┬─────────┴────────┬─────────┴──────────┬──────────────┘  │   │
│  └───────────┼──────────────────┼─────────────────────┼────────────────┘   │
│              │                  │                     │                      │
│              ▼                  ▼                     ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     适配层 (Adapter Layer)                           │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────────────┐   │   │
│  │  │ChatGPT   │ Claude   │ Gemini   │ ...      │ Platform Template│   │   │
│  │  │ Script   │ Script   │ Script   │          │                  │   │   │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│              │                  │                     │                      │
│              ▼                  ▼                     ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  目标网站 (Target Websites)                           │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────────────┐   │   │
│  │  │chatgpt.  │claude.ai │gemini.   │ ...      │ newplatform.com  │   │   │
│  │  │com       │          │google.com│          │                  │   │   │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   数据层 (Data Layer)                                │   │
│  │                   chrome.storage.local                               │   │
│  │  ┌──────────────────┬──────────────────┬─────────────────────────┐  │   │
│  │  │ messageHistory   │ platformStates   │ customMenuConfig        │  │   │
│  │  │ (消息历史)        │ (平台状态)        │ (自定义菜单)            │  │   │
│  │  └──────────────────┴──────────────────┴─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心模块说明

| 模块                 | 文件位置                                   | 职责                         | 关键功能                          |
| -------------------- | ------------------------------------------ | ---------------------------- | --------------------------------- |
| **消息调度**   | `backgroudtask/ai_platform_processor.js` | 管理 AI 平台消息发送队列     | 并发/串行处理、Tab 管理、脚本注入 |
| **函数执行**   | `backgroudtask/func_executor.js`         | 执行 funcs/ 目录下的工具函数 | 快捷键监听、动态脚本注入          |
| **导航服务**   | `backgroudtask/gotoServer.js`            | 圆形菜单、URL 导航           | 历史记录、菜单配置、智能 Tab 复用 |
| **备份服务**   | `backgroudtask/backupService.js`         | 自动/手动备份数据            | 定时备份、导出 JSON、旧备份清理   |
| **翻译模块**   | `backgroudtask/translation/`             | 翻译和 OCR 功能              | 划词翻译、图片识别、结果展示      |
| **平台适配**   | `contentScripts/*.js`                    | 各 AI 平台的输入/发送逻辑    | 元素查找、消息填充、按钮点击      |
| **Popup 逻辑** | `popup/popup/popupUtils.js`              | 弹窗核心功能                 | 消息队列管理、平台选择、历史记录  |
| **工具函数库** | `funcs/`                                 | 可执行的工具函数             | DOM 操作、平台专属工具            |

### 3.3 消息流转示意

#### 3.3.1 完整消息发送流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   用户      │     │   Popup     │     │ Background  │     │  AI 平台    │
│             │     │     UI      │     │  Service    │     │   页面      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                  │                  │                  │
       │  1. 选择平台     │                  │                  │
       │  2. 输入消息     │                  │                  │
       │  3. 点击发送     │                  │                  │
       ├─────────────────►│                  │                  │
       │                  │                  │                  │
       │                  │ 4. 构建任务队列  │                  │
       │                  ├─────────────────►│                  │
       │                  │                  │                  │
       │                  │                  │ 5. 查找/创建 Tab │
       │                  │                  │ 6. 等待页面加载   │
       │                  │                  │                  │
       │                  │                  │ 7. 注入 Content  │─────────────►
       │                  │                  │    Script        │
       │                  │                  │                  │
       │                  │                  │ 8. 发送消息请求  │─────────────►
       │                  │                  │                  │
       │                  │                  │                  │ 9. 查找输入框
       │                  │                  │                  │10. 填充消息
       │                  │                  │                  │11. 点击发送按钮
       │                  │                  │                  │
       │                  │                  │ 12. 返回结果     │◄─────────────
       │                  │◄─────────────────┤                  │
       │◄─────────────────┤                  │                  │
       │                  │                  │                  │
       │ 13. 显示成功     │                  │                  │
       │
```

#### 3.3.2 并发处理模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         并发消息发送模式                                       │
│                                                                              │
│  任务队列: [ChatGPT, Claude, Gemini, Doubao, GLM]                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          批次 1 (maxConcurrent=3)                    │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                             │   │
│  │  │ ChatGPT │  │ Claude  │  │ Gemini  │  同时执行                    │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘                             │   │
│  └───────┼─────────────┼─────────────┼─────────────────────────────────┘   │
│          │             │             │                                    │
│          ▼             ▼             ▼                                    │
│      完成          完成           完成                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    批次延迟 (batchDelay=300ms)                       │   │
│  │                    ████████████████████████████                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          批次 2 (剩余任务)                           │   │
│  │  ┌─────────┐  ┌─────────┐                                            │   │
│  │  │ Doubao  │  │   GLM   │  同时执行                                  │   │
│  │  └────┬────┘  └────┬────┘                                            │   │
│  └───────┼─────────────┼────────────────────────────────────────────────┘   │
│          │             │                                                    │
│          ▼             ▼                                                    │
│      完成          完成                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 目录结构详解

```
bro_chat/
│
├── 📄 manifest.json                    # Manifest V3 配置文件
│   ├── name/version/description        # 扩展基本信息
│   ├── permissions                     # 权限声明
│   ├── host_permissions                # 主机权限
│   ├── background                      # 后台服务配置
│   ├── content_scripts                 # 内容脚本配置
│   └── commands                        # 快捷键命令
│
├── 📄 background.js                    # Service Worker 入口文件
│   ├── setupTabUpdateListener()        # 标签页更新监听
│   ├── setupAIProcessorListener()      # AI 消息处理器
│   ├── setupFuncCommandListener()      # 函数快捷键监听
│   ├── startServer()                   # 启动 HTTP 服务器
│   └── initContextMenu()               # 初始化右键菜单
│
├── 📁 contentScripts/                  # AI 平台适配脚本
│   ├── chatgpt.js                      # ChatGPT 平台适配
│   ├── claude.js                       # Claude 平台适配
│   ├── gemini.js                       # Gemini 平台适配
│   ├── glm.js                          # 智谱 GLM 适配
│   ├── doubao.js                       # 豆包平台适配
│   ├── tongyi.js                       # 通义千问适配
│   ├── googlestudio.js                 # Google Studio 适配
│   ├── yuanbao.js                      # 腾讯元宝适配
│   ├── grok.js                         # Grok 平台适配
│   ├── platform.template.js            # 新平台模板 ⭐
│   └── TEMPLATE_USAGE.md               # 平台适配使用指南
│
├── 📁 backgroudtask/                   # 后台服务模块
│   │
│   ├── ai_platform_processor.js        # AI 平台任务队列管理器
│   │   ├── processTaskQueueConcurrent()  # 并发处理队列
│   │   ├── processSingleTaskConcurrent() # 处理单个任务
│   │   ├── findOrCreatePlatformTab()     # 查找或创建标签页
│   │   ├── injectAndExecuteScript()      # 注入并执行脚本
│   │   └── platformUrls                  # 平台 URL 配置
│   │
│   ├── func_executor.js                # 函数执行器
│   │   ├── executeFunctionScript()       # 执行函数脚本
│   │   ├── setupFuncCommandListener()    # 快捷键监听
│   │   └── setupMessageListener()        # 消息监听
│   │
│   ├── gotoServer.js                   # 导航/菜单服务器
│   │   ├── openUrl()                     # 打开 URL
│   │   ├── getMenuData()                 # 获取菜单数据
│   │   ├── getHistory()                  # 获取浏览器历史
│   │   └── addToCustomMenu()             # 添加到自定义菜单
│   │
│   ├── backupService.js                # 备份服务
│   │   ├── initBackupService()           # 初始化备份服务
│   │   ├── performBackup()               # 执行自动备份
│   │   ├── performManualBackup()         # 执行手动备份
│   │   └── cleanupOldBackups()           # 清理旧备份
│   │
│   ├── translation/                    # 翻译/OCR 模块
│   │   ├── index.js                      # 主模块
│   │   ├── contextMenu.js                # 右键菜单
│   │   ├── messageHandler.js             # 消息处理
│   │   ├── ocr.js                        # OCR 功能
│   │   └── storage.js                    # 存储管理
│   │
│   ├── message_http_server.js          # 消息 HTTP 服务器
│   ├── video_plane_server.js           # 视频控制服务器
│   └── word_http_server.js             # Word 集成服务器
│
├── 📁 popup/                           # 弹窗界面
│   ├── popup.html                      # 弹窗 HTML
│   ├── popup/
│   │   ├── popup.js                     # 弹窗入口
│   │   ├── popupUtils.js                # 核心工具函数
│   │   ├── popup.css                    # 样式文件
│   │   ├── dragDropHandler.js           # 拖拽处理
│   │   ├── platformRenderer.js          # 平台渲染器
│   │   └── modules/                     # 功能模块
│   │       ├── platformVisibility.js    # 平台可见性
│   │       ├── storage.js               # 存储操作
│   │       └── uiHelpers.js             # UI 辅助函数
│   ├── promots/                        # 消息模板
│   ├── func_execute/                   # 函数执行界面
│   ├── translation/                    # 翻译界面
│   └── multpromots/                    # 多提示词界面
│
├── 📁 options/                         # 设置页面
│   ├── options.html                    # 主设置页
│   ├── options.js                      # 导航逻辑
│   ├── options.css                     # 蓝色主题样式
│   ├── platform/                       # 平台可见性设置
│   ├── storage/                        # 存储调试工具
│   ├── menu/                           # 菜单配置
│   ├── backup/                         # 备份设置
│   └── api/                            # API 设置
│
├── 📁 runjs/                           # 页面注入脚本
│   ├── goto/
│   │   └── goto.js                     # 圆形菜单 ⭐
│   ├── tripleSpace/
│   │   ├── tripleSpace.js              # 三击激活
│   │   └── tripleSpace.css
│   ├── word/
│   │   └── word.js                     # Word 集成
│   ├── bilibiliCleaner/
│   │   └── bilibiliCleaner.js          # B站视频页清理
│   └── translation/                    # 翻译覆盖层
│       ├── content.js
│       ├── content-ocr.js
│       ├── content.css
│       ├── content-ocr.css
│       └── lib/
│           ├── marked.min.js           # Markdown 解析
│           └── katex.min.js            # 数学公式渲染
│
├── 📁 funcs/                           # 可执行函数库 ⭐
│   ├── 元素dom/                        # DOM 操作工具
│   │   ├── input.js                    # 输入工具
│   │   ├── div_copy_input_dom.js       # 复制工具
│   │   ├── div_Img_wrapper.js          # 图片选择器
│   │   └── videoControllerPlane/       # 视频控制
│   ├── 平台专属/                       # 平台特定功能
│   │   ├── bili/                       # B站工具
│   │   ├── leecode/                    # LeetCode 工具
│   │   ├── 腾讯文档/                   # 腾讯文档工具
│   │   └── boss直聘/                   # Boss直聘工具
│   ├── goto/                           # 导航工具
│   ├── word/                           # Word 工具
│   └── x/                              # 实验性功能
│
├── 📁 icons/                           # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── 📁 docs/                            # 项目文档
│   ├── DEVELOPER_GUIDE.md              # 开发者指南（本文档）⭐
│   ├── optimize.md                     # 优化文档
│   └── build-tool-optimization.md      # 构建工具优化
│
├── 📁 sample/                          # 示例代码
│   └── docs/                           # 技术文档
│       ├── 01-OCR实现架构.md
│       ├── 02-动态快捷键原理.md
│       ├── 03-消息通信机制.md
│       └── ...
│
├── 📄 README.md                        # 项目说明文档
├── 📄 CLAUDE.md                        # Claude Code 项目指南
└── 📄 INTERVIEW.md                     # 项目面试问答
```

**图例说明**：

- ⭐: 重点关注目录/文件
- 📁: 目录
- 📄: 文件

---

## 4. 核心概念理解

### 4.1 Chrome 扩展的三个世界

| 世界                     | 说明                     | 访问权限                      | 生命周期               |
| ------------------------ | ------------------------ | ----------------------------- | ---------------------- |
| **Background**     | Service Worker，后台服务 | 可调用所有 Chrome API         | 按需启动/终止          |
| **Content Script** | 注入到网页中的脚本       | 只能访问 DOM、部分 Chrome API | 随页面加载/卸载        |
| **Popup**          | 用户界面                 | 可调用大部分 Chrome API       | 打开时存在，关闭后销毁 |

### 4.2 消息通信机制

#### Popup → Background

```javascript
// popup.js
chrome.runtime.sendMessage({
  action: 'processTaskQueue',
  queue: [...] // 任务队列
}, (response) => {
  console.log('响应:', response);
});
```

```javascript
// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processTaskQueue') {
    // 处理逻辑
    sendResponse({ status: 'ok' });
  }
  return true; // 异步响应时必须返回 true
});
```

#### Background → Content Script

```javascript
// background.js
chrome.tabs.sendMessage(tabId, {
  action: 'sendMessage',
  message: 'Hello AI'
}, (response) => {
  console.log('发送结果:', response);
});
```

```javascript
// contentScript.js (在 AI 平台页面中)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendMessage') {
    // 执行发送逻辑
    sendResponse({ status: 'ok' });
  }
  return true;
});
```

### 4.3 存储机制

```javascript
// 保存数据
chrome.storage.local.set({ key: value }, () => {
  console.log('已保存');
});

// 读取数据
chrome.storage.local.get(['key'], (result) => {
  console.log('数据:', result.key);
});

// 监听变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.key) {
    console.log('变化:', changes.key.newValue);
  }
});
```

### 4.4 存储数据结构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        chrome.storage.local 数据结构                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  messageHistory (消息历史 - 最近5条)                                  │   │
│  │  [                                                                  │   │
│  │    { message: "第一条消息", timestamp: 1234567890 },                 │   │
│  │    { message: "第二条消息", timestamp: 1234567891 },                 │   │
│  │    ...                                                               │   │
│  │  ]                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  platformStates (平台选择状态)                                        │   │
│  │  {                                                                  │   │
│  │    chatgpt: true,                                                   │   │
│  │    claude: true,                                                    │   │
│  │    gemini: false,                                                   │   │
│  │    ...                                                              │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  platformVisibility (平台可见性配置)                                  │   │
│  │  {                                                                  │   │
│  │    chatgpt: { visible: true, order: 1 },                            │   │
│  │    claude: { visible: true, order: 2 },                             │   │
│  │    gemini: { visible: false, order: 3 },                            │   │
│  │    ...                                                              │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  customMenuConfig (自定义圆形菜单)                                    │   │
│  │  {                                                                  │   │
│  │    groups: [                                                        │   │
│  │      {                                                              │   │
│  │        id: "favorites",                                             │   │
│  │        name: "📄 我的收藏",                                          │   │
│  │        items: [                                                     │   │
│  │          { name: "GitHub", url: "https://github.com" },             │   │
│  │          { name: "Stack Overflow", url: "https://stackoverflow.com" }│   │
│  │        ]                                                            │   │
│  │      }                                                              │   │
│  │    ]                                                                │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  backupSettings (备份服务配置)                                        │   │
│  │  {                                                                  │   │
│  │    enabled: true,                                                   │   │
│  │    intervalHours: 24,                                               │   │
│  │    maxBackups: 7,                                                   │   │
│  │    folderName: 'bro_chat_backups',                                  │   │
│  │    saveAs: false                                                    │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  promptQueue (待处理消息队列)                                         │   │
│  │  [                                                                  │   │
│  │    { platform: "chatgpt", message: "Hello" },                       │   │
│  │    { platform: "claude", message: "Hi there" }                      │   │
│  │  ]                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  currentTasks (当前任务处理状态)                                      │   │
│  │  {                                                                  │   │
│  │    chatgpt: "processing",                                           │   │
│  │    claude: "completed",                                             │   │
│  │    gemini: "pending"                                                │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 组件交互时序图

#### 添加新 AI 平台的完整交互流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   开发者    │     │  manifest   │     │  processor  │     │   platform  │
│             │     │    .json    │     │   .js       │     │    .js      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                  │                  │                  │
       │ 1. 添加平台配置  │                  │                  │
       ├─────────────────►│                  │                  │
       │    (URL配置)     │                  │                  │
       │                  │                  │                  │
       │ 2. 注册 Content │                  │                  │
       │    Script       │                  │                  │
       ├─────────────────►│                  │                  │
       │                  │                  │                  │
       │ 3. 创建 platform │                  │                  │
       │    .js 文件      │                  │                  │
       ├─────────────────────────────────────────────────────►│
       │                  │                  │                  │
       │                  │                  │                  │
       │ ═════════════════════════════════════════════════════  │
       │                  运行时流程                                  │
       │ ═════════════════════════════════════════════════════  │
       │                  │                  │                  │
       │ 4. 用户选择平台  │                  │                  │
       │    发送消息      │                  │                  │
       ├──────────────────────────────────►│                  │
       │                  │                  │                  │
       │                  │                  │ 5. 查找/创建 Tab │
       │                  │                  ├─────────────────►│
       │                  │                  │                  │
       │                  │                  │ 6. 注入脚本      │
       │                  │                  ├─────────────────►│
       │                  │                  │                  │
       │                  │                  │ 7. 发送消息请求  │
       │                  │                  ├─────────────────►│
       │                  │                  │                  │
       │                  │                  │ 8. 执行发送      │
       │                  │                  │                  │
       │                  │                  │ 9. 返回结果      │
       │                  │                  │◄─────────────────┤
       │                  │                  │                  │
       │ 10. 显示结果    │                  │                  │
       │◄─────────────────┤                  │                  │
       │                  │                  │                  │
```

#### 快捷键触发函数执行的流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    用户     │     │  manifest   │     │   func_     │     │   函数脚本   │
│   (按键)    │     │    .json    │     │ executor.js │     │    .js      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                  │                  │                  │
       │ 1. 按下 Alt+C    │                  │                  │
       ├─────────────────►│                  │                  │
       │                  │                  │                  │
       │                  │ 2. 触发命令     │                  │
       │                  ├─────────────────►│                  │
       │                  │                  │                  │
       │                  │                  │ 3. 查找脚本文件  │
       │                  │                  ├─────────────────►│
       │                  │                  │                  │
       │                  │                  │ 4. 注入到当前页  │
       │                  │                  ├─────────────────►│
       │                  │                  │                  │
       │                  │                  │ 5. 调用 main()   │
       │                  │                  ├─────────────────►│
       │                  │                  │                  │
       │                  │                  │ 6. 执行功能      │
       │                  │                  │                  │
       │                  │                  │ 7. 返回结果      │
       │                  │                  │◄─────────────────┤
       │                  │                  │                  │
       │ 8. 显示通知     │                  │                  │
       │◄─────────────────┤                  │                  │
       │                  │                  │                  │
```

---

## 5. 快速上手：添加新功能

### 5.1 场景一：添加新的 AI 平台支持

**目标**：让 Bro Chat 能向一个新的 AI 平台发送消息

#### 步骤 1：创建 Content Script

在 `contentScripts/` 目录下创建新文件 `newplatform.js`：

```javascript
// contentScripts/newplatform.js

// 1. 防止重复注入
if (window.newplatformInjected) return;
window.newplatformInjected = true;

// 2. 平台配置
const PLATFORM_NAME = 'newplatform';

// 3. 选择器（需要根据实际页面调整）
const INPUT_SELECTORS = [
  { type: 'css', value: 'textarea[placeholder="输入消息..."]' },
  { type: 'xpath', value: '//textarea[@placeholder="输入消息..."]' },
];

const BUTTON_SELECTORS = [
  { type: 'css', value: 'button.send-btn' },
  { type: 'xpath', value: '//button[contains(text(), "发送")]' },
];

// 4. 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendMessage') {
    sendChatMessage(request.message)
      .then(success => sendResponse({ status: success ? 'ok' : 'failed' }))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    return true;
  }
});

// 5. 发送消息函数
async function sendChatMessage(message) {
  // 查找输入框
  const inputElement = await findElement(INPUT_SELECTORS);
  if (!inputElement) {
    console.error('[newplatform] 未找到输入框');
    return false;
  }

  // 填充消息
  inputElement.value = message;
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));

  // 查找并点击发送按钮
  const buttonElement = await findElement(BUTTON_SELECTORS);
  if (!buttonElement) {
    console.error('[newplatform] 未找到发送按钮');
    return false;
  }

  buttonElement.click();
  return true;
}

// 辅助函数：查找元素
async function findElement(selectors, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    for (const selector of selectors) {
      let element = null;

      if (selector.type === 'css') {
        element = document.querySelector(selector.value);
      } else if (selector.type === 'xpath') {
        const result = document.evaluate(
          selector.value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        element = result.singleNodeValue;
      }

      if (element) return element;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return null;
}
```

#### 步骤 2：在 manifest.json 中注册

```json
{
  "content_scripts": [
    {
      "matches": ["https://newplatform.com/*"],
      "js": ["contentScripts/newplatform.js"],
      "run_at": "document_idle"
    }
  ]
}
```

#### 步骤 3：更新平台 URL 配置

在 `backgroudtask/ai_platform_processor.js` 中添加：

```javascript
export const platformUrls = {
  // ... 现有平台
  newplatform: 'https://newplatform.com/chat',
};
```

#### 步骤 4：在 Popup UI 中添加选项

在 `popup/popup.html` 中添加平台选项：

```html
<label class="platform-icon-option" data-platform-id="newplatform">
  <input type="checkbox" data-platform="newplatform">
  <div class="icon-wrapper">NP</div>
  <div class="platform-label">新平台</div>
</label>
```

### 5.2 场景二：添加新的工具函数

**目标**：创建一个可通过快捷键或 UI 触发的工具函数

#### 步骤 1：创建函数脚本

在 `funcs/` 目录下创建新文件 `tools/myTool.js`：

```javascript
// funcs/tools/myTool.js

/**
 * 我的工具函数
 */
export async function main() {
  try {
    console.log('[myTool] 开始执行');

    // 你的逻辑代码
    const result = doSomething();

    console.log('[myTool] 执行成功:', result);
    return { success: true, data: result };

  } catch (error) {
    console.error('[myTool] 执行失败:', error);
    return { success: false, error: error.message };
  }
}

function doSomething() {
  // 实际功能实现
  return '任务完成！';
}
```

#### 步骤 2：注册快捷键（可选）

在 `manifest.json` 中添加：

```json
{
  "commands": {
    "execute_my_tool": {
      "suggested_key": { "default": "Alt+T" },
      "description": "执行我的工具"
    }
  }
}
```

#### 步骤 3：在后台注册监听器

在 `backgroudtask/func_executor.js` 中添加：

```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === "execute_my_tool") {
    executeFunctionScript("tools/myTool.js", (response) => {
      console.log("执行结果:", response);
    });
  }
});
```

### 5.3 场景三：添加新的设置页面

**目标**：创建一个新的设置子页面

#### 步骤 1：创建设置页面

在 `options/mySettings/` 目录下创建文件：

```html
<!-- options/mySettings/index.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="../options.css">
</head>
<body>
  <div class="settings-container">
    <h2>我的设置</h2>

    <div class="setting-item">
      <label>
        <input type="checkbox" id="enable-feature">
        启用新功能
      </label>
    </div>

    <button id="save-btn">保存设置</button>
  </div>

  <script src="settings.js"></script>
</body>
</html>
```

```javascript
// options/mySettings/settings.js

document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  chrome.storage.local.get(['mySettings'], (result) => {
    const settings = result.mySettings || { enableFeature: false };
    document.getElementById('enable-feature').checked = settings.enableFeature;
  });

  // 保存设置
  document.getElementById('save-btn').addEventListener('click', () => {
    const settings = {
      enableFeature: document.getElementById('enable-feature').checked
    };

    chrome.storage.local.set({ mySettings: settings }, () => {
      alert('设置已保存');
    });
  });
});
```

#### 步骤 2：在主设置页添加导航项

在 `options/options.html` 中添加：

```html
<div class="nav-item" data-page="mySettings/index.html">我的设置</div>
```

---

## 6. 常见开发场景

### 6.1 如何获取当前标签页并发送消息？

```javascript
// 1. 获取当前活动标签页
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];

  // 2. 发送消息到该标签页
  chrome.tabs.sendMessage(currentTab.id, {
    action: 'doSomething',
    data: { /* ... */ }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('发送失败:', chrome.runtime.lastError.message);
    } else {
      console.log('响应:', response);
    }
  });
});
```

### 6.2 如何创建新标签页并注入脚本？

```javascript
// 1. 创建新标签页
chrome.tabs.create({ url: 'https://example.com' }, (tab) => {
  // 2. 等待页面加载完成
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);

      // 3. 注入脚本
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contentScripts/myScript.js']
      });
    }
  });
});
```

### 6.3 如何监听存储变化并更新 UI？

```javascript
// popup.js

// 1. 初始化加载
chrome.storage.local.get(['myKey'], (result) => {
  updateUI(result.myKey);
});

// 2. 监听变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.myKey) {
    updateUI(changes.myKey.newValue);
  }
});

function updateUI(value) {
  // 更新 UI 逻辑
  document.getElementById('my-element').textContent = value;
}
```

### 6.4 如何处理跨域请求？

```javascript
// 在 background.js 中（Content Script 受同源策略限制）

fetch('https://api.example.com/data', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => {
    console.log('API 响应:', data);
  })
  .catch(error => {
    console.error('请求失败:', error);
  });
```

---

## 7. 调试技巧

### 7.1 调试 Service Worker

1. 访问 `chrome://extensions/`
2. 找到 Bro Chat 扩展
3. 点击 "Service worker" 链接
4. 在打开的 DevTools 中查看日志

**提示**：Service Worker 可能会被 Chrome 终止，需要保持 DevTools 打开来保持活跃。

### 7.2 调试 Popup

1. 右键点击扩展图标
2. 选择"检查"或"检查弹出窗口"
3. 在打开的 DevTools 中调试

### 7.3 调试 Content Script

1. 打开目标网页（如 ChatGPT）
2. 按 F12 打开 DevTools
3. 在 Console 中查看日志

**提示**：使用 `console.log('[ModuleName]', ...)` 格式方便过滤日志。

### 7.4 常用调试代码

```javascript
// 检查 Content Script 是否注入
console.log('[MyScript] Script injected');

// 暴露调试函数到全局
window.__debug = {
  sendMessage: () => { /* ... */ },
  getConfig: () => config
};

// 在控制台中调用
window.__debug.sendMessage();
```

---

## 8. 最佳实践

### 8.1 代码风格

- **使用 ES6+ 语法**：箭头函数、模板字符串、解构赋值等
- **模块化**：使用 `export`/`import` 组织代码
- **错误处理**：使用 `try-catch` 包裹可能出错的代码
- **日志规范**：使用 `[ModuleName]` 前缀便于过滤

```javascript
// ✅ 好的写法
async function sendMessage(message) {
  try {
    console.log('[MessageSender] Sending:', message);
    const result = await api.send(message);
    console.log('[MessageSender] Success:', result);
    return result;
  } catch (error) {
    console.error('[MessageSender] Failed:', error);
    throw error;
  }
}

// ❌ 不好的写法
function sendMessage(m) {
  api.send(m); // 没有错误处理，没有日志
}
```

### 8.2 命名约定

| 类型      | 约定       | 示例                                          |
| --------- | ---------- | --------------------------------------------- |
| 文件名    | 小驼峰     | `popupUtils.js`, `aiPlatformProcessor.js` |
| 变量/函数 | 小驼峰     | `sendMessage`, `getElementById`           |
| 常量      | 大写下划线 | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`      |
| 类名      | 大驼峰     | `MessageQueue`, `StorageManager`          |
| 私有成员  | 下划线前缀 | `_internalMethod`, `_privateVar`          |

### 8.3 消息格式规范

```javascript
// ✅ 好的消息格式
{
  action: 'sendMessage',        // 动作类型（必需）
  platform: 'chatgpt',          // 目标平台
  message: 'Hello',             // 数据
  options: {                    // 可选参数
    timeout: 5000,
    retry: true
  }
}

// ❌ 不好的消息格式
{
  text: 'Hello',
  doIt: true,
  from: 'popup'
}
```

### 8.4 存储键命名规范

```javascript
// ✅ 好的键名
'messageHistory'       // 消息历史
'platformStates'       // 平台状态
'customMenuConfig'     // 自定义菜单配置

// ❌ 不好的键名
'data'                // 太泛
'temp'                // 不明确
'config123'           // 带数字后缀
```

### 8.5 性能优化

```javascript
// ❌ 不好的做法：频繁发送消息
inputElement.addEventListener('input', (e) => {
  chrome.storage.local.set({ text: e.target.value });
});

// ✅ 好的做法：防抖
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const debouncedSave = debounce((text) => {
  chrome.storage.local.set({ text });
}, 500);

inputElement.addEventListener('input', (e) => {
  debouncedSave(e.target.value);
});
```

---

## 9. 常见问题

### Q1: Content Script 注入失败怎么办？

**可能原因**：

1. `manifest.json` 中的 `matches` 规则不正确
2. Content Script 文件路径错误
3. 页面使用了 CSP（内容安全策略）

**解决方案**：

```javascript
// 检查文件路径
chrome.runtime.getURL('contentScripts/myScript.js'); // 应该返回完整路径

// 动态注入（替代方案）
chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['contentScripts/myScript.js']
});
```

### Q2: 消息发送后没有响应？

**检查清单**：

1. 确保监听器返回 `true`（异步响应时）
2. 检查 `sendResponse` 是否被调用
3. 检查 `chrome.runtime.lastError`

```javascript
// 确保这样写
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'asyncTask') {
    doAsyncTask().then(sendResponse);
    return true;  // 必须返回 true
  }
});
```

### Q3: Service Worker 被终止导致状态丢失？

**解决方案**：使用 `chrome.storage` 持久化状态

```javascript
// 保存状态
chrome.storage.local.set({ taskState: state });

// 恢复状态
chrome.storage.local.get(['taskState'], (result) => {
  const state = result.taskState || defaultState;
});
```

### Q4: 如何在开发时热重载？

**方法**：

1. 在 `chrome://extensions/` 页面点击刷新按钮
2. 使用 `npm install -g web-ext` 然后 `web-ext watch`

```bash
# 安装 web-ext
npm install -g web-ext

# 监听文件变化自动重载
web-ext watch --source-dir=./
```

### Q5: 元素选择器如何获取？

**方法**：

1. 在浏览器 DevTools 中使用 Elements 面板
2. 右键点击元素 → Copy → Copy selector/XPath

```javascript
// Chrome DevTools 会生成类似这样的选择器
document.querySelector('#app > div > textarea')  // CSS 选择器
document.evaluate('//*[@id="app"]/div/textarea', ...)  // XPath
```

---

## 下一步

恭喜你阅读完快速入门指南！现在你可以：

1. **阅读详细文档**：

   - [TEMPLATE_USAGE.md](../contentScripts/TEMPLATE_USAGE.md) - AI 平台适配详细说明
   - [README.md](../README.md) - 完整项目文档
2. **查看示例代码**：

   - [contentScripts/](../contentScripts/) - 现有平台实现
   - [funcs/](../funcs/) - 工具函数示例
3. **开始实践**：

   - 尝试添加一个简单的新功能
   - 修复一个已知问题
   - 优化现有代码
4. **获取帮助**：

   - 在项目中搜索相关代码实现
   - 查看 Chrome Extensions API 官方文档
   - 提交 Issue 或 PR

---

**祝你开发顺利！** 🚀

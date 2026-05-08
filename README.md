# Browser_Chat (AI Assistant) - 多端AI调度工具

<div align="center">

![Browser_Chat Logo](https://img.shields.io/badge/Browser_Chat-AI%20Assistant-blue?style=for-the-badge)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?style=for-the-badge)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange?style=for-the-badge)
![ES6+](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge)

**一站式管理多个AI平台的智能浏览器扩展**

[功能介绍](#核心功能) • [技术架构](#技术架构) • [快速开始](#快速开始) • [开发指南](#开发指南)

[English](./README.en.md)

</div>

## 项目简介

Browser_Chat 是一个功能强大的浏览器扩展，旨在解决用户需要在不同AI平台间频繁切换的问题。通过统一的界面，用户可以同时向多个AI平台发送消息，极大提升了工作效率。

### 解决的问题

- **多平台切换痛点**：无需在不同标签页间来回切换，一次输入多平台发送
- **重复输入成本**：统一的输入界面，支持消息模板和快捷操作
- **工具分散问题**：集成翻译、OCR、Git管理、笔记等多种实用工具
- **工作流中断**：保持专注的工作状态，减少操作步骤

## 核心功能

### AI 平台消息调度

支持 **15 个主流AI平台**：

| 平台      | 名称             | 官网                |
| --------- | ---------------- | ------------------- |
| 元宝      | 腾讯元宝         | yuanbao.tencent.com |
| Gemini    | Google Gemini    | gemini.google.com   |
| ChatGPT   | OpenAI           | chatgpt.com         |
| Claude    | Anthropic        | claude.ai           |
| 豆包      | 字节跳动         | doubao.com          |
| 智谱      | 智谱AI           | chatglm.cn          |
| 通义      | 阿里通义         | qianwen.com         |
| GAS       | Google AI Studio | aistudio.google.com |
| Grok      | xAI              | grok.com            |
| NotionAI  | Notion           | notion.so           |
| Zai       | Z.ai             | chat.z.ai           |
| DeepSeek  | DeepSeek         | chat.deepseek.com   |
| Kimi      | 月之暗面         | kimi.com            |
| CoderQwen | 阿里码模型       | coder.qwen.ai       |
| Coze      | 扣子             | coze.cn             |

**特性**：

- 智能任务队列，支持串行和并发处理模式
- 自动标签页管理（查找/创建/激活）
- 动态脚本注入，无需手动配置
- 平台可见性可单独配置

### 设置页面

功能丰富的设置页面，包含：

| 模块                   | 功能                                   |
| ---------------------- | -------------------------------------- |
| **平台显示**     | 配置各AI平台的显示/隐藏                |
| **API 配置**     | 管理各平台的 API 设置                  |
| **存储管理**     | 存储调试和数据管理工具                 |
| **菜单配置**     | 自定义圆形导航菜单                     |
| **随手笔记**     | 快速记录临时笔记                       |
| **OCR 批量识别** | 图片文字批量提取                       |
| **倒计时面板**   | 计时器功能                             |
| **提示词编辑**   | 管理消息模板                           |
| **本地命令管理** | Git监控、Skill管理、命令模板、进程管理 |

### 本地命令管理

强大的本地开发工具集成：

#### Git 监控

- 批量查看多个仓库的 Git 状态
- 快速 Pull/Push 操作
- 一键自动提交推送
- 有变更的项目优先显示
- 详情可折叠/展开

#### Skill 管理

- 中心仓库 Skill 同步
- 项目 Skill 导入导出
- Skill 冲突检测
- 从 Git 项目快速导入

#### 命令模板

- 保存常用命令
- 一键执行
- 支持工作目录、命令、参数配置

#### 进程管理

- 查看运行中的进程
- 停止/移除进程

### 实用工具

| 功能         | 描述                              | 快捷键     |
| ------------ | --------------------------------- | ---------- |
| 拖拽文件处理 | 支持文件/文件夹拖拽，智能提取内容 | -          |
| div copy     | 复制页面元素内容                  | Alt+C      |
| 图片选择器   | 快速选择和处理图片                | Alt+D      |
| 剪贴板保存   | 将剪贴板内容保存为文件            | Alt+F      |
| BindDom      | DOM元素绑定点击事件               | Alt+B      |
| 三击空格     | 快速调用AI助手                    | 三击空格键 |

### 圆形导航菜单

- **悬浮激活**：鼠标悬浮即可展开菜单
- **拖动定位**：可拖动到屏幕任意位置，自动记忆
- **右键添加**：右键添加链接到菜单
- **历史记录集成**：自动显示最近24小时的浏览历史
- **智能导航**：相同域名自动复用标签页

### 翻译与OCR

- **划词翻译**：选中文本即时显示翻译结果
- **OCR识别**：图片文字提取功能
- **Markdown渲染**：支持Markdown格式和数学公式（KaTeX）
- **侧边栏集成**：支持通过侧边栏使用

### Native Host

基于 Go 的原生消息主机，提供：

- 本地命令执行
- 文件系统操作
- Git 操作增强
- Skill 管理增强

## 技术架构

### 核心技术栈

- **前端框架**: 原生JavaScript (ES6+ Modules)
- **扩展标准**: Chrome Extensions Manifest V3
- **存储方案**: chrome.storage.local + localStorage
- **通信机制**: chrome.runtime.sendMessage / chrome.tabs.sendMessage
- **脚本注入**: chrome.scripting.executeScript
- **原生集成**: Go Native Messaging Host
- **UI框架**: 原生CSS + 响应式设计
- **依赖库**: marked.min.js (Markdown), katex.min.js (数学公式)

### 架构特点

#### 分层架构设计

| 层级             | 职责         | 主要模块                   |
| ---------------- | ------------ | -------------------------- |
| **UI层**   | 用户交互界面 | popup/, options/, sidebar/ |
| **服务层** | 业务逻辑处理 | backgroudtask/             |
| **适配层** | 平台适配脚本 | contentScripts/            |
| **运行层** | 页面注入脚本 | runjs/                     |
| **功能层** | 可执行函数库 | funcs/                     |
| **原生层** | 本地系统集成 | native_host/               |

#### 统一配置架构

所有平台配置集中在 `config/platformConfig.js`，添加新平台只需修改此文件：

- ✅ Popup 平台选项 (动态从配置生成)
- ✅ 设置页面平台列表
- ✅ AI 消息处理器
- ✅ 无需手动更新多处代码

## 项目结构

```
Browser_Chat/
├── manifest.json                 # Manifest V3 配置
├── background.js                 # Service Worker 入口
├── config/                      # 统一配置
│   └── platformConfig.js        # 平台配置
│
├── popup/                       # 弹窗界面
│   ├── main/                    # 主popup模块
│   │   ├── main.html           # 入口
│   │   ├── main.js             # 核心逻辑
│   │   ├── mainUtils.js        # 工具函数
│   │   ├── main.css            # 样式
│   │   ├── dragDropHandler.js  # 拖拽处理
│   │   └── platformRenderer.js # 平台渲染
│   ├── binddom/                # DOM绑定UI
│   ├── func_execute/           # 功能执行UI
│   └── translation/            # 翻译界面
│
├── sidebar/                     # 侧边栏
│   └── main/                   # 侧边栏模块
│
├── options/                     # 设置页面
│   ├── options.html           # 主设置页（带侧边栏）
│   ├── options.js             # 导航逻辑
│   ├── options.css            # 主题样式
│   ├── platform/              # 平台可见性
│   ├── storage/               # 存储管理
│   ├── menu/                  # 菜单配置
│   ├── notes/                 # 随手笔记
│   ├── ocr/                   # OCR批量识别
│   ├── countdown/              # 倒计时面板
│   ├── prompts_editor/         # 提示词编辑
│   ├── local_cmd/              # 本地命令管理
│   │   ├── core.js            # 核心函数
│   │   ├── command.js         # 命令模板
│   │   ├── git.js             # Git监控
│   │   └── skill.js           # Skill管理
│   └── api/                   # API配置
│
├── contentScripts/              # AI平台适配脚本
│   ├── yuanbao.js             # 元宝
│   ├── gemini.js              # Gemini
│   ├── chatgpt.js             # ChatGPT
│   ├── claude.js              # Claude
│   ├── doubao.js              # 豆包
│   ├── glm.js                 # 智谱
│   ├── tongyi.js              # 通义
│   ├── googlestudio.js        # GAS
│   ├── grok.js                # Grok
│   ├── notionai.js            # NotionAI
│   ├── zai.js                 # Zai
│   ├── deepseek.js            # DeepSeek
│   ├── kimi.js                # Kimi
│   ├── coderqwen.js           # CoderQwen
│   └── coze.js                # Coze
│
├── backgroudtask/               # 后台服务模块
│   ├── ai_platform_processor.js # AI平台任务队列
│   ├── func_executor.js       # 函数执行器
│   ├── gotoServer.js          # 导航/菜单服务
│   ├── backupService.js       # 备份服务
│   ├── word_http_server.js    # Word集成服务
│   ├── message_http_server.js # 消息服务
│   ├── video_plane_server.js  # 视频控制服务
│   ├── binddom/               # DOM绑定服务
│   └── translation/           # 翻译/OCR模块
│
├── native_host/                 # Go原生消息主机
│   ├── main.go               # 入口
│   ├── internal/             # 内部实现
│   └── brochat_native_host.exe # 编译后的可执行文件
│
├── runjs/                      # 页面注入脚本
│   ├── goto/                 # 圆形菜单
│   ├── tripleSpace/          # 三击激活
│   ├── word/                 # Word集成
│   ├── bilibiliCleaner/      # B站视频页清理
│   └── translation/          # 翻译覆盖层
│
├── funcs/                      # 可执行函数库
│   ├── 元素dom/              # DOM操作工具
│   ├── 平台专属/             # 平台特定功能
│   ├── goto/                 # 导航工具
│   ├── word/                 # Word工具
│   └── x/                    # 实验性功能
│
└── icons/                      # 扩展图标
```

## 快速开始

### 安装步骤

1. **克隆项目**

   ```bash
   git clone https://github.com/ZHLX2005/Browser_Chat.git
   cd Browser_Chat
   ```
2. **安装 Native Host（可选）**

   ```bash
   # 如果需要本地命令功能，运行编译好的可执行文件
   ./native_host/brochat_native_host.exe
   ```
3. **加载扩展**

   - 打开 Chrome/Edge 浏览器
   - 访问 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目根目录

### 基本使用

#### 发送消息到AI平台

1. 点击扩展图标打开 popup
2. 选择目标AI平台（可多选）
3. 输入消息内容
4. 点击发送

#### 使用侧边栏

1. 右键扩展图标 → 选择"打开侧边栏"
2. 侧边栏提供与 popup 相同的功能

#### 使用圆形菜单

1. **悬浮展开**：鼠标悬浮在圆形图标上
2. **拖动定位**：按住拖动到合适位置
3. **右键添加**：在任意链接/页面右键选择"添加到圆形菜单"

#### 本地命令管理

1. 打开设置页面 → 本地命令管理
2. 添加 Git 监控目录
3. 使用批量操作或单独管理

## 开发指南

### 添加新的AI平台

**统一配置架构**：只需修改 `config/platformConfig.js`：

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

**自动生效的模块**：

- ✅ Popup 平台选项 (动态从配置生成)
- ✅ 设置页面平台列表
- ✅ HTTP API 平台验证
- ✅ AI 消息处理器

### 添加新的功能函数

1. **创建文件** `funcs/{category}/{functionName}.js`
2. **导出 main 函数**
3. **注册快捷键**（可选，在 manifest.json）

## 更新日志

### v1.5.x

- 新增 7 个AI平台：Zai, DeepSeek, Kimi, CoderQwen, Coze 等
- 新增侧边栏支持
- 新增本地命令管理功能（Git监控、Skill管理）
- 新增随手笔记功能
- 新增 OCR 批量识别
- 新增倒计时面板
- 优化设置页面 UI
- 优化圆形菜单体验
- 支持固定设置页面到标签栏

### v1.4.x

- 新增翻译和OCR功能
- 添加圆形菜单导航
- 改进UI响应式设计

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 联系方式

- 项目地址: [GitHub](https://github.com/ZHLX2005/Browser_Chat)
- 问题反馈: [Issues](https://github.com/ZHLX2005/Browser_Chat/issues)

---

<div align="center">

**如果这个项目对您有帮助，请给一个 ⭐️ 支持！**

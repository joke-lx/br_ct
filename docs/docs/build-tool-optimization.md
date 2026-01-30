# Chrome 扩展构建工具优化指南

## 项目现状分析

当前 Bro Chat AI Assistant 项目：
- **无构建流程**：直接加载源文件到浏览器
- **ES6 模块**：使用 `type: "module"` 的 Service Worker
- **多文件架构**：分散在 popup/、options/、contentScripts/、backgroudtask/、runjs/ 等目录

## 为什么需要构建工具

### 当前痛点
1. **无代码压缩**：所有源文件以原始大小加载
2. **无类型检查**：缺少 TypeScript 类型安全保障
3. **无代码检查**：缺少 ESLint/Prettier 代码规范
4. **无热更新**：修改后需手动刷新扩展
5. **无资源优化**：图片、CSS 未优化
6. **模块化不彻底**：部分文件可能存在全局变量污染

## 推荐构建方案

### 方案一：Vite + CRXJS（推荐）

**优势**：
- 专为 Chrome 扩展优化的 Vite 插件
- 开发时支持 HMR（热模块替换）
- 自动处理 manifest.json
- 快速的冷启动和热更新
- 对 Manifest V3 有良好支持

**安装步骤**：

```bash
# 1. 初始化项目
npm init -y

# 2. 安装依赖
npm install -D vite @crxjs/vite-plugin
npm install -D typescript @types/chrome

# 3. 可选：代码规范工具
npm install -D eslint prettier eslint-config-prettier
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**配置文件** `vite.config.ts`：

```typescript
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        // 明确指定入口点
        background: 'background.js',
        popup: 'popup/popup.html',
        options: 'options/options.html'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})
```

**修改后的 manifest.json**：

```json
{
  "manifest_version": 3,
  "name": "AI Assistant",
  "version": "1.5.0",
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/popup.html"
  },
  "options_ui": {
    "page": "src/options/options.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/contentScripts/index.ts"]
    }
  ]
}
```

**目录结构重组**：

```
src/
├── background/           # Service Worker
│   └── index.ts
├── popup/               # 弹窗页面
│   ├── popup.html
│   ├── popup.ts
│   └── style.css
├── options/             # 选项页面
│   ├── options.html
│   ├── options.ts
│   └── sub-pages/
├── contentScripts/      # 内容脚本
│   ├── index.ts
│   ├── platforms/
│   └── utils/
├── shared/              # 共享代码
│   ├── types/
│   ├── utils/
│   └── constants/
└── assets/              # 静态资源
    ├── icons/
    └── images/
```

**package.json 脚本**：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  }
}
```

---

### 方案二：Webpack

**适用场景**：需要更复杂的打包配置

**安装**：

```bash
npm install -D webpack webpack-cli webpack-merge
npm install -D copy-webpack-plugin html-webpack-plugin
npm install -D ts-loader css-loader style-loader
```

**配置文件** `webpack.config.js`：

```javascript
const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const { merge } = require('webpack-merge')

const commonConfig = {
  mode: process.env.NODE_ENV || 'development',
  devtool: 'cheap-module-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  }
}

const backgroundConfig = merge(commonConfig, {
  name: 'background',
  entry: {
    background: './src/background/index.ts'
  }
})

const popupConfig = merge(commonConfig, {
  name: 'popup',
  entry: {
    popup: './src/popup/popup.ts'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'public', to: '.' }
      ]
    })
  ]
})

module.exports = [backgroundConfig, popupConfig]
```

---

### 方案三：Rollup

**适用场景**：需要更小体积的打包输出

**安装**：

```bash
npm install -D rollup @rollup/plugin-typescript
npm install -D @rollup/plugin-node-resolve @rollup/plugin-commonjs
npm install -D rollup-plugin-copy
```

**配置文件** `rollup.config.js`：

```javascript
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy'

export default [
  {
    input: 'src/background/index.ts',
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript(),
      copy({
        targets: [
          { src: 'public/manifest.json', dest: 'dist' },
          { src: 'src/icons/*', dest: 'dist/icons' }
        ]
      })
    ]
  }
]
```

---

## 优化建议

### 1. TypeScript 迁移

**收益**：
- 编译时类型检查
- 更好的 IDE 支持
- 重构更安全
- 自文档化代码

**配置** `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM"],
    "types": ["chrome"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2. 代码规范

**ESLint 配置** `.eslintrc.js`：

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    es2021: true,
    webextensions: true
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
}
```

**Prettier 配置** `.prettierrc`：

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 3. 资源优化

**图片优化**：
```bash
npm install -D imagemin imagemin-webp imagemin-mozjpeg imagemin-pngquant
```

**脚本** `scripts/optimize-images.js`：
```javascript
const imagemin = require('imagemin')
const imageminWebp = require('imagemin-webp')

async function optimizeImages() {
  await imagemin(['src/icons/*.{png,jpg}'], {
    destination: 'dist/icons',
    plugins: [imageminWebp({ quality: 80 })]
  })
}

optimizeImages()
```

### 4. 代码分割

**当前可优化的模块**：

```typescript
// 优化前：contentScripts/platforms 所有平台都加载
// 优化后：按需加载

const loadPlatformScript = async (platform: string) => {
  const module = await import(`./platforms/${platform}.js`)
  return module.default
}

// 在需要时动态加载
chrome.runtime.onMessage.addListener((message) => {
  if (message.platform) {
    loadPlatformScript(message.platform).then(handler => {
      handler.process(message)
    })
  }
})
```

### 5. 缓存优化

```typescript
// Service Worker 缓存策略
const CACHE_VERSION = 'v1.5.0'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(`ai-assistant-${CACHE_VERSION}`).then((cache) => {
      return cache.addAll([
        '/popup/popup.html',
        '/popup/popup.js',
        '/icons/icon48.png'
      ])
    })
  )
})
```

### 6. Tree Shaking

```typescript
// 确保使用 ES6 模块语法
// 优化前
import * as utils from './utils'
utils.someFunction()

// 优化后：只导入需要的函数
import { someFunction } from './utils'
someFunction()
```

## 迁移步骤

### 阶段一：基础设施搭建（1-2天）

1. 初始化 npm 项目
2. 选择构建工具（推荐 Vite + CRXJS）
3. 配置 TypeScript
4. 配置 ESLint + Prettier
5. 设置开发/生产环境脚本

### 阶段二：代码迁移（3-5天）

1. 重构目录结构
2. 将 `.js` 文件重写为 `.ts`
3. 添加类型定义
4. 修复类型错误
5. 运行 lint 检查

### 阶段三：优化与测试（2-3天）

1. 配置代码分割
2. 优化资源加载
3. 性能测试对比
4. 功能回归测试
5. 文档更新

## 性能对比预估

| 指标 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 扩展包大小 | ~500KB | ~150KB | 70%↓ |
| 首次加载时间 | ~200ms | ~80ms | 60%↓ |
| 热更新速度 | 需手动刷新 | <1秒 | 200× |
| 构建时间 | N/A | ~3秒 | - |
| 类型安全 | ❌ | ✅ | - |

## 常见问题

### Q1: 如何处理 Chrome API 类型？

```bash
npm install -D @types/chrome
```

### Q2: Content Security Policy 错误？

在 `vite.config.ts` 中配置：
```typescript
export default defineConfig({
  plugins: [
    crx({
      manifest: './manifest.json',
      contentScripts: {
        injectCss: false
      }
    })
  ]
})
```

### Q3: Service Worker 不支持某些模块？

避免在 Service Worker 中使用：
- DOM API
- Node.js API
- 需要运行时计算的动态 import

## 参考资料

- [CRXJS 文档](https://crxjs.dev/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Vite 官方文档](https://vitejs.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)

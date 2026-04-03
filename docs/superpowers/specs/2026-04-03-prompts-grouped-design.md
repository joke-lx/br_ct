# 提示词分组管理重构设计

## 背景

当前提示词模板全部写在一个大文件 `prompts.js` 中，约 40 个模板混杂在一起，维护困难。

## 目标

将提示词按分组拆分到独立文件，实现分离编辑，同时保持功能完全不变。

## 方案

### 目录结构

```
popup/promots/
├── groups/              # 分组目录（新增）
│   ├── code_gen.js     # 代码生成类
│   ├── analyze_plan.js # 分析规划类
│   ├── custom_design.js# 自定义设计类
│   ├── read.js         # 阅读理解类
│   ├── search.js       # 搜索类
│   └── other.js        # 其他类
└── prompts.js           # 入口，聚合所有分组
```

### 每个分组文件格式

```js
export const PROMPTS = {
  "完整代码输出": {
    group: "code_gen",
    label: "完整代码输出",
    template: "%s\n\n要求：\n 输出完整的文件结构..."
  },
  // ...
};
```

### 入口文件 (prompts.js)

```js
import { PROMPTS as code_gen } from './groups/code_gen.js';
import { PROMPTS as analyze_plan } from './groups/analyze_plan.js';
import { PROMPTS as custom_design } from './groups/custom_design.js';
import { PROMPTS as read } from './groups/read.js';
import { PROMPTS as search } from './groups/search.js';
import { PROMPTS as other } from './groups/other.js';

export const PROMPT_TEMPLATES = {
  ...code_gen,
  ...analyze_plan,
  ...custom_design,
  ...read,
  ...search,
  ...other,
};
```

### 命名约定

- 分组文件：小写 + 下划线 (`code_gen.js`)
- 导出常量：统一 `PROMPTS`
- 分组 key：小写 + 下划线 (`code_gen`)

## 迁移步骤

1. 创建 `groups/` 目录
2. 将 `PROMPT_TEMPLATES` 中的模板按 group 拆分到各分组文件
3. 重写 `prompts.js` 为聚合入口
4. 删除原 `prompts.js` 中的模板数据
5. 验证 UI 功能不变

## 约束

- 使用 ES Module 静态导入，无运行时元编程
- 不改变任何模板的 `key`、`label`、`template` 内容
- 不改变 `promptsUI.js` 和 `promptsUI.css`

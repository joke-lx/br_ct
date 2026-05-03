---
name: prompt-history
description: Use when user writes, edits, or creates prompts - saves all prompt content to prompt_history.txt in the project root
---

# Prompt History

## Overview

自动保存用户所有编写的提示词到项目根目录的 `prompt_history.txt` 文件，避免提示词丢失。

## When to Use

- 用户编写新提示词
- 用户修改/编辑提示词
- 用户创建提示词模板
- 用户使用提示词优化功能
- 任何涉及提示词内容的操作

## Core Pattern

### 保存时机

每次用户创建或修改提示词时，自动追加到 `prompt_history.txt`：

```
=== [时间戳] ===
来源: [文件路径或来源描述]
---
[提示词内容]
===
```

### 文件格式

```txt
=== 2026-05-03 10:30:15 ===
来源: popup/main/prompts/groups/read.js
---
请解释 %s 的含义

===

=== 2026-05-03 11:45:22 ===
来源: popup/main/prompts/prompts.js (手动输入)
---
你是一个技术写作助手

===
```

## Quick Reference

| 操作 | 行为 |
|------|------|
| 新建提示词 | 追加到 prompt_history.txt |
| 编辑提示词 | 不覆盖原内容，新增条目 |
| 删除提示词 | 不删除历史记录 |

## Implementation

文件路径: `prompt_history.txt`（项目根目录）

每次保存时：
1. 获取当前时间戳
2. 记录来源（文件路径或 "manual"）
3. 追加到文件末尾
4. 使用 `===` 分隔符包裹每个条目

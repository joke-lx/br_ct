# Skill 分组管理设计方案

## 概述

为中心仓库增加分组功能，支持在浏览器面板中对 skill 进行分组管理。配置文件持久化通过 native_host 操作，前端全权负责分组业务逻辑。

---

## 1. 配置文件结构

**路径**：`{centralPath}/.browser_chat/setting.json`

```json
{
  "groups": [
    { "id": "ungrouped", "name": "未分组" },
    { "id": "frontend", "name": "前端", "skills": ["skill-a", "skill-b"] },
    { "id": "backend", "name": "后端", "skills": ["skill-c"] }
  ]
}
```

**规则**：
- 白名单方式：只有显式列在 `skills` 数组中的 skill 才属于该分组
- `ungrouped` 为特殊分组，`skills` 字段省略，所有未被任何分组收录的 skill 自动归属"未分组"
- `id` 为唯一标识，用于前端状态关联
- 渐进式配置：初始只有"未分组"，用户逐步把 skill 拖入新分组

---

## 2. native_host 改动

### 2.1 ScanSkills 命令改动

**输入**：同现有 `path` 参数

**输出改动**：在原有 `SkillInfo` 基础上增加 `groupId` 字段

```go
type SkillInfo struct {
    Name         string `json:"name"`
    Description  string `json:"description"`
    SkillDir     string `json:"skillDir"`
    SkillMd5     string `json:"skillMd5"`
    LastModified string `json:"lastModified"`
    GroupId      string `json:"groupId"` // 新增：所属分组 ID
}
```

**逻辑**：
1. 读取 `{centralPath}/.browser_chat/setting.json`
2. 扫描 `skills/` 目录下的所有 skill
3. 根据 setting.json 构建 `groupId → skillName[]` 映射
4. 遍历 skill 列表，设置 `groupId`（未匹配任何分组的 → "ungrouped"）
5. 返回带 `groupId` 的 skill 列表

### 2.2 新增命令：SaveSkillGroups

**用途**：保存分组配置（创建/更新分组）

**输入**：
```json
{
  "command": "saveSkillGroups",
  "groups": [
    { "id": "ungrouped", "name": "未分组" },
    { "id": "frontend", "name": "前端", "skills": ["skill-a"] }
  ]
}
```

**输出**：
```json
{ "status": "ok", "data": { "success": true } }
```

**逻辑**：
1. 校验 `ungrouped` 分组必须存在
2. 将 `groups` 数组写入 `{centralPath}/.browser_chat/setting.json`
3. 返回成功

### 2.3 初始化逻辑

首次调用 `ScanSkills` 时检测配置文件：
- **不存在** → 自动创建含"未分组"的默认配置后继续扫描
- **存在但无 `ungrouped`** → 自动补充 `ungrouped` 分组

---

## 3. 前端 UI 改动

### 3.1 分组筛选器

位于左侧面板顶部：

```
[全部 ▾]  [+ 新增分组]
```

- 下拉筛选：显示全部 / 未分组 / 各分组名称
- 点击"新增分组"弹出创建弹窗

### 3.2 批量操作栏

当有 skill 被勾选时显示：

```
已选择 3 个 skill    → 移动到 [未分组 ▾]  [取消选择]
```

- 目标分组下拉包含所有分组选项
- 确认后调用 `SaveSkillGroups` 更新配置

### 3.3 分组标签

每个 skill 卡片右上角显示所属分组：

```
┌─────────────────────────────┐
│  skill-name        [前端]   │
│  描述...                    │
└─────────────────────────────┘
```

- 未分组显示为 `[未分组]` 标签
- 标签颜色与 `source-tag` 样式统一

### 3.4 创建分组弹窗

点击"新增分组"后弹出：

```
┌─────────────────────────────┐
│  创建新分组                 │
│                             │
│  分组名称：[___________]    │
│                             │
│         [取消]  [创建]      │
└─────────────────────────────┘
```

- 输入分组名称后点击创建
- 调用 `SaveSkillGroups` 添加新分组到配置

### 3.5 拖拽操作（可选）

支持将 skill 卡片拖入不同分组面板（如果左右布局改为按分组分栏）。

---

## 4. 数据流

```
用户操作（前端）
    ↓
saveSkillGroups → native_host → 写入 setting.json
    ↓
ScanSkills → native_host → 读取 setting.json + 扫描 skills/
    ↓
返回带 groupId 的 skill 列表
    ↓
前端渲染分组 UI
```

---

## 5. Go 程序职责边界

- **只读写** `{centralPath}/.browser_chat/setting.json` 文件
- **不感知** 分组业务逻辑（不知道什么是"前端"、"后端"）
- **不知道** skill 应该如何分组，只负责白名单数据存储
- **初始化** 时确保 `ungrouped` 分组存在

---

## 6. 待实现功能清单

### native_host
- [ ] 修改 `ScanSkills` 返回 `groupId`
- [ ] 新增 `SaveSkillGroups` 命令
- [ ] 实现配置文件初始化逻辑

### 前端 (skill.js)
- [ ] 分组筛选下拉组件
- [ ] 新增分组弹窗
- [ ] 批量选择和移动 skill
- [ ] 分组标签显示
- [ ] 引导创建分组提示（当未分组数量 > N 时）

---

## 7. 变更文件清单

- `native_host/internal/fileops/fileops.go` - ScanSkills 改动 + SaveSkillGroups
- `native_host/main.go` - 注册 SaveSkillGroups 命令
- `options/local_cmd/skill.js` - 前端分组 UI 和逻辑
- `options/local_cmd/index.html` - 如有新增 UI 组件

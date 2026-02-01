以下是 /optimize 接口的完整 接口描述与应用场景文档，适用于内部开发、前端对接或产品需求说明。

📄 /optimize 接口文档
智能搜索问题优化服务
🔗 接口地址

POST /optimize
🎯 功能概述
该接口接收用户原始搜索问题，根据指定意图（澄清 or 扩展），由 AI 自动生成结构化的优化建议：
当问题模糊时（type=clarify）：返回 澄清性问题 + 简单选项（choices） + 优化提问
当问题明确时（type=expand）：返回 多角度扩展的搜索变体

所有输出均为合法 JSON，可直接用于前端展示、交互引导或后续搜索。

📥 请求参数

字段 类型 必填 说明
------ -------- ------ ------
text string ✅ 是 用户原始搜索问题，例如 "AI 能帮我写代码吗？"
type string ✅ 是 优化类型，仅支持：<br>• "clarify"：问题模糊，需澄清<br>• "expand"：问题明确，需扩展
✅ 示例请求
json
{
"text": "怎么用 AI 写代码？",
"type": "clarify"
}

📤 响应结构
成功响应（HTTP 200）
json
{
"type": "clarify", // 或 "expand"
"items": [
{
"type": "clarify",
"text": "您想使用哪种编程语言？",
"choices": ["Python", "Java", "JavaScript", "Go"]
},
{
"type": "optimized",
"text": "有哪些 AI 工具可以自动生成 Python 代码？"
}
]
}
字段说明

字段 类型 说明
------ ------ ------
type string 顶层类型，与请求 type 对应
items array 优化项列表，至少包含 1 项
items[].type string 单项类型：<br>• "clarify"：需用户进一步说明<br>• "optimized"：可直接用于搜索的改写问题
items[].text string 具体问题文本
items[].choices string[] \ null 仅当 type="clarify" 时可能出现<br>提供 2~4 个高频、简洁的选项，用于前端渲染按钮/下拉菜单
💡 choices 为可选字段。若模型无法生成合理选项，则不返回该字段。

🚫 错误响应

状态码 说明 示例
-------- ------ ------
400 请求参数错误（如缺少字段、type 非法） {"error": "Key: 'RequestBody.Type' Error:Field validation..."}
500 AI 处理失败（如模型调用异常、返回非 JSON） {"error": "AI processing failed"}

🧩 应用场景
场景 1：模糊问题 → 引导用户澄清（type=clarify）
适用条件：用户提问过于宽泛、缺少上下文
典型输入：
“怎么用 AI？”
“能帮我写个程序吗？”
“推荐个工具”

前端交互建议：
展示澄清问题（如“您是指哪种编程语言？”）
渲染 choices 为 快捷按钮，点击后自动填充并发起新搜索
同时展示 2~3 个优化后的完整问题供参考

✅ 价值：降低用户表达成本，提升搜索精准度

场景 2：明确问题 → 生成搜索联想（type=expand）
适用条件：用户问题已足够清晰，需多角度扩展
典型输入：
“GitHub Copilot 怎么用？”
“Python 爬虫最佳实践”

前端交互建议：
在搜索结果页下方展示“相关搜索”卡片
每个 optimized 项作为独立链接，点击跳转新搜索

✅ 价值：激发用户探索更多相关问题，提升停留时长与满意度

🛠️ 技术特点
纯 JSON 输出：无 Markdown、无额外文本，可直接解析
强类型校验：服务端验证 type、text、choices 合法性
低延迟设计：基于 DeepSeek-V3.2 模型，响应时间 < 2s（95%）
向后兼容：旧版客户端忽略 choices 字段仍可正常工作

📌 使用建议
默认行为：前端可先尝试 type=clarify，若返回无 clarify 项，则自动切换为 expand
缓存策略：对相同 text 可缓存 5 分钟，避免重复调用
兜底逻辑：若接口失败，直接使用原始问题进行搜索

✅ 本接口已上线，服务地址：http://localhost:8888/optimize（开发环境）

如有疑问，请联系 AI 平台团队。
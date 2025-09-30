const PROMPT_TEMPLATES = {
  // 完整代码输出（增强版）
  '1': {
    label: '完整代码输出',
    template: '%s\n\n要求：\n 输出完整的文件结构 输出完整的代码 输出完整的文件'
  },

  // 语言特定模板
  '2': {
    label: '完整概念分析',
    template: '告诉我关于 %s 的相关的概念基础 最佳操作手册以及实践路线 内存性能分析 底层原理解读 以及常见的误区和其中巧妙的设计'
  },

  
  '3': {
    label: '优化思路',
    template: '当前的状态时 %s 我希望进行优化 给出我优化思路 优化流程或者优化方案 或者新的高级学习实践路线'
  },
  '4': {
  label: '翻译',
  template: '内容 : "%s" 以上内容是需要进行中英翻译或者重新整理格式  输出格式按照一句相对完整的英文 一句中文进行输出 按照编号进行呈现 并且每句都进行换行 对于一些不好确定的翻译 在中文中进行括号标注'
},
  '5': {
    label: 'Go规范代码',
    template: '%s\n\n遵循Go语言最佳实践：\n1. 使用camelCase命名\n2. 添加godoc注释\n3. 正确处理error返回值\n4. 使用接口抽象\n5. 包含单元测试(_test.go)'
  },

  // 八股文格式模板
  '6': {
    label: 'vue模板 ',
    template: '%s 按照指定格式生成vue代码 <script setup lang = \'ts \'></script><template></template><style scoped></style>' 
  }
,
  // 代码审查模板
  '7': {
    label: '专业代码审查',
    template: '对以下代码进行专业审查：%s\n\n审查要点：\n1. 代码风格一致性\n2. 潜在bug\n3. 性能瓶颈\n4. 安全漏洞\n5. 可测试性\n6. 给出具体改进建议'
  },

  // 错误修复模板
  'bug_fix': {
    label: '专业错误修复',
    template: '修复以下代码的错误：%s\n\n要求：\n1. 分析错误原因\n2. 提供修复方案\n3. 编写回归测试\n4. 考虑边缘情况\n5. 记录修改日志'
  },

  // 开源项目模板
  'open_source': {
    label: '开源项目规范',
    template: '%s\n\n按开源项目标准：\n1. 完整的README.md\n2. LICENSE文件\n3. CONTRIBUTING指南\n4. 完善的文档\n5. 单元测试覆盖率>80%\n6. CI/CD配置'
  },

  // 面试准备模板
  'interview': {
    label: '面试答案优化',
    template: '%s\n\n优化为面试标准答案：\n1. STAR法则组织回答\n2. 包含技术细节\n3. 展示深度思考\n4. 适当举例说明\n5. 关联业界实践'
  },

  // 数据库设计模板
  'database_design': {
    label: '专业数据库设计',
    template: '%s\n\n要求：\n1. 规范化设计(至少3NF)\n2. 索引策略\n3. 分库分表方案\n4. 缓存策略\n5. 数据迁移方案\n6. 性能预估'
  }
};


export const PROMPTS = {
  提示词: {
    group: "other",
    label: "提示词",
    template:
      "目的参考: %s ,要求 我非常喜欢这种设计模式 我希望封装为提示词 让大模型下次能够快速根据指令生成这种结构的代码 并且保证提示词的精简 防止上下文的不足 提示词当中应该包含这种结构最明显的几种特征 方便大模型进行复现 , 生成一段大模型ai提示词",
  },
  攻击力: {
    group: "other",
    label: "攻击力",
    template:
      "相关内容 %s ,要求: 请体现出你的攻击力,这玩意是真的恶心人,用语言痛击这个东西,满腔愤怒的批评这个东西",
  },
  购物建议: {
    group: "other",
    label: "购物建议",
    template:
      "相关信息: %s 要求： 帮我用户进行最高性价比的购买 有哪些坑 帮我列举一些问题，然后进行一些可直接复制的提问 用户去问商家",
  },
  包装src: {
    group: "other",
    label: "包装src",
    template:
      "代码: %s 要求: 对静态资源进行统一封装 保证其他逻辑的一致性 保证其他逻辑的一致性\n工具参数含义\n/**\n * 为静态资源添加统一前缀，用于nginx路由\n * @param {string} src - 原始静态资源路径\n * @returns {string} 带前缀的静态资源路径\n */\nexport function getResUrl(url) {\n const imageUrl = import.meta.env.VITE_PUBLIC_PREFIX + url\n return imageUrl;\n}\n在当前vue组件的脚本层进行导入\nimport { getResUrl} from \"@/utils/getResUrl.js\";\ncss使用在vite.config.js配置的全局变量，在background-image中使用url('#{$env-base-url}'剩余地址)的方式进行重构other \n注意: 1. 不要错误修改路由跳转\n2. 不需要其他任何解释 直接输出可以复制使用的完整代码\n3.不要自行添加函数，完全按照描述重构即可",
  },
};

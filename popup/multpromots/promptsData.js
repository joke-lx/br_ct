/**
 * 多提示词组件 - 提示词模板数据
 * 隔离的数据层，包含所有自定义的提示词模板
 */

export const PROMPT_TEMPLATES = {
  // code_gen类
  学习: {
    group: "code_gen",
    label: "学习",
    template: "%s 参考上面的逻辑和设计思想 修改，重构，生成下面的逻辑 %s1 ",
  },
  学习2: {
    group: "code_gen",
    label: "学习2",
    template: "%s 参考上面的逻辑和设计思想 修改下面的逻辑 %s1  测试：  %s2",
  },
};

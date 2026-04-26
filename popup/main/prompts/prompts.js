import { code_gen } from './groups/code_gen.js';
import { analyze_plan } from './groups/analyze_plan.js';
import { custom_design } from './groups/custom_design.js';
import { read } from './groups/read.js';
import { search } from './groups/search.js';
import { other } from './groups/other.js';

// 将数组转换为 PROMPTS 格式
function convertToPrompts(data, group) {
  const prompts = {};
  data.forEach(item => {
    prompts[item.label] = {
      group: group,
      label: item.label,
      alias: item.alias || '',
      template: item.template,
    };
  });
  return prompts;
}

export const PROMPT_TEMPLATES = {
  ...convertToPrompts(code_gen, 'code_gen'),
  ...convertToPrompts(analyze_plan, 'analyze_plan'),
  ...convertToPrompts(custom_design, 'custom_design'),
  ...convertToPrompts(read, 'read'),
  ...convertToPrompts(search, 'search'),
  ...convertToPrompts(other, 'other'),
};

// 别名到模板的快速映射表（用于 /alias 快捷输入）
export function getAliasMap() {
  const map = {};
  for (const key in PROMPT_TEMPLATES) {
    const t = PROMPT_TEMPLATES[key];
    if (t.alias) {
      map[t.alias] = { key, ...t };
    }
  }
  return map;
}

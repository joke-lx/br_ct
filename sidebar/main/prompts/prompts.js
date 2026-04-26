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
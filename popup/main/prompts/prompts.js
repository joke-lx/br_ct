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

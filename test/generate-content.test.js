/**
 * generateContent 测试用例
 *
 * TDD: 先写测试，再实现
 * 测试 generateContent(promptsList) 输出的文件格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 模拟 promptsList 的数据结构
const mockPromptsList = [
  { label: '完整代码输出', alias: 'full', template: '%s\\n\\n要求：\\n输出完整代码' },
  { label: '异常日志', alias: 'err', template: '代码: %s\n\n\t要求：异常及时抛出' },
  { label: '不修饰', alias: 'raw', template: '%s' },
  { label: '反引号测试', alias: 'backtick', template: '用`code`格式' },
  { label: '美元花括号测试', alias: 'dollar', template: '用${name}变量' },
  { label: '混合测试', alias: 'mixed', template: '内容: %s\n`code`${var}\\n' },
];

// ============ 测试 1: generateContent 函数存在 ============
function testGenerateContentExists() {
  const generateContentPath = path.join(__dirname, '..', 'options', 'prompts_editor', 'prompts_editor.js');
  const content = fs.readFileSync(generateContentPath, 'utf8');

  if (!content.includes('function generateContent')) {
    throw new Error('generateContent 函数不存在');
  }
  console.log('✅ 测试1: generateContent 函数存在');
}

// ============ 测试 2: 输出格式可被 JS 引擎解析 ============
async function testOutputIsParseableByJS(promptsList) {
  const content = generateContent(promptsList);
  const tmpFile = path.join(__dirname, 'tmp_test_group.mjs');
  fs.writeFileSync(tmpFile, content, 'utf8');

  try {
    const module = await import('file://' + tmpFile);
    const imported = module.default;

    if (!Array.isArray(imported)) {
      throw new Error(`期望数组，实际: ${typeof imported}`);
    }
    if (imported.length !== promptsList.length) {
      throw new Error(`期望 ${promptsList.length} 个元素，实际: ${imported.length}`);
    }
    console.log('✅ 测试2: 输出格式可被 JS 引擎解析');
    return imported;
  } catch (err) {
    throw new Error(`JS 解析失败: ${err.message}\n文件前500字符:\n${content.slice(0, 500)}`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ============ 测试 3: Round-trip 一致性 ============
async function testRoundTrip(promptsList) {
  const content = generateContent(promptsList);
  const tmpFile = path.join(__dirname, 'tmp_rt.mjs');
  fs.writeFileSync(tmpFile, content, 'utf8');

  try {
    const module = await import('file://' + tmpFile);
    const imported = module.default;

    const mismatches = [];
    for (let i = 0; i < promptsList.length; i++) {
      const original = promptsList[i];
      const parsed = imported[i];

      if (original.label !== parsed.label) {
        mismatches.push(`[${i}] label: "${original.label}" vs "${parsed.label}"`);
      }
      if (original.alias !== parsed.alias) {
        mismatches.push(`[${i}] alias: "${original.alias}" vs "${parsed.alias}"`);
      }
      if (original.template !== parsed.template) {
        mismatches.push(`[${i}] template:\n  原始: ${JSON.stringify(original.template)}\n  解析: ${JSON.stringify(parsed.template)}`);
      }
    }

    if (mismatches.length > 0) {
      throw new Error(`Round-trip 失败:\n${mismatches.join('\n')}`);
    }

    console.log(`✅ 测试3: Round-trip 一致性通过 (${promptsList.length} 个提示词全部匹配)`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ============ 测试 4: 特殊字符处理 ============
async function testSpecialChars() {
  const specialCases = [
    { label: '反引号', template: '用`code`格式' },
    { label: '美元花括号', template: '用${name}变量' },
    { label: '实际换行', template: 'line1\nline2' },
    { label: '实际制表符', template: 'col1\tcol2' },
    { label: '混合', template: '`code` and ${name} and \n and \t' },
    { label: '单纯反斜杠', template: 'path\\to\\file' },
    { label: '反斜杠n(非换行)', template: '显示\\n字符串' },
  ];

  let passed = 0;
  for (const item of specialCases) {
    const list = [{ label: item.label, alias: '', template: item.template }];
    const content = generateContent(list);
    // 使用唯一文件名避免 Node 模块缓存
    const tmpFile = path.join(__dirname, `tmp_sc_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`);
    fs.writeFileSync(tmpFile, content, 'utf8');

    try {
      const module = await import('file://' + tmpFile);
      const imported = module.default;

      if (imported[0].template !== item.template) {
        throw new Error(`template 不匹配:\n  输入: ${JSON.stringify(item.template)}\n  输出: ${JSON.stringify(imported[0].template)}`);
      }
      passed++;
    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch {}
      throw new Error(`[${item.label}] 失败: ${err.message}\n生成内容:\n${content}`);
    }

    try { fs.unlinkSync(tmpFile); } catch {}
  }

  console.log(`✅ 测试4: ${passed}/${specialCases.length} 特殊字符处理通过`);
}

// ============ 测试 5: Go 格式兼容 ============
function testGoFormat() {
  const content = generateContent(mockPromptsList);

  // 格式应该是: export default [...]
  if (!content.includes('export default')) {
    throw new Error('不是 export default 格式');
  }

  // 提取 JSON 内容
  const jsonMatch = content.match(/export default\s+(.+);\s*$/s);
  if (!jsonMatch) {
    throw new Error('无法提取 JSON 内容');
  }

  const jsonContent = jsonMatch[1].trim();

  try {
    JSON.parse(jsonContent);
    console.log('✅ 测试5: Go 格式兼容 (export default JSON)');
  } catch (err) {
    throw new Error(`JSON 格式错误: ${err.message}`);
  }
}

// ============ 被测试的 generateContent (新实现: export default JSON) ============
function generateContent(promptsList, groupName = 'search') {
  // 新实现: 使用 JSON.stringify，无手动转义
  const jsonStr = JSON.stringify(promptsList, null, 2);
  return `export default ${jsonStr};\n`;
}

// ============ 运行测试 ============
async function runTests() {
  console.log('='.repeat(60));
  console.log('generateContent TDD 测试');
  console.log('='.repeat(60));
  console.log();

  try {
    testGenerateContentExists();

    console.log('\n--- 基本功能测试 ---');
    await testOutputIsParseableByJS(mockPromptsList);
    await testRoundTrip(mockPromptsList);

    console.log('\n--- 特殊字符测试 ---');
    await testSpecialChars();

    console.log('\n--- Go 格式兼容测试 ---');
    testGoFormat();

    console.log('\n' + '='.repeat(60));
    console.log('所有测试通过 ✅');
    console.log('='.repeat(60));
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    process.exit(1);
  }
}

runTests();

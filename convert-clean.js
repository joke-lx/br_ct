const fs = require('fs');
const path = require('path');

const groupsDir = 'D:/code/a_js/app_ext/bro_chat/popup/main/prompts/groups';

for (const fname of fs.readdirSync(groupsDir)) {
  if (!fname.endsWith('.js')) continue;
  const fpath = path.join(groupsDir, fname);
  const content = fs.readFileSync(fpath, 'utf8');

  const nameMatch = content.match(/^export\s+default\s+\[/m);
  if (!nameMatch) { console.log('SKIP (not new format):', fname); continue; }

  // 提取 JSON 数组
  const jsonStart = content.indexOf('[');
  const jsonEnd = content.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) { console.log('SKIP (no json):', fname); continue; }

  const jsonStr = content.slice(jsonStart, jsonEnd + 1);

  try {
    const prompts = JSON.parse(jsonStr);
    // 只保留 label, alias, template
    const cleaned = prompts.map(p => ({
      label: p.label,
      alias: p.alias || '',
      template: p.template
    }));
    const newJsonStr = JSON.stringify(cleaned, null, 2);
    const output = `export default ${newJsonStr};\n`;
    fs.writeFileSync(fpath, output, 'utf8');
    console.log(`OK: ${fname} (${cleaned.length} prompts)`);
  } catch (e) {
    console.log(`ERROR: ${fname} - ${e.message}`);
  }
}

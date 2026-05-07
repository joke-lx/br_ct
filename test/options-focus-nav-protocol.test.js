import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const optionsSource = fs.readFileSync(path.join(__dirname, '..', 'options', 'options.js'), 'utf8');

assert.ok(
  optionsSource.includes("const delta = direction === 'prev' ? -1 : 1"),
  'options/options.js should treat focus scroll direction as next/prev'
);

assert.ok(
  optionsSource.includes("return direction === 'prev' ? 'bottom' : 'top'"),
  'options/options.js should map prev -> bottom and next -> top'
);

console.log('✅ focus scroll protocol uses next/prev in options/options.js');

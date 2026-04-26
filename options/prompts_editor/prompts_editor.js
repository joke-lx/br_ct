/**
 * 提示词编辑器
 */

let port = null;
let currentFile = null;
let currentGroup = null;
let promptsList = [];
let expandedIndex = -1;

document.addEventListener('DOMContentLoaded', init);

function init() {
  initConnection();
  initEvents();
}

function initConnection() {
  try {
    port = chrome.runtime.connectNative('com.brochat.prompts_editor');
    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(() => {
      port = null;
      updateStatus(false);
    });
    updateStatus(true);
    loadFiles();
  } catch (err) {
    updateStatus(false);
  }
}

function updateStatus(connected) {
  document.getElementById('connectBtn').style.display = connected ? 'none' : 'inline-block';
  document.getElementById('disconnectBtn').style.display = connected ? 'inline-block' : 'none';
  const el = document.getElementById('connectionStatus');
  el.textContent = connected ? '已连接' : '未连接';
  el.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
}

let pendingCommand = null;

function handleMessage(msg) {
  if (msg.status === 'error') {
    toast(msg.message || '操作失败', 'error');
    pendingCommand = null;
    return;
  }
  if (Array.isArray(msg.data)) {
    promptsList = msg.data;
    expandedIndex = -1;
    renderPrompts();
  } else if (msg.command === 'listDir') {
    renderFileList(msg.data || []);
  } else if (msg.status === 'ok' && pendingCommand === 'savePrompts') {
    toast(msg.message || '操作成功');
  }
  pendingCommand = null;
}

function send(cmd, params = {}) {
  if (!port) {
    toast('未连接', 'error');
    return Promise.reject();
  }
  pendingCommand = cmd;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('超时'), 10000);
    const listener = (response) => {
      clearTimeout(timeout);
      port.onMessage.removeListener(listener);
      resolve(response);
    };
    port.onMessage.addListener(listener);
    port.postMessage({ command: cmd, ...params });
  });
}

function initEvents() {
  document.getElementById('connectBtn').addEventListener('click', initConnection);
  document.getElementById('disconnectBtn').addEventListener('click', () => {
    if (port) { port.disconnect(); port = null; }
    updateStatus(false);
  });
  document.getElementById('refreshFiles').addEventListener('click', loadFiles);
  document.getElementById('addBtn').addEventListener('click', showAddModal);
  document.getElementById('cancelAdd').addEventListener('click', hideAddModal);
  document.getElementById('confirmAdd').addEventListener('click', addPrompt);
  document.getElementById('addModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) hideAddModal();
  });
}

async function loadFiles() {
  try {
    const dir = await send('getPromptsDir');
    const list = await send('listDir', { path: dir.data });
    renderFileList(list.data || []);

    if (!currentFile && list.data && list.data.length > 0) {
      const firstJs = list.data.find(f => f.extension === 'js' && !f.isDir);
      if (firstJs) selectFile(firstJs.name);
    } else if (currentFile) {
      selectFile(currentFile);
    }
  } catch (err) {
    toast('加载失败', 'error');
  }
}

function renderFileList(files) {
  const el = document.getElementById('fileList');
  const jsFiles = files.filter(f => f.extension === 'js' && !f.isDir);

  if (!jsFiles.length) {
    el.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 13px;">无提示词文件</div>';
    return;
  }

  el.innerHTML = jsFiles.map(f => `
    <div class="file-item ${f.name === currentFile ? 'active' : ''}" data-name="${f.name}">
      <span>${f.name}</span>
    </div>
  `).join('');

  el.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => selectFile(item.dataset.name));
  });
}

async function selectFile(fileName) {
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === fileName);
  });

  document.getElementById('currentFileName').textContent = fileName;
  currentFile = fileName;
  currentGroup = fileName.replace(/\.js$/, '');

  document.getElementById('editorContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const dir = await send('getPromptsDir');
    const result = await send('parsePrompts', { path: `${dir.data}\\${fileName}` });
    promptsList = result.data || [];
    expandedIndex = -1;
    renderPrompts();
  } catch (err) {
    document.getElementById('editorContent').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`;
  }
}

function renderPrompts() {
  const el = document.getElementById('editorContent');

  if (!promptsList.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <p>点击上方添加按钮创建提示词</p>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="prompts-list">
      ${promptsList.map((p, i) => `
        <div class="prompt-item ${expandedIndex === i ? 'expanded' : ''}" data-index="${i}">
          <div class="prompt-item-header">
            <span class="prompt-item-title">${escapeHtml(p.label)}</span>
            <div class="item-buttons">
              <button data-action="delete" data-index="${i}">删除</button>
              <button class="btn-primary" data-action="save" data-index="${i}">保存</button>
            </div>
          </div>
          <div class="prompt-item-body ${expandedIndex === i ? 'expanded' : ''}">
            <input type="text" id="label-${i}" value="${escapeHtml(p.label)}" placeholder="输入标题">
            <textarea id="tpl-${i}" placeholder="输入提示词内容">${escapeHtml(p.template)}</textarea>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 点击标题展开
  el.querySelectorAll('.prompt-item-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const i = parseInt(header.closest('.prompt-item').dataset.index);
      expandedIndex = expandedIndex === i ? -1 : i;
      renderPrompts();
    });
  });

  // 保存按钮
  el.querySelectorAll('[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', () => savePrompt(parseInt(btn.dataset.index)));
  });

  // 删除按钮
  el.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deletePrompt(parseInt(btn.dataset.index)));
  });
}

async function savePrompt(index) {
  const labelInput = document.getElementById(`label-${index}`);
  const ta = document.getElementById(`tpl-${index}`);
  const newLabel = labelInput.value.trim();
  const newTemplate = ta.value;

  if (!newLabel) { toast('标题不能为空', 'error'); return; }

  // 检查是否与其他标题重复
  if (promptsList.some((p, i) => i !== index && p.label === newLabel)) {
    toast('标题已存在', 'error'); return;
  }

  promptsList[index].label = newLabel;
  promptsList[index].template = newTemplate;

  try {
    await send('savePrompts', {
      path: `${(await send('getPromptsDir')).data}\\${currentFile}`,
      content: generateContent()
    });
    toast('已保存');
  } catch (err) {
    toast('保存失败', 'error');
  }
}

async function deletePrompt(index) {
  if (!confirm(`确定删除 "${promptsList[index].label}" ?`)) return;

  const deleted = promptsList.splice(index, 1)[0];
  if (expandedIndex >= index && expandedIndex > 0) expandedIndex--;

  try {
    await send('savePrompts', {
      path: `${(await send('getPromptsDir')).data}\\${currentFile}`,
      content: generateContent()
    });
    toast(`已删除: ${deleted.label}`);
    renderPrompts();
  } catch (err) {
    promptsList.splice(index, 0, deleted);
    toast('删除失败', 'error');
  }
}

function showAddModal() {
  document.getElementById('addModal').style.display = 'flex';
  document.getElementById('promptLabel').value = '';
  document.getElementById('promptTemplate').value = '';
  document.getElementById('promptLabel').focus();
}

function hideAddModal() {
  document.getElementById('addModal').style.display = 'none';
}

async function addPrompt() {
  const label = document.getElementById('promptLabel').value.trim();
  const template = document.getElementById('promptTemplate').value.trim();
  if (!label) { toast('请输入名称', 'error'); return; }
  if (promptsList.some(p => p.label === label)) { toast('名称已存在', 'error'); return; }

  promptsList.push({ id: Date.now().toString(36), group: currentGroup, label, template });
  hideAddModal();

  try {
    await send('savePrompts', {
      path: `${(await send('getPromptsDir')).data}\\${currentFile}`,
      content: generateContent()
    });
    toast('已添加');
    renderPrompts();
  } catch (err) {
    promptsList.pop();
    toast('添加失败', 'error');
  }
}

function generateContent() {
  let content = `export const ${currentGroup} = [\n`;
  promptsList.forEach((p, i) => {
    // 转义模板中的反引号、$ 和换行符
    const tpl = p.template
      .replace(/\\/g, '\\\\')  // 先转义反斜杠
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/\n/g, '\\n');  // 换行符转回 \n 字面量
    content += `  {\n    label: "${p.label}",\n    template: \`${tpl}\`\n  }`;
    content += i < promptsList.length - 1 ? ',\n' : '\n';
  });
  return content + '];\n';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

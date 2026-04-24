/**
 * 提示词编辑器
 * 每个条目独立操作，展开后显示保存/删除按钮
 */

let port = null;
let currentFile = null;
let currentGroup = null;
let promptsList = [];
let expandedItems = new Set();

document.addEventListener('DOMContentLoaded', init);

function init() {
  initConnection();
  initEvents();
}

// 连接
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
  const el = document.getElementById('connectionStatus');
  document.getElementById('connectBtn').style.display = connected ? 'none' : 'inline-block';
  document.getElementById('disconnectBtn').style.display = connected ? 'inline-block' : 'none';
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

    // 如果没有选中文件，自动选中第一个
    if (!currentFile && list.data && list.data.length > 0) {
      const firstJs = list.data.find(f => f.extension === 'js' && !f.isDir);
      if (firstJs) {
        selectFile(firstJs.name);
      }
    } else if (currentFile) {
      // 刷新当前文件
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
    el.innerHTML = '<div class="empty-state"><p>无提示词文件</p></div>';
    return;
  }

  el.innerHTML = jsFiles.map(f => `
    <div class="file-item ${f.name === currentFile ? 'active' : ''}" data-name="${f.name}">
      <span>📄</span><span>${f.name}</span>
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
  expandedItems.clear();

  document.getElementById('editorContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const dir = await send('getPromptsDir');
    const result = await send('parsePrompts', { path: `${dir.data}\\${fileName}` });
    promptsList = result.data || [];
    renderPrompts();
  } catch (err) {
    document.getElementById('editorContent').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`;
  }
}

function renderPrompts() {
  const el = document.getElementById('editorContent');

  if (!promptsList.length) {
    el.innerHTML = '<div class="empty-state"><p>空文件，点击上方添加</p></div>';
    return;
  }

  el.innerHTML = `
    <div class="prompts-list">
      ${promptsList.map((p, i) => `
        <div class="prompt-item">
          <div class="prompt-item-header" data-index="${i}">
            <span class="prompt-item-title">${escapeHtml(p.label)}</span>
          </div>
          <div class="prompt-item-body" id="body-${i}" style="display: ${expandedItems.has(i) ? 'block' : 'none'};">
            <textarea id="tpl-${i}">${escapeHtml(p.template)}</textarea>
            <div class="item-buttons">
              <button class="btn btn-secondary" data-action="delete" data-index="${i}">🗑️</button>
              <button class="btn btn-primary" data-action="save" data-index="${i}">💾</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 点击 header 展开/收起
  el.querySelectorAll('.prompt-item-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // 如果点击的是按钮，不触发展开
      if (e.target.closest('button')) return;
      const i = parseInt(header.dataset.index);
      expandedItems.has(i) ? expandedItems.delete(i) : expandedItems.add(i);
      renderPrompts();
    });
  });

  // 保存按钮
  el.querySelectorAll('[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      savePrompt(parseInt(btn.dataset.index));
    });
  });

  // 删除按钮
  el.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePrompt(parseInt(btn.dataset.index));
    });
  });
}

async function savePrompt(index) {
  const ta = document.getElementById(`tpl-${index}`);
  promptsList[index].template = ta.value;

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
  if (!confirm(`删除 "${promptsList[index].label}"?`)) return;

  const deleted = promptsList.splice(index, 1)[0];
  expandedItems.delete(index);

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
  document.getElementById('promptLabel').focus();
}

function hideAddModal() {
  document.getElementById('addModal').style.display = 'none';
}

async function addPrompt() {
  const label = document.getElementById('promptLabel').value.trim();
  if (!label) { toast('请输入名称', 'error'); return; }
  if (promptsList.some(p => p.label === label)) { toast('名称已存在', 'error'); return; }

  promptsList.push({ id: Date.now().toString(36), group: currentGroup, label, template: '' });
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
    const tpl = p.template.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    content += `  {\n    label: "${p.label}",\n    template: "${tpl}"\n  }`;
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

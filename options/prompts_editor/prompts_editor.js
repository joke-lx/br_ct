/**
 * 提示词编辑器
 * 通过 background native_relay 中转通信（单例 native host）
 */

let currentFile = null;
let currentGroup = null;
let promptsList = [];
let expandedIndex = -1;

document.addEventListener('DOMContentLoaded', init);

function init() {
  initEvents();
  checkStatus();
}

function checkStatus() {
  sendNativeMessage({ command: 'getPromptsDir' })
    .then(() => updateStatus(true))
    .catch(() => updateStatus(false));
  loadFiles();
}

function updateStatus(connected) {
  const btn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  if (!btn || !disconnectBtn) return;
  btn.style.display = connected ? 'none' : 'inline-block';
  disconnectBtn.style.display = connected ? 'inline-block' : 'none';
  const el = document.getElementById('connectionStatus');
  if (el) {
    el.textContent = connected ? '已连接' : '未连接';
    el.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
  }
}

function sendNativeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'nativeMessage', payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('Native host 无响应'));
        return;
      }
      if (response.status === 'error') {
        reject(new Error(response.message || '操作失败'));
        return;
      }
      resolve(response);
    });
  });
}

function initEvents() {
  document.getElementById('connectBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'nativeConnect' });
    updateStatus(true);
  });
  document.getElementById('disconnectBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'nativeDisconnect' });
    updateStatus(false);
  });
  const refreshBtn = document.getElementById('refreshFiles');
  if (refreshBtn) refreshBtn.addEventListener('click', loadFiles);
  const addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.addEventListener('click', showAddModal);
  const cancelAdd = document.getElementById('cancelAdd');
  if (cancelAdd) cancelAdd.addEventListener('click', hideAddModal);
  const confirmAdd = document.getElementById('confirmAdd');
  if (confirmAdd) confirmAdd.addEventListener('click', addPrompt);
  const addModal = document.getElementById('addModal');
  if (addModal) {
    addModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) hideAddModal();
    });
  }
}

async function loadFiles() {
  try {
    const dir = await sendNativeMessage({ command: 'getPromptsDir' });
    const list = await sendNativeMessage({ command: 'listDir', path: dir.data });
    renderFileList(list.data || []);

    if (!currentFile && list.data && list.data.length > 0) {
      const firstJs = list.data.find(f => f.extension === 'js' && !f.isDir);
      if (firstJs) selectFile(firstJs.name);
    } else if (currentFile) {
      selectFile(currentFile);
    }
  } catch (err) {
    toast('加载失败: ' + err.message, 'error');
  }
}

function renderFileList(files) {
  const el = document.getElementById('fileList');
  if (!el) return;
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
    const dir = await sendNativeMessage({ command: 'getPromptsDir' });
    const result = await sendNativeMessage({ command: 'parsePrompts', path: `${dir.data}\\${fileName}` });
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
            <span class="prompt-item-title">${escapeHtml(p.label)}${p.alias ? ` <small style="color:var(--text-muted);font-weight:400;font-size:11px;">/${escapeHtml(p.alias)}</small>` : ''}</span>
            <div class="item-buttons">
              <button data-action="delete" data-index="${i}">删除</button>
              <button class="btn-primary" data-action="save" data-index="${i}">保存</button>
            </div>
          </div>
          <div class="prompt-item-body ${expandedIndex === i ? 'expanded' : ''}">
            <input type="text" id="label-${i}" value="${escapeHtml(p.label)}" placeholder="输入标题">
            <input type="text" id="alias-${i}" value="${escapeHtml(p.alias || '')}" placeholder="输入别名（如 fix）用于 /fix 快捷触发">
            <textarea id="tpl-${i}" placeholder="输入提示词内容">${escapeHtml(p.template)}</textarea>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  el.querySelectorAll('.prompt-item-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const i = parseInt(header.closest('.prompt-item').dataset.index);
      expandedIndex = expandedIndex === i ? -1 : i;
      renderPrompts();
    });
  });

  el.querySelectorAll('[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', () => savePrompt(parseInt(btn.dataset.index)));
  });

  el.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deletePrompt(parseInt(btn.dataset.index)));
  });
}

async function savePrompt(index) {
  const labelInput = document.getElementById(`label-${index}`);
  const aliasInput = document.getElementById(`alias-${index}`);
  const ta = document.getElementById(`tpl-${index}`);
  const newLabel = labelInput.value.trim();
  const newAlias = aliasInput.value.trim();
  const newTemplate = ta.value;

  if (!newLabel) { toast('标题不能为空', 'error'); return; }
  if (promptsList.some((p, i) => i !== index && p.label === newLabel)) {
    toast('标题已存在', 'error'); return;
  }
  if (newAlias && promptsList.some((p, i) => i !== index && p.alias === newAlias)) {
    toast('别名已存在', 'error'); return;
  }

  promptsList[index].label = newLabel;
  promptsList[index].alias = newAlias;
  promptsList[index].template = newTemplate;

  try {
    const dir = await sendNativeMessage({ command: 'getPromptsDir' });
    await sendNativeMessage({
      command: 'savePrompts',
      path: `${dir.data}\\${currentFile}`,
      content: generateContent()
    });
    toast('已保存');
  } catch (err) {
    toast('保存失败: ' + err.message, 'error');
  }
}

async function deletePrompt(index) {
  const deleted = promptsList.splice(index, 1)[0];
  if (expandedIndex >= index && expandedIndex > 0) expandedIndex--;

  try {
    const dir = await sendNativeMessage({ command: 'getPromptsDir' });
    await sendNativeMessage({
      command: 'savePrompts',
      path: `${dir.data}\\${currentFile}`,
      content: generateContent()
    });
    toast(`已删除: ${deleted.label}`);
    renderPrompts();
  } catch (err) {
    promptsList.splice(index, 0, deleted);
    toast('删除失败: ' + err.message, 'error');
  }
}

function showAddModal() {
  document.getElementById('addModal').style.display = 'flex';
  document.getElementById('promptLabel').value = '';
  document.getElementById('promptAlias').value = '';
  document.getElementById('promptTemplate').value = '';
  document.getElementById('promptLabel').focus();
}

function hideAddModal() {
  document.getElementById('addModal').style.display = 'none';
}

async function addPrompt() {
  const label = document.getElementById('promptLabel').value.trim();
  const alias = document.getElementById('promptAlias').value.trim();
  const template = document.getElementById('promptTemplate').value.trim();
  if (!label) { toast('请输入名称', 'error'); return; }
  if (promptsList.some(p => p.label === label)) { toast('名称已存在', 'error'); return; }
  if (alias && promptsList.some(p => p.alias === alias)) { toast('别名已存在', 'error'); return; }

  promptsList.push({ label, alias, template });
  hideAddModal();

  try {
    const dir = await sendNativeMessage({ command: 'getPromptsDir' });
    await sendNativeMessage({
      command: 'savePrompts',
      path: `${dir.data}\\${currentFile}`,
      content: generateContent()
    });
    toast('已添加');
    renderPrompts();
  } catch (err) {
    promptsList.pop();
    toast('添加失败: ' + err.message, 'error');
  }
}

function generateContent() {
  const jsonStr = JSON.stringify(promptsList, null, 2);
  return `export default ${jsonStr};\n`;
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

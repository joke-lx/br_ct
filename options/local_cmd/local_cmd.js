/**
 * 本地命令管理 - 命令模板 + 子进程管理 + Git 监控
 */

const NATIVE_HOST = 'com.brochat.prompts_editor';
const STORAGE_KEYS = {
  commandTemplates: 'commandTemplates',
  gitMonitoredDirs: 'gitMonitoredDirs',
};

// ========== 工具函数 ==========

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
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
    } catch (err) {
      reject(err);
    }
  });
}

function loadStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] || []);
    });
  });
}

function saveStorage(key, data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: data }, resolve);
  });
}

function formatTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { hour12: false });
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', init);

function init() {
  checkNativeHost();
  initTabs();
  initCommandTab();
  initProcessTab();
  initGitTab();
}

async function checkNativeHost() {
  const dot = document.getElementById('nativeDot');
  const status = document.getElementById('nativeStatus');
  try {
    await sendNativeMessage({ command: 'listProcesses' });
    dot.className = 'status-dot running';
    status.textContent = 'Native Host 已连接';
  } catch (err) {
    dot.className = 'status-dot stopped';
    status.textContent = 'Native Host 未连接 - ' + err.message;
  }
}

// ========== Tab 切换 ==========

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');

      if (btn.dataset.tab === 'processes') loadProcesses();
      if (btn.dataset.tab === 'git') loadGitStatus();
    });
  });
}

// ========== 命令管理 ==========

let editingCmdId = null;

function initCommandTab() {
  document.getElementById('addCmdBtn').addEventListener('click', () => openCmdModal());
  document.getElementById('cmdCancelBtn').addEventListener('click', closeCmdModal);
  document.getElementById('cmdSaveBtn').addEventListener('click', saveCmd);
  document.getElementById('cmdModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCmdModal();
  });
  loadCommandList();
}

async function loadCommandList() {
  const templates = await loadStorage(STORAGE_KEYS.commandTemplates);
  const container = document.getElementById('cmdList');

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无命令模板</p>
        <button class="btn btn-primary" onclick="openCmdModal()">添加第一个命令</button>
      </div>`;
    return;
  }

  container.innerHTML = templates.map(t => `
    <div class="cmd-card">
      <div class="cmd-card-header">
        <span class="cmd-card-name">${escapeHtml(t.name)}</span>
        <div class="cmd-card-actions">
          <button class="btn btn-success" onclick="executeCmd('${t.id}')">启动</button>
          <button class="btn btn-edit" onclick="editCmd('${t.id}')">编辑</button>
          <button class="btn btn-danger" onclick="deleteCmd('${t.id}')">删除</button>
        </div>
      </div>
      <dl class="cmd-card-detail">
        <dt>目录</dt><dd>${escapeHtml(t.workDir)}</dd>
        <dt>命令</dt><dd>${escapeHtml(t.cmd)} ${escapeHtml(t.args || '')}</dd>
      </dl>
    </div>
  `).join('');
}

function openCmdModal(template = null) {
  editingCmdId = template ? template.id : null;
  document.getElementById('cmdModalTitle').textContent = template ? '编辑命令' : '新增命令';
  document.getElementById('cmdName').value = template ? template.name : '';
  document.getElementById('cmdWorkDir').value = template ? template.workDir : '';
  document.getElementById('cmdCmd').value = template ? template.cmd : '';
  document.getElementById('cmdArgs').value = template ? template.args : '';
  document.getElementById('cmdModal').classList.add('show');
}

function closeCmdModal() {
  document.getElementById('cmdModal').classList.remove('show');
  editingCmdId = null;
}

async function saveCmd() {
  const name = document.getElementById('cmdName').value.trim();
  const workDir = document.getElementById('cmdWorkDir').value.trim();
  const cmd = document.getElementById('cmdCmd').value.trim();
  const args = document.getElementById('cmdArgs').value.trim();

  if (!name || !workDir || !cmd) {
    alert('名称、工作目录和命令为必填项');
    return;
  }

  const templates = await loadStorage(STORAGE_KEYS.commandTemplates);

  if (editingCmdId) {
    const idx = templates.findIndex(t => t.id === editingCmdId);
    if (idx >= 0) {
      templates[idx] = { ...templates[idx], name, workDir, cmd, args };
    }
  } else {
    templates.push({ id: generateId(), name, workDir, cmd, args });
  }

  await saveStorage(STORAGE_KEYS.commandTemplates, templates);
  closeCmdModal();
  loadCommandList();
}

async function editCmd(id) {
  const templates = await loadStorage(STORAGE_KEYS.commandTemplates);
  const template = templates.find(t => t.id === id);
  if (template) openCmdModal(template);
}

async function deleteCmd(id) {
  if (!confirm('确定删除此命令模板？')) return;
  const templates = await loadStorage(STORAGE_KEYS.commandTemplates);
  await saveStorage(STORAGE_KEYS.commandTemplates, templates.filter(t => t.id !== id));
  loadCommandList();
}

async function executeCmd(id) {
  const templates = await loadStorage(STORAGE_KEYS.commandTemplates);
  const template = templates.find(t => t.id === id);
  if (!template) return;

  const argsArray = template.args ? template.args.split(/\s+/) : [];

  try {
    const resp = await sendNativeMessage({
      command: 'startProcess',
      name: template.name,
      workDir: template.workDir,
      cmd: template.cmd,
      args: argsArray,
    });
    alert(`已启动: ${template.name} (PID: ${resp.data.pid})`);
  } catch (err) {
    alert(`启动失败: ${err.message}`);
  }
}

// ========== 子进程管理 ==========

function initProcessTab() {
  document.getElementById('refreshProcessesBtn').addEventListener('click', loadProcesses);
}

async function loadProcesses() {
  const container = document.getElementById('processList');

  try {
    const resp = await sendNativeMessage({ command: 'listProcesses' });
    const processes = resp.data || [];

    if (processes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>当前没有管理的进程</p>
          <p style="font-size:14px;">通过"命令管理"启动命令后，进程会出现在这里</p>
        </div>`;
      return;
    }

    container.innerHTML = processes.map(p => `
      <div class="process-card">
        <div class="process-info">
          <div class="process-name">${escapeHtml(p.name || p.cmd)}</div>
          <div class="process-meta">
            PID: ${p.pid} | 目录: ${escapeHtml(p.workDir || '-')} | 命令: ${escapeHtml(p.cmd)} ${(p.args || []).join(' ')} | 启动时间: ${formatTime(p.startTime)}
          </div>
        </div>
        <span class="status-badge ${p.running ? 'running' : 'stopped'}">
          <span class="status-dot ${p.running ? 'running' : 'stopped'}"></span>
          ${p.running ? '运行中' : '已停止'}
        </span>
        <div style="display:flex; gap:8px;">
          ${p.running
            ? `<button class="btn btn-danger" onclick="stopProcess(${p.pid})">停止</button>`
            : `<button class="btn btn-secondary" onclick="removeProcess(${p.pid})">移除</button>`
          }
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>无法获取进程列表</p>
        <p style="font-size:14px; color: var(--danger);">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

async function stopProcess(pid) {
  if (!confirm(`确定停止进程 ${pid}？`)) return;
  try {
    await sendNativeMessage({ command: 'stopProcess', pid });
    loadProcesses();
  } catch (err) {
    alert(`停止失败: ${err.message}`);
  }
}

async function removeProcess(pid) {
  try {
    await sendNativeMessage({ command: 'removeProcess', pid });
    loadProcesses();
  } catch (err) {
    alert(`移除失败: ${err.message}`);
  }
}

// ========== Git 监控 ==========

let gitStatusCache = [];

function initGitTab() {
  document.getElementById('addGitDirBtn').addEventListener('click', () => openGitDirModal());
  document.getElementById('gitDirCancelBtn').addEventListener('click', closeGitDirModal);
  document.getElementById('gitDirSaveBtn').addEventListener('click', saveGitDir);
  document.getElementById('gitDirModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeGitDirModal();
  });
  document.getElementById('batchRefreshBtn').addEventListener('click', loadGitStatus);
  document.getElementById('batchPullBtn').addEventListener('click', batchPull);
  document.getElementById('batchPushBtn').addEventListener('click', batchPush);
  loadGitDirList();
}

async function loadGitDirList() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const container = document.getElementById('gitList');

  if (dirs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无监控目录</p>
        <button class="btn btn-primary" onclick="openGitDirModal()">添加第一个目录</button>
      </div>`;
    return;
  }

  container.innerHTML = dirs.map(d => `
    <div class="git-card" id="git-card-${d.id}">
      <div class="git-card-header">
        <span class="git-card-dir">${escapeHtml(d.name)} <span style="color:var(--muted);font-weight:400;font-size:14px;">${escapeHtml(d.path)}</span></span>
        <div class="git-card-actions">
          <button class="btn btn-secondary" onclick="gitRefreshDir('${d.id}')">刷新</button>
          <button class="btn btn-success" onclick="gitPullDir('${d.id}')">Pull</button>
          <button class="btn btn-primary" onclick="gitPushDir('${d.id}')">Push</button>
          <button class="btn btn-danger" onclick="deleteGitDir('${d.id}')">移除</button>
        </div>
      </div>
      <div class="git-status-area" id="git-status-${d.id}">
        <span style="color:var(--muted);font-size:14px;">点击"刷新"查看状态</span>
      </div>
    </div>
  `).join('');
}

function openGitDirModal() {
  document.getElementById('gitDirName').value = '';
  document.getElementById('gitDirPath').value = '';
  document.getElementById('gitDirModal').classList.add('show');
}

function closeGitDirModal() {
  document.getElementById('gitDirModal').classList.remove('show');
}

async function saveGitDir() {
  const name = document.getElementById('gitDirName').value.trim();
  const path = document.getElementById('gitDirPath').value.trim();

  if (!name || !path) {
    alert('名称和路径为必填项');
    return;
  }

  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  dirs.push({ id: generateId(), name, path });
  await saveStorage(STORAGE_KEYS.gitMonitoredDirs, dirs);
  closeGitDirModal();
  loadGitDirList();
}

async function deleteGitDir(id) {
  if (!confirm('确定移除此监控目录？')) return;
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  await saveStorage(STORAGE_KEYS.gitMonitoredDirs, dirs.filter(d => d.id !== id));
  loadGitDirList();
}

async function loadGitStatus() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  if (dirs.length === 0) return;

  try {
    const resp = await sendNativeMessage({
      command: 'gitBatchStatus',
      dirs: dirs.map(d => d.path),
    });
    gitStatusCache = resp.data || [];
    renderGitStatus(dirs, gitStatusCache);
  } catch (err) {
    alert('获取 Git 状态失败: ' + err.message);
  }
}

function renderGitStatus(dirs, statuses) {
  dirs.forEach((d, i) => {
    const area = document.getElementById('git-status-' + d.id);
    if (!area) return;

    const s = statuses[i];
    if (!s || s.error) {
      area.innerHTML = `<span style="color:var(--danger);font-size:14px;">${escapeHtml(s?.error || '未知错误')}</span>`;
      return;
    }

    const filesHtml = (label, files, color) => {
      if (!files || files.length === 0) return '';
      return `<div style="margin-top:8px;">
        <span style="font-size:12px;font-weight:600;color:${color};">${label} (${files.length})</span>
        <div style="margin-top:4px;font-size:12px;color:var(--muted);max-height:100px;overflow:auto;">
          ${files.map(f => `<div>${escapeHtml(f)}</div>`).join('')}
        </div>
      </div>`;
    };

    area.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-weight:600;">${escapeHtml(s.branch || 'unknown')}</span>
        <span class="status-badge ${s.clean ? 'running' : 'stopped'}">
          <span class="status-dot ${s.clean ? 'running' : 'stopped'}"></span>
          ${s.clean ? '干净' : '有变更'}
        </span>
      </div>
      <div class="git-status-grid">
        <div class="git-stat">
          <div class="git-stat-value ${s.ahead > 0 ? 'dirty' : 'clean'}">${s.ahead}</div>
          <div class="git-stat-label">待推送</div>
        </div>
        <div class="git-stat">
          <div class="git-stat-value ${s.behind > 0 ? 'dirty' : 'clean'}">${s.behind}</div>
          <div class="git-stat-label">待拉取</div>
        </div>
        <div class="git-stat">
          <div class="git-stat-value ${s.modCount > 0 ? 'dirty' : 'clean'}">${s.modCount}</div>
          <div class="git-stat-label">已修改</div>
        </div>
        <div class="git-stat">
          <div class="git-stat-value ${s.untrackCount > 0 ? 'dirty' : 'clean'}">${s.untrackCount}</div>
          <div class="git-stat-label">未跟踪</div>
        </div>
      </div>
      ${filesHtml('已暂存', s.staged, '#6a8758')
       + filesHtml('已修改', s.modified, '#9a4f40')
       + filesHtml('未跟踪', s.untracked, '#7a6858')}
    `;
  });
}

async function gitRefreshDir(id) {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const dir = dirs.find(d => d.id === id);
  if (!dir) return;

  const area = document.getElementById('git-status-' + id);
  if (area) area.innerHTML = '<span style="color:var(--muted);font-size:14px;">刷新中...</span>';

  try {
    const resp = await sendNativeMessage({ command: 'gitStatus', path: dir.path });
    const allStatuses = gitStatusCache.length === dirs.length ? [...gitStatusCache] : [];
    const idx = dirs.indexOf(dir);
    if (idx >= 0) {
      allStatuses[idx] = resp.data;
      gitStatusCache = allStatuses;
    }
    renderGitStatus(dirs, allStatuses.length ? allStatuses : [resp.data]);
  } catch (err) {
    if (area) area.innerHTML = `<span style="color:var(--danger);font-size:14px;">${escapeHtml(err.message)}</span>`;
  }
}

async function gitPullDir(id) {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const dir = dirs.find(d => d.id === id);
  if (!dir) return;

  try {
    const resp = await sendNativeMessage({ command: 'gitPull', path: dir.path });
    const result = resp.data;
    alert(result.success ? `Pull 成功\n${result.output}` : `Pull 失败\n${result.error}\n${result.output}`);
    gitRefreshDir(id);
  } catch (err) {
    alert('Pull 失败: ' + err.message);
  }
}

async function gitPushDir(id) {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const dir = dirs.find(d => d.id === id);
  if (!dir) return;

  try {
    const resp = await sendNativeMessage({ command: 'gitPush', path: dir.path });
    const result = resp.data;
    alert(result.success ? `Push 成功\n${result.output}` : `Push 失败\n${result.error}\n${result.output}`);
    gitRefreshDir(id);
  } catch (err) {
    alert('Push 失败: ' + err.message);
  }
}

async function batchPull() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  if (dirs.length === 0) return;

  try {
    const resp = await sendNativeMessage({
      command: 'gitBatchPull',
      dirs: dirs.map(d => d.path),
    });
    const results = resp.data || [];
    const summary = results.map(r =>
      `${r.dir}: ${r.success ? '成功' : '失败 - ' + r.error}`
    ).join('\n');
    alert('批量 Pull 结果:\n' + summary);
    loadGitStatus();
  } catch (err) {
    alert('批量 Pull 失败: ' + err.message);
  }
}

async function batchPush() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  if (dirs.length === 0) return;

  if (!confirm('确定对所有目录执行 Push？')) return;

  try {
    const resp = await sendNativeMessage({
      command: 'gitBatchPush',
      dirs: dirs.map(d => d.path),
    });
    const results = resp.data || [];
    const summary = results.map(r =>
      `${r.dir}: ${r.success ? '成功' : '失败 - ' + r.error}`
    ).join('\n');
    alert('批量 Push 结果:\n' + summary);
    loadGitStatus();
  } catch (err) {
    alert('批量 Push 失败: ' + err.message);
  }
}

// ========== 工具 ==========

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

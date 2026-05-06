/**
 * 本地命令管理 - 命令模板 + 子进程管理 + Git 监控
 * 通过 background native_relay 中转通信（单例 native host）
 */

const STORAGE_KEYS = {
  commandTemplates: 'commandTemplates',
  gitMonitoredDirs: 'gitMonitoredDirs',
  skillCentralPath: 'skillCentralPath',
  skillMonitoredProjects: 'skillMonitoredProjects', // 独立的 Skill 项目列表
  skillSelectedProject: 'skillSelectedProject',     // 当前选中的项目
};

// ========== Native Host 通信（通过 background 中继）==========

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

// ========== 工具函数 ==========

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== Toast 提示 ==========

function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;

  const sep = message.indexOf('\n');
  if (sep > 0) {
    el.innerHTML = `<div class="toast-title">${escapeHtml(message.slice(0, sep))}</div>`
      + `<div class="toast-body">${escapeHtml(message.slice(sep + 1))}</div>`;
  } else {
    el.textContent = message;
  }

  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 200);
  }, duration);
}

// ========== 二次确认机制 ==========

const confirmTimers = new Map();

function needConfirm(btn) {
  if (btn.dataset.confirmed === 'true') {
    btn.dataset.confirmed = '';
    clearTimeout(confirmTimers.get(btn));
    confirmTimers.delete(btn);
    btn.textContent = btn.dataset.origText;
    btn.classList.remove('btn-confirm-pending');
    return false;
  }
  btn.dataset.origText = btn.textContent;
  btn.dataset.confirmed = 'true';
  btn.textContent = '确认?';
  btn.classList.add('btn-confirm-pending');
  const timer = setTimeout(() => {
    btn.dataset.confirmed = '';
    btn.textContent = btn.dataset.origText;
    btn.classList.remove('btn-confirm-pending');
    confirmTimers.delete(btn);
  }, 2500);
  confirmTimers.set(btn, timer);
  return true;
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', init);

function init() {
  setupDelegation();
  checkNativeHost();
  loadCommandList();
  loadGitDirList();
}

// ========== 全局事件委托 ==========

function setupDelegation() {
  document.addEventListener('click', (e) => {
    // Tab 切换
    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn && tabBtn.dataset.tab) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tabBtn.classList.add('active');
      const panel = document.getElementById('panel-' + tabBtn.dataset.tab);
      if (panel) panel.classList.add('active');
      if (tabBtn.dataset.tab === 'processes') loadProcesses();
      if (tabBtn.dataset.tab === 'git') loadGitStatus();
      if (tabBtn.dataset.tab === 'skills') { refreshProjectSelect(); loadSkills(); }
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const pid = parseInt(btn.dataset.pid, 10);

    switch (action) {
      // 命令管理
      case 'add-cmd': openCmdModal(); break;
      case 'execute-cmd': executeCmd(id); break;
      case 'edit-cmd': editCmd(id); break;
      case 'delete-cmd': if (needConfirm(btn)) return; deleteCmd(id); break;

      // 进程管理
      case 'refresh-processes': loadProcesses(); break;
      case 'stop-process': if (needConfirm(btn)) return; stopProcess(pid); break;
      case 'remove-process': removeProcess(pid); break;

      // Git
      case 'add-git-dir': openGitDirModal(); break;
      case 'git-refresh': gitRefreshDir(id); break;
      case 'git-pull': gitPullDir(id); break;
      case 'git-push': gitPushDir(id); break;
      case 'git-add-commit-pull': gitAddCommitPull(id); break;
      case 'git-delete': if (needConfirm(btn)) return; deleteGitDir(id); break;
      case 'git-batch-refresh': loadGitStatus(); break;
      case 'git-batch-pull': batchPull(); break;
      case 'git-batch-push': if (needConfirm(btn)) return; batchPush(); break;
      case 'git-batch-add-commit-pull': batchAddCommitPull(); break;

      // Skills
      case 'skill-save-central': saveSkillCentralPath(); break;
      case 'skill-add-project': openSkillProjectModal(); break;
      case 'skill-import-from-git': importProjectFromGit(); break;
      case 'skill-project-cancel': closeSkillProjectModal(); break;
      case 'skill-project-save': saveSkillProject(); break;
      case 'skill-refresh': loadSkills(); break;
      case 'skill-push': skillPushOne(btn.dataset.name); break;
      case 'skill-pull': skillPullOne(btn.dataset.name); break;
      case 'skill-delete-project': deleteSkillProject(btn.dataset.id); break;

      // 弹窗
      case 'cmd-cancel': closeCmdModal(); break;
      case 'cmd-save': saveCmd(); break;
      case 'gitdir-cancel': closeGitDirModal(); break;
      case 'gitdir-save': saveGitDir(); break;
    }
  });

  // 弹窗背景点击关闭
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
      }
    });
  });
}

// ========== 命令管理 ==========

let editingCmdId = null;

async function loadCommandList() {
  const templates = await loadStorage(STORAGE_KEYS.commandTemplates);
  const container = document.getElementById('cmdList');

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无命令模板</p>
        <button class="btn btn-primary" data-action="add-cmd">添加第一个命令</button>
      </div>`;
    return;
  }

  container.innerHTML = templates.map(t => `
    <div class="cmd-card">
      <div class="cmd-card-header">
        <span class="cmd-card-name">${escapeHtml(t.name)}</span>
        <div class="cmd-card-actions">
          <button class="btn btn-success" data-action="execute-cmd" data-id="${t.id}">启动</button>
          <button class="btn btn-edit" data-action="edit-cmd" data-id="${t.id}">编辑</button>
          <button class="btn btn-danger" data-action="delete-cmd" data-id="${t.id}">删除</button>
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
    toast('名称、工作目录和命令为必填项', 'warning');
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
    toast(`已启动: ${template.name} (PID: ${resp.data.pid})\n日志: ${resp.data.logFile || '无'}`, 'success');
  } catch (err) {
    toast(`启动失败: ${err.message}`, 'error');
  }
}

// ========== 子进程管理 ==========

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
            ${p.logFile ? `<br>日志: <a href="file://${p.logFile.replace(/\\/g, '/')}" target="_blank" style="color:var(--accent-deep);">${escapeHtml(p.logFile)}</a>` : ''}
          </div>
        </div>
        <span class="status-badge ${p.running ? 'running' : 'stopped'}">
          <span class="status-dot ${p.running ? 'running' : 'stopped'}"></span>
          ${p.running ? '运行中' : '已停止'}
        </span>
        <div style="display:flex; gap:8px;">
          ${p.running
            ? `<button class="btn btn-danger" data-action="stop-process" data-pid="${p.pid}">停止</button>`
            : `<button class="btn btn-secondary" data-action="remove-process" data-pid="${p.pid}">移除</button>`
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
  try {
    await sendNativeMessage({ command: 'stopProcess', pid });
    loadProcesses();
  } catch (err) {
    toast(`停止失败: ${err.message}`, 'error');
  }
}

async function removeProcess(pid) {
  try {
    await sendNativeMessage({ command: 'removeProcess', pid });
    loadProcesses();
  } catch (err) {
    toast(`移除失败: ${err.message}`, 'error');
  }
}

// ========== Git 监控 ==========

let gitStatusCache = [];

async function loadGitDirList() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const container = document.getElementById('gitList');

  if (dirs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无监控目录</p>
        <button class="btn btn-primary" data-action="add-git-dir">添加第一个目录</button>
      </div>`;
    return;
  }

  container.innerHTML = dirs.map(d => `
    <div class="git-card" id="git-card-${d.id}">
      <div class="git-card-header">
        <span class="git-card-dir">${escapeHtml(d.name)} <span style="color:var(--muted);font-weight:400;font-size:14px;">${escapeHtml(d.path)}</span></span>
        <div class="git-card-actions">
          <button class="btn btn-secondary" data-action="git-refresh" data-id="${d.id}">刷新</button>
          <button class="btn btn-warning" data-action="git-add-commit-pull" data-id="${d.id}">Refresh</button>
          <button class="btn btn-success" data-action="git-pull" data-id="${d.id}">Pull</button>
          <button class="btn btn-primary" data-action="git-push" data-id="${d.id}">Push</button>
          <button class="btn btn-danger" data-action="git-delete" data-id="${d.id}">移除</button>
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
    toast('名称和路径为必填项', 'warning');
    return;
  }

  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  dirs.push({ id: generateId(), name, path });
  await saveStorage(STORAGE_KEYS.gitMonitoredDirs, dirs);
  closeGitDirModal();
  loadGitDirList();
}

async function deleteGitDir(id) {
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
    toast('获取 Git 状态失败: ' + err.message, 'error');
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
    toast(result.success ? `Pull 成功\n${result.output}` : `Pull 失败\n${result.error}\n${result.output}`,
          result.success ? 'success' : 'error');
    gitRefreshDir(id);
  } catch (err) {
    toast('Pull 失败: ' + err.message, 'error');
  }
}

async function gitPushDir(id) {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const dir = dirs.find(d => d.id === id);
  if (!dir) return;

  try {
    const resp = await sendNativeMessage({ command: 'gitPush', path: dir.path });
    const result = resp.data;
    toast(result.success ? `Push 成功\n${result.output}` : `Push 失败\n${result.error}\n${result.output}`,
          result.success ? 'success' : 'error');
    gitRefreshDir(id);
  } catch (err) {
    toast('Push 失败: ' + err.message, 'error');
  }
}

async function gitAddCommitPull(id) {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const dir = dirs.find(d => d.id === id);
  if (!dir) return;

  try {
    const resp = await sendNativeMessage({
      command: 'gitAutoCommitAndPull',
      path: dir.path,
      message: 'extension pull',
    });
    const result = resp.data;
    toast(result.success
      ? `Add+Commit+Pull 成功\n${result.output}`
      : `失败\n${result.error || ''}\n${result.output}`,
          result.success ? 'success' : 'error');
    gitRefreshDir(id);
  } catch (err) {
    toast('操作失败: ' + err.message, 'error');
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
    const allOk = results.every(r => r.success);
    toast('批量 Pull 结果:\n' + summary, allOk ? 'success' : 'error', 5000);
    loadGitStatus();
  } catch (err) {
    toast('批量 Pull 失败: ' + err.message, 'error');
  }
}

async function batchPush() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  if (dirs.length === 0) return;

  try {
    const resp = await sendNativeMessage({
      command: 'gitBatchPush',
      dirs: dirs.map(d => d.path),
    });
    const results = resp.data || [];
    const summary = results.map(r =>
      `${r.dir}: ${r.success ? '成功' : '失败 - ' + r.error}`
    ).join('\n');
    const allOk = results.every(r => r.success);
    toast('批量 Push 结果:\n' + summary, allOk ? 'success' : 'error', 5000);
    loadGitStatus();
  } catch (err) {
    toast('批量 Push 失败: ' + err.message, 'error');
  }
}

async function batchAddCommitPull() {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  if (dirs.length === 0) return;

  const results = [];
  for (const dir of dirs) {
    try {
      const resp = await sendNativeMessage({
        command: 'gitAutoCommitAndPull',
        path: dir.path,
        message: 'extension pull',
      });
      results.push({
        name: dir.name,
        ...resp.data,
      });
    } catch (err) {
      results.push({
        name: dir.name,
        success: false,
        error: err.message,
      });
    }
  }

  const summary = results.map(r =>
    `${r.name}: ${r.success ? '成功' : '失败 - ' + (r.error || '')}`
  ).join('\n');
  const allOk = results.every(r => r.success);
  toast('Add+Commit+Pull 结果:\n' + summary, allOk ? 'success' : 'error', 6000);
  loadGitStatus();
}

// ========== Skills 管理 ==========

async function saveSkillCentralPath() {
  const input = document.getElementById('skillCentralPath');
  const path = input.value.trim();
  if (!path) { toast('请输入中心仓库路径', 'error'); return; }
  await saveStorage(STORAGE_KEYS.skillCentralPath, path);
  toast('中心仓库路径已保存');
  loadSkills();
}

function openSkillProjectModal() {
  document.getElementById('skillProjectModal').classList.add('show');
  document.getElementById('skillProjectName').value = '';
  document.getElementById('skillProjectPath').value = '';
  document.getElementById('skillProjectName').focus();
}

function closeSkillProjectModal() {
  document.getElementById('skillProjectModal').classList.remove('show');
}

async function saveSkillProject() {
  const name = document.getElementById('skillProjectName').value.trim();
  const path = document.getElementById('skillProjectPath').value.trim();
  if (!name || !path) { toast('请填写名称和路径', 'error'); return; }

  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  if (projects.some(p => p.path === path)) {
    toast('该目录已添加', 'warning'); return;
  }
  projects.push({ id: generateId(), name, path });
  await saveStorage(STORAGE_KEYS.skillMonitoredProjects, projects);
  closeSkillProjectModal();
  await refreshProjectSelect();
  loadSkills();
}

async function deleteSkillProject(id) {
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const idx = projects.findIndex(p => p.id === id);
  if (idx < 0) return;
  projects.splice(idx, 1);
  await saveStorage(STORAGE_KEYS.skillMonitoredProjects, projects);
  const selected = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  if (selected === id) await saveStorage(STORAGE_KEYS.skillSelectedProject, '');
  await refreshProjectSelect();
  loadSkills();
}

async function importProjectFromGit() {
  const gitDirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  if (gitDirs.length === 0) { toast('请先在 Git 监控中添加项目', 'warning'); return; }
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  let added = 0;
  for (const gitDir of gitDirs) {
    if (!projects.some(p => p.path === gitDir.path)) {
      projects.push({ id: generateId(), name: gitDir.name, path: gitDir.path });
      added++;
    }
  }
  if (added > 0) {
    await saveStorage(STORAGE_KEYS.skillMonitoredProjects, projects);
    toast(`已从 Git 导入 ${added} 个项目`);
    await refreshProjectSelect();
    loadSkills();
  } else {
    toast('所有 Git 项目已导入');
  }
}

async function refreshProjectSelect() {
  const select = document.getElementById('skillProjectSelect');
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = await loadStorage(STORAGE_KEYS.skillSelectedProject);

  select.innerHTML = '<option value="">-- 选择项目 --</option>' +
    projects.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');

  select.onchange = async () => {
    await saveStorage(STORAGE_KEYS.skillSelectedProject, select.value);
    loadSkills();
  };
}

async function loadSkills() {
  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  const centralInput = document.getElementById('skillCentralPath');
  if (centralInput) centralInput.value = centralPath || '';

  // 加载中心仓库 Skills
  const centralList = document.getElementById('centralSkillList');
  const centralCount = document.getElementById('centralCount');
  centralList.innerHTML = '<div class="skill-loading"><div class="spinner"></div></div>';

  let centralSkills = [];
  if (centralPath) {
    try {
      const resp = await sendNativeMessage({ command: 'scanSkills', path: centralPath });
      centralSkills = resp.data || [];
    } catch (e) {}
  }
  renderCentralSkillList(centralSkills);
  if (centralCount) centralCount.textContent = `${centralSkills.length} 个 Skill`;

  // 加载选中项目的 Skills
  const projectList = document.getElementById('projectSkillList');
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  if (!selectedId || !selected) {
    projectList.innerHTML = '<div class="skill-empty"><p>从下拉选择项目以查看其 Skills</p></div>';
    return;
  }

  projectList.innerHTML = '<div class="skill-loading"><div class="spinner"></div></div>';
  let projectSkills = [];
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: selected.path });
    projectSkills = resp.data || [];
  } catch (e) {}
  renderProjectSkillList(projectSkills, selected, centralSkills);
}

function renderCentralSkillList(skills) {
  const container = document.getElementById('centralSkillList');
  if (!skills || skills.length === 0) {
    container.innerHTML = '<div class="skill-empty"><p>中心仓库暂无 Skill</p></div>';
    return;
  }
  container.innerHTML = skills.map(s => `
    <div class="skill-card">
      <div class="skill-card-header">
        <span class="skill-card-title">${escapeHtml(s.name)}</span>
      </div>
      <div class="skill-card-desc">${escapeHtml(s.description || '(无描述)')}</div>
      <div class="skill-card-path">${escapeHtml(s.skillDir)}</div>
      <div class="skill-card-actions">
        <button class="btn btn-warning" data-action="skill-pull" data-name="${escapeHtml(s.name)}">拉取到项目 →</button>
      </div>
    </div>
  `).join('');
}

function renderProjectSkillList(skills, project, centralSkills) {
  const container = document.getElementById('projectSkillList');
  if (!skills || skills.length === 0) {
    container.innerHTML = `<div class="skill-empty"><p>项目「${escapeHtml(project.name)}」暂无 Skill</p></div>`;
    return;
  }

  container.innerHTML = skills.map(s => {
    const central = centralSkills.find(c => c.name === s.name);
    const synced = central && central.skillMd5 === s.skillMd5;
    const status = central
      ? (synced ? '<span class="source-tag synced">已同步 ✓</span>' : '<span class="source-tag conflict">内容不同</span>')
      : '<span class="source-tag local">本地</span>';

    return `
      <div class="skill-card">
        <div class="skill-card-header">
          <span class="skill-card-title">${escapeHtml(s.name)}</span>
          <div class="skill-card-tags">${status}</div>
        </div>
        <div class="skill-card-desc">${escapeHtml(s.description || '(无描述)')}</div>
        <div class="skill-card-path">${escapeHtml(s.skillDir)}</div>
        <div class="skill-card-actions">
          ${central ? `<button class="btn btn-success" data-action="skill-push" data-name="${escapeHtml(s.name)}">← 推送至中心</button>` : ''}
          <button class="btn btn-secondary" data-action="skill-delete-project" data-id="${project.id}">移除项目</button>
        </div>
      </div>
    `;
  }).join('');
}

async function skillPushOne(skillName) {
  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  if (!centralPath) { toast('请先配置中心仓库路径', 'error'); return; }
  if (!selected) { toast('请先选择项目', 'error'); return; }

  // 从项目的 .claude/skills 中找 skill
  let srcPath = null;
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: selected.path });
    const found = (resp.data || []).find(s => s.name === skillName);
    if (found) srcPath = found.skillDir;
  } catch (e) {}

  if (!srcPath) { toast('未找到 Skill: ' + skillName, 'error'); return; }

  // 推送到 {centralPath}/skills/
  try {
    const resp = await sendNativeMessage({
      command: 'syncSkillDir',
      src: srcPath,
      dstParent: centralPath + '/skills',
    });
    const result = resp.data;
    if (result.conflicts && result.conflicts.length > 0) {
      toast(`冲突：${result.conflicts[0].original} → ${result.conflicts[0].renamedTo}`);
    } else if (result.copied && result.copied.length > 0) {
      toast(`已推送: ${result.copied.join(', ')}`);
    } else {
      toast('已同步（内容相同）');
    }
    loadSkills();
  } catch (err) {
    toast('推送失败: ' + err.message, 'error');
  }
}

async function skillPullOne(skillName) {
  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  if (!centralPath) { toast('请先配置中心仓库路径', 'error'); return; }
  if (!selected) { toast('请先选择项目', 'error'); return; }

  // 从中心仓库获取 skill 路径
  let srcPath = null;
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: centralPath });
    const found = (resp.data || []).find(s => s.name === skillName);
    if (found) srcPath = found.skillDir;
  } catch (e) {}

  if (!srcPath) { toast('中心仓库中未找到: ' + skillName, 'error'); return; }

  // 拉取到项目的 .claude/skills/
  try {
    const resp = await sendNativeMessage({
      command: 'syncSkillDir',
      src: srcPath,
      dstParent: selected.path + '/.claude/skills',
    });
    const result = resp.data;
    if (result.conflicts && result.conflicts.length > 0) {
      toast(`冲突：${result.conflicts[0].original} → ${result.conflicts[0].renamedTo}`);
    } else if (result.copied && result.copied.length > 0) {
      toast(`已拉取: ${result.copied.join(', ')} 到「${selected.name}」`);
    } else {
      toast('已同步（内容相同）');
    }
    loadSkills();
  } catch (err) {
    toast('拉取失败: ' + err.message, 'error');
  }
}

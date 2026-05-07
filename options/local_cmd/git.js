/**
 * Git 监控
 */

let gitStatusCache = [];
let gitAutoRefreshTimer = null;
let lastRefreshTime = null;

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
          <button class="btn btn-secondary" data-action="git-refresh" data-id="${d.id}">刷新状态</button>
          <button class="btn btn-warning" data-action="git-add-commit-pull" data-id="${d.id}">推送云端</button>
          <button class="btn btn-success" data-action="git-pull" data-id="${d.id}">Pull</button>
          <button class="btn btn-primary" data-action="git-push" data-id="${d.id}">Push</button>
          <button class="btn btn-danger" data-action="git-delete" data-id="${d.id}">移除</button>
        </div>
      </div>
      <div class="git-status-area" id="git-status-${d.id}">
        <span style="color:var(--muted);font-size:14px;">加载中...</span>
      </div>
    </div>
  `).join('');

  // 自动刷新状态
  loadGitStatus();
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
    lastRefreshTime = Date.now();
    renderGitStatus(dirs, gitStatusCache);
    updateRefreshTimeDisplay();
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

async function gitAddCommitPush(id) {
  const dirs = await loadStorage(STORAGE_KEYS.gitMonitoredDirs);
  const dir = dirs.find(d => d.id === id);
  if (!dir) return;

  try {
    const resp = await sendNativeMessage({
      command: 'gitAutoCommitAndPush',
      path: dir.path,
      message: 'extension push',
    });
    const result = resp.data;
    toast(result.success
      ? `推送云端成功\n${result.output}`
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

// ========== Git 自动刷新 ==========

function startGitAutoRefresh() {
  if (gitAutoRefreshTimer) clearInterval(gitAutoRefreshTimer);
  gitAutoRefreshTimer = setInterval(() => {
    const gitPanel = document.getElementById('panel-git');
    if (gitPanel && gitPanel.classList.contains('active')) {
      loadGitStatus();
    }
  }, 60000);
}

function getLastRefreshTimeStr() {
  if (!lastRefreshTime) return '';
  const d = new Date(lastRefreshTime);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateRefreshTimeDisplay() {
  const el = document.getElementById('gitRefreshTime');
  if (el) el.textContent = lastRefreshTime ? `上次刷新: ${getLastRefreshTimeStr()}` : '';
}

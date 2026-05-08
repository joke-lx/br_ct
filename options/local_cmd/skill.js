/**
 * Skill 管理 - 中心仓库 + 项目同步
 */

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

async function deleteSkillFromProject(skillName, projectId) {
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  try {
    const resp = await sendNativeMessage({
      command: 'deleteSkill',
      path: project.path,
      name: skillName,
    });
    if (resp.data && resp.data.success) {
      toast(`已移除 Skill: ${skillName}`);
      loadSkills();
    } else {
      toast(`移除失败: ${resp.data?.error || '未知错误'}`, 'error');
    }
  } catch (err) {
    toast('移除失败: ' + err.message, 'error');
  }
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
  if (centralCount) centralCount.textContent = `${centralSkills.length} 个 Skill`;

  const projectList = document.getElementById('projectSkillList');
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  let projectSkills = [];
  if (!selectedId || !selected) {
    projectList.innerHTML = '<div class="skill-empty"><p>从下拉选择项目以查看其 Skills</p></div>';
  } else {
    projectList.innerHTML = '<div class="skill-loading"><div class="spinner"></div></div>';
    try {
      const resp = await sendNativeMessage({ command: 'scanSkills', path: selected.path });
      projectSkills = resp.data || [];
    } catch (e) {}
    renderProjectSkillList(projectSkills, selected, centralSkills);
  }

  renderCentralSkillList(centralSkills, projectSkills);
}

function renderCentralSkillList(skills, projectSkills) {
  const container = document.getElementById('centralSkillList');
  if (!skills || skills.length === 0) {
    container.innerHTML = '<div class="skill-empty"><p>中心仓库暂无 Skill</p></div>';
    return;
  }

  container.innerHTML = skills.map(s => {
    const projectSkill = projectSkills ? projectSkills.find(p => p.name === s.name) : null;
    const synced = projectSkill && projectSkill.skillMd5 === s.skillMd5;
    const status = projectSkill
      ? (synced ? '<span class="source-tag synced">已同步 ✓</span>' : '<span class="source-tag conflict">冲突</span>')
      : '<span class="source-tag central">仅中心</span>';

    return `
      <div class="skill-card">
        <div class="skill-card-header">
          <span class="skill-card-title">${escapeHtml(s.name)}</span>
          <div class="skill-card-tags">${status}</div>
        </div>
        <div class="skill-card-desc">${escapeHtml(s.description || '(无描述)')}</div>
        <div class="skill-card-path">${escapeHtml(s.skillDir)}</div>
        <div class="skill-card-actions">
          ${!projectSkill ? `<button class="btn btn-success btn-pull" data-action="skill-push-central-to-project" data-name="${escapeHtml(s.name)}">→ 推送到项目</button>` : ''}
          ${projectSkill && !synced ? `<button class="btn btn-warning" data-action="skill-push-central-to-project" data-name="${escapeHtml(s.name)}">↻ 同步到项目</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
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
      ? (synced ? '<span class="source-tag synced">已同步 ✓</span>' : '<span class="source-tag conflict">冲突</span>')
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
          ${central && !synced ? `<button class="btn btn-warning" data-action="skill-push" data-name="${escapeHtml(s.name)}">↻ 同步到中心</button>` : ''}
          ${!synced && !central ? `<button class="btn btn-success btn-pull" data-action="skill-push" data-name="${escapeHtml(s.name)}">← 推送到中心</button>` : ''}
          <button class="btn btn-secondary" data-action="skill-delete-skill" data-name="${escapeHtml(s.name)}" data-project-id="${project.id}">移除 Skill</button>
        </div>
      </div>
    `;
  }).join('');
}

// 项目 → 中心仓库
async function skillPushToCentral(skillName) {
  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  if (!centralPath) { toast('请先配置中心仓库路径', 'error'); return; }
  if (!selected) { toast('请先选择项目', 'error'); return; }

  let srcPath = null;
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: selected.path });
    const found = (resp.data || []).find(s => s.name === skillName);
    if (found) srcPath = found.skillDir;
  } catch (e) {}

  if (!srcPath) { toast('未找到 Skill: ' + skillName, 'error'); return; }

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

// 中心仓库 → 项目
async function skillPullFromCentral(skillName) {
  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  if (!centralPath) { toast('请先配置中心仓库路径', 'error'); return; }
  if (!selected) { toast('请先选择项目', 'error'); return; }

  let srcPath = null;
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: centralPath });
    const found = (resp.data || []).find(s => s.name === skillName);
    if (found) srcPath = found.skillDir;
  } catch (e) {}

  if (!srcPath) { toast('中心仓库中未找到: ' + skillName, 'error'); return; }

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

// 中心仓库 → 项目（通过中心面板按钮）
async function skillPushToProject(skillName) {
  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  const selectedId = await loadStorage(STORAGE_KEYS.skillSelectedProject);
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = projects.find(p => p.id === selectedId);

  if (!centralPath) { toast('请先配置中心仓库路径', 'error'); return; }
  if (!selected) { toast('请先选择项目', 'error'); return; }

  let srcPath = null;
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: centralPath });
    const found = (resp.data || []).find(s => s.name === skillName);
    if (found) srcPath = found.skillDir;
  } catch (e) {}

  if (!srcPath) { toast('中心仓库中未找到: ' + skillName, 'error'); return; }

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
      toast(`已推送到「${selected.name}」: ${result.copied.join(', ')}`);
    } else {
      toast('已同步（内容相同）');
    }
    loadSkills();
  } catch (err) {
    toast('推送失败: ' + err.message, 'error');
  }
}

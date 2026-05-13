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

async function removeSkillProject() {
  const select = document.getElementById('skillProjectSelect');
  const selectedId = select.value;
  if (!selectedId) return;
  await deleteSkillProject(selectedId);
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
  const removeBtn = document.getElementById('skillProjectRemoveBtn');
  const projects = await loadStorage(STORAGE_KEYS.skillMonitoredProjects);
  const selected = await loadStorage(STORAGE_KEYS.skillSelectedProject);

  select.innerHTML = '<option value="">-- 选择项目 --</option>' +
    projects.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');

  // 更新移除按钮显示状态
  updateRemoveBtnVisibility();

  select.onchange = async () => {
    await saveStorage(STORAGE_KEYS.skillSelectedProject, select.value);
    updateRemoveBtnVisibility();
    loadSkills();
  };
}

function updateRemoveBtnVisibility() {
  const select = document.getElementById('skillProjectSelect');
  const removeBtn = document.getElementById('skillProjectRemoveBtn');
  if (select && removeBtn) {
    removeBtn.style.display = select.value ? 'flex' : 'none';
  }
}

// 当前选中的 skill 列表（用于批量操作）
let selectedSkills = new Set();
let currentGroups = [];
let currentCentralSkills = [];

function toggleSkillSelection(skillName) {
  if (selectedSkills.has(skillName)) {
    selectedSkills.delete(skillName);
  } else {
    selectedSkills.add(skillName);
  }
  updateBatchBar();
  updateSkillCardSelection();
}

function updateBatchBar() {
  const batchBar = document.getElementById('batchActionBar');
  const batchCount = document.getElementById('batchSelectedCount');
  const targetGroupSelect = document.getElementById('targetGroupSelect');

  if (selectedSkills.size > 0) {
    batchBar.style.display = 'flex';
    batchCount.textContent = `已选择 ${selectedSkills.size} 个 Skill`;
    // 更新目标分组下拉（排除 'all' 筛选选项）
    if (targetGroupSelect) {
      targetGroupSelect.innerHTML = currentGroups.filter(g => g.id !== 'all').map(g =>
        `<option value="${g.id}">${escapeHtml(g.name)}</option>`
      ).join('');
    }
  } else {
    batchBar.style.display = 'none';
  }
}

function updateSkillCardSelection() {
  document.querySelectorAll('.skill-card').forEach(card => {
    const name = card.dataset.skillName;
    const checkbox = card.querySelector('.skill-checkbox');
    if (checkbox) {
      checkbox.checked = selectedSkills.has(name);
    }
  });
}

function cancelSelection() {
  selectedSkills.clear();
  updateBatchBar();
  updateSkillCardSelection();
}

async function batchMoveSkills() {
  const targetGroupId = document.getElementById('targetGroupSelect')?.value;
  if (!targetGroupId || selectedSkills.size === 0) return;

  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  if (!centralPath) { toast('中心仓库路径未设置', 'error'); return; }

  // 读取当前 setting.json 配置
  let resp;
  try {
    resp = await sendNativeMessage({ command: 'readSetting', path: centralPath });
    if (!resp.data) throw new Error('配置为空');
    const cfg = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    // 构建新的分组配置（深拷贝，只包含真实分组，排除 'all' 筛选选项）
    const groups = cfg.groups ? JSON.parse(JSON.stringify(cfg.groups)) : [];

    // 确保 ungrouped 存在
    if (!groups.find(g => g.id === 'ungrouped')) {
      groups.unshift({ id: 'ungrouped', name: '未分组' });
    }

    // 从所有分组中移除选中的 skills
    for (const g of groups) {
      g.skills = (g.skills || []).filter(s => !selectedSkills.has(s));
    }

    // 将选中的 skills 添加到目标分组
    const targetGroup = groups.find(g => g.id === targetGroupId);
    if (targetGroup) {
      if (!targetGroup.skills) targetGroup.skills = [];
      for (const skillName of selectedSkills) {
        if (!targetGroup.skills.includes(skillName)) {
          targetGroup.skills.push(skillName);
        }
      }
    }

    // 保存
    await sendNativeMessage({ command: 'saveSkillGroups', path: centralPath, groups });
    toast(`已移动 ${selectedSkills.size} 个 Skill`);
    selectedSkills.clear();
    updateBatchBar();
    loadSkills();
  } catch (e) {
    toast('移动失败: ' + e.message, 'error');
  }
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
  currentCentralSkills = centralSkills;

  // 提取分组信息（从 setting.json 读取）
  currentGroups = [{ id: 'all', name: '全部' }, { id: 'ungrouped', name: '未分组' }];
  try {
    const resp = await sendNativeMessage({ command: 'readSetting', path: centralPath });
    if (resp.data) {
      const cfg = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      if (cfg.groups) {
        currentGroups = [{ id: 'all', name: '全部' }, ...cfg.groups.filter(g => g.id !== 'ungrouped'), { id: 'ungrouped', name: '未分组' }];
      }
    }
  } catch (e) {}

  // 更新分组筛选下拉
  const groupFilter = document.getElementById('groupFilter');
  if (groupFilter) {
    groupFilter.innerHTML = currentGroups.map(g =>
      `<option value="${g.id}">${escapeHtml(g.name)}</option>`
    ).join('');
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

  // 根据筛选器过滤
  const filterGroupId = groupFilter?.value || 'all';
  const filteredSkills = filterGroupId === 'all'
    ? centralSkills
    : centralSkills.filter(s => s.groupId === filterGroupId);

  renderCentralSkillList(filteredSkills, projectSkills);
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

    // 获取分组名称
    const group = currentGroups.find(g => g.id === s.groupId);
    const groupName = group ? group.name : '未分组';
    const groupTag = `<span class="source-tag group-tag">${escapeHtml(groupName)}</span>`;

    return `
      <div class="skill-card" data-skill-name="${escapeHtml(s.name)}">
        <div class="skill-card-header">
          <input type="checkbox" class="skill-checkbox" onclick="event.stopPropagation(); toggleSkillSelection('${escapeHtml(s.name)}')" ${selectedSkills.has(s.name) ? 'checked' : ''}>
          <span class="skill-card-title">${escapeHtml(s.name)}</span>
          <div class="skill-card-tags">${status}${groupTag}</div>
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

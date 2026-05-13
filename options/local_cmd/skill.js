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

function openSkillGroupModal() {
  document.getElementById('skillGroupModal').classList.add('show');
  document.getElementById('skillGroupName').value = '';
  document.getElementById('skillGroupName').focus();
}

function closeSkillGroupModal() {
  document.getElementById('skillGroupModal').classList.remove('show');
}

async function createSkillGroup() {
  const name = document.getElementById('skillGroupName').value.trim();
  if (!name) { toast('请输入分组名称', 'error'); return; }

  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  if (!centralPath) { toast('中心仓库路径未设置', 'error'); return; }

  try {
    const resp = await sendNativeMessage({ command: 'readSetting', path: centralPath });
    const cfg = resp.data ? (typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data) : { groups: [] };
    const groups = cfg.groups || [];

    const newGroup = {
      id: Date.now().toString(36),
      name,
      skills: []
    };

    groups.push(newGroup);

    await sendNativeMessage({ command: 'saveSkillGroups', path: centralPath, groups });
    closeSkillGroupModal();
    toast(`已创建分组：${name}`);
    loadSkills();
  } catch (e) {
    toast('创建分组失败: ' + e.message, 'error');
  }
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
let manageTargetGroupId = null;

function toggleSkillSelection(skillName) {
  if (selectedSkills.has(skillName)) {
    selectedSkills.delete(skillName);
  } else {
    selectedSkills.add(skillName);
  }
  updateManageSelectedCount();
  updateManageSkillCheckboxes();
}

function updateManageSelectedCount() {
  document.getElementById('manageSelectedCount').textContent = `已选 ${selectedSkills.size} 个`;
}

function updateManageSkillCheckboxes() {
  const list = document.getElementById('manageSkillList');
  if (list) {
    list.querySelectorAll('.manage-skill-checkbox').forEach(cb => {
      cb.checked = selectedSkills.has(cb.dataset.name);
    });
  }
}

async function openSkillGroupManageModal() {
  document.getElementById('skillGroupManageModal').classList.add('show');
  selectedSkills.clear();
  manageTargetGroupId = null;

  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  if (!centralPath) { toast('中心仓库路径未设置', 'error'); return; }

  let skills = [];
  try {
    const resp = await sendNativeMessage({ command: 'scanSkills', path: centralPath });
    skills = resp.data || [];
  } catch (e) { toast('加载失败', 'error'); return; }

  // 加载分组配置
  let groups = [];
  try {
    const resp = await sendNativeMessage({ command: 'readSetting', path: centralPath });
    if (resp.data) {
      const cfg = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      groups = cfg.groups || [];
    }
  } catch (e) {}

  // 渲染分组列表
  const groupList = document.getElementById('manageGroupList');
  groupList.innerHTML = groups.map(g => `
    <div class="manage-group-item"
         data-action="skill-select-group"
         data-group-id="${g.id}"
         style="padding: 10px 8px; cursor: pointer; border-radius: 6px; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
      <span>${escapeHtml(g.name)}</span>
      <span class="muted" style="font-size: 12px;">${g.skills?.length || 0}</span>
    </div>
  `).join('');

  // 渲染 skill 列表
  const skillList = document.getElementById('manageSkillList');
  skillList.innerHTML = skills.map(s => {
    const groupName = s.groupId === 'ungrouped' ? '未分组' : (groups.find(g => g.id === s.groupId)?.name || s.groupId);
    return `
      <label class="manage-skill-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; cursor: pointer; border-bottom: 1px solid var(--line);">
        <input type="checkbox" class="manage-skill-checkbox" data-name="${escapeHtml(s.name)}">
        <span style="flex: 1;">${escapeHtml(s.name)}</span>
        <span class="source-tag" style="font-size: 11px;">${escapeHtml(groupName)}</span>
      </label>
    `;
  }).join('');

  // 全选
  document.getElementById('manageSelectAll').onchange = function() {
    const checked = this.checked;
    skillList.querySelectorAll('.manage-skill-checkbox').forEach(cb => cb.checked = checked);
    if (checked) {
      skills.forEach(s => selectedSkills.add(s.name));
    } else {
      selectedSkills.clear();
    }
    updateManageSelectedCount();
  };

  updateManageSelectedCount();
}

function selectManageTargetGroup(groupId) {
  manageTargetGroupId = groupId;
  document.querySelectorAll('.manage-group-item').forEach(item => {
    if (item.dataset.groupId === groupId) {
      item.style.background = 'rgba(107,74,49,0.15)';
      item.style.border = '1px solid rgba(107,74,49,0.3)';
    } else {
      item.style.background = 'transparent';
      item.style.border = '1px solid transparent';
    }
  });
}

// 委托处理 manage modal 的 checkbox 变化
document.getElementById('manageSkillList')?.addEventListener('change', (e) => {
  if (e.target.classList.contains('manage-skill-checkbox')) {
    const name = e.target.dataset.name;
    if (e.target.checked) {
      selectedSkills.add(name);
    } else {
      selectedSkills.delete(name);
    }
    updateManageSelectedCount();
  }
});

function closeSkillGroupManageModal() {
  document.getElementById('skillGroupManageModal').classList.remove('show');
}

async function batchMoveSkillsFromModal() {
  if (selectedSkills.size === 0) { toast('请先选择 Skill', 'warning'); return; }
  if (!manageTargetGroupId) { toast('请先选择目标分组', 'warning'); return; }

  const centralPath = await loadStorage(STORAGE_KEYS.skillCentralPath);
  if (!centralPath) { toast('中心仓库路径未设置', 'error'); return; }

  try {
    const resp = await sendNativeMessage({ command: 'readSetting', path: centralPath });
    if (!resp.data) throw new Error('配置为空');
    const cfg = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    const groups = cfg.groups ? JSON.parse(JSON.stringify(cfg.groups)) : [];

    if (!groups.find(g => g.id === 'ungrouped')) {
      groups.unshift({ id: 'ungrouped', name: '未分组' });
    }

    // 从所有分组中移除选中的 skills
    for (const g of groups) {
      g.skills = (g.skills || []).filter(s => !selectedSkills.has(s));
    }

    // 将选中的 skills 添加到目标分组
    const targetGroup = groups.find(g => g.id === manageTargetGroupId);
    if (targetGroup) {
      if (!targetGroup.skills) targetGroup.skills = [];
      for (const skillName of selectedSkills) {
        if (!targetGroup.skills.includes(skillName)) {
          targetGroup.skills.push(skillName);
        }
      }
    }

    await sendNativeMessage({ command: 'saveSkillGroups', path: centralPath, groups });
    toast(`已移动 ${selectedSkills.size} 个 Skill`);
    selectedSkills.clear();
    closeSkillGroupManageModal();
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
    const prevValue = groupFilter.value; // 保存当前选中值
    groupFilter.innerHTML = currentGroups.map(g =>
      `<option value="${g.id}">${escapeHtml(g.name)}</option>`
    ).join('');
    // 恢复选中值（如果还存在）
    if (prevValue && [...groupFilter.options].some(o => o.value === prevValue)) {
      groupFilter.value = prevValue;
    }
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

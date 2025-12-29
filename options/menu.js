/**
 * 菜单配置页面 - 支持可视化 CRUD 操作
 */

const CUSTOM_MENU_CONFIG_KEY = 'customMenuConfig';

// 默认菜单配置
const defaultMenuData = {
  name: '菜单',
  isRoot: true,
  children: [
    {
      name: '📄 feed',
      children: [
        { name: 'IT老齐', url: 'https://www.itlaoqi.com/chapter.html?sid=143&cid=3292', children: [] },
        { name: 'NOTION', url: 'https://www.notion.so/a23ee5b49d7d474ebf9d3e3094441088', children: [] },
        { name: 'B站', url: 'https://www.bilibili.com', children: [] },
        { name: 'github', url: 'https://github.com/', children: [] },
        { name: 'gitee', url: 'https://gitee.com/', children: [] },
      ]
    },
    {
      name: '📄 面包',
      children: [
        { name: '上海演唱会', url: 'https://www.bilibili.com/video/BV1L48qzsESK', children: [] },
        { name: '宁波演唱会', url: 'https://www.bilibili.com/video/BV1pca3zPECZ', children: [] },
        { name: '北京演唱会', url: 'https://www.bilibili.com/video/BV13hSzYfEfD', children: [] },
      ]
    }
  ]
};

// 当前编辑的菜单数据
let currentMenuData = null;
let editingGroupIndex = null;
let editingItemIndex = null;
let currentGroupIndex = null;

// DOM 元素
let menuConfigContent;
let statusMessage;
let jsonEditor;
let jsonStatus;

/**
 * 初始化菜单配置页面
 */
function initializeMenuConfig() {
  menuConfigContent = document.getElementById('menu-config-content');
  statusMessage = document.getElementById('menu-status-message');
  jsonEditor = document.getElementById('json-editor');
  jsonStatus = document.getElementById('json-status');

  // 加载菜单配置
  loadMenuConfig();

  // 可视化编辑器按钮
  document.getElementById('add-group-btn').addEventListener('click', () => openGroupModal());
  document.getElementById('save-menu-btn').addEventListener('click', saveMenuConfig);
  document.getElementById('switch-to-json').addEventListener('click', switchToJsonEditor);

  // JSON 编辑器按钮
  document.getElementById('load-json-btn').addEventListener('click', loadJsonEditor);
  document.getElementById('save-json-btn').addEventListener('click', saveJsonConfig);
  document.getElementById('format-json-btn').addEventListener('click', formatJson);
  document.getElementById('switch-to-visual').addEventListener('click', switchToVisualEditor);

  // 模态框保存按钮
  document.getElementById('save-group-btn').addEventListener('click', saveGroup);
  document.getElementById('save-item-btn').addEventListener('click', saveItem);
}

/**
 * 加载菜单配置
 */
function loadMenuConfig() {
  chrome.storage.local.get([CUSTOM_MENU_CONFIG_KEY], (result) => {
    currentMenuData = result[CUSTOM_MENU_CONFIG_KEY] || JSON.parse(JSON.stringify(defaultMenuData));
    renderMenuConfig();
  });
}

/**
 * 渲染菜单配置（可视化编辑模式）
 */
function renderMenuConfig() {
  if (!currentMenuData || !currentMenuData.children || currentMenuData.children.length === 0) {
    showEmptyState();
    return;
  }

  menuConfigContent.innerHTML = currentMenuData.children.map((group, groupIndex) => `
    <div class="menu-group">
      <div class="menu-group-header">
        <span class="menu-group-title">${escapeHtml(group.name)}</span>
        <div class="menu-group-actions">
          <button class="btn-add-item" onclick="openItemModal(${groupIndex})">➕ 添加项</button>
          <button class="btn-icon btn-edit" onclick="openGroupModal(${groupIndex})" title="编辑分组">✏️</button>
          <button class="btn-icon btn-delete" onclick="deleteGroup(${groupIndex})" title="删除分组">🗑️</button>
        </div>
      </div>
      ${group.children && group.children.length > 0 ? `
        <div>
          ${group.children.map((item, itemIndex) => `
            <div class="menu-item">
              <div class="menu-item-info">
                <div class="menu-item-name">${escapeHtml(item.name)}</div>
                ${item.url ? `<div class="menu-item-url">${escapeHtml(item.url)}</div>` : ''}
              </div>
              <div class="menu-item-actions">
                <button class="btn-icon btn-edit" onclick="openItemModal(${groupIndex}, ${itemIndex})" title="编辑">✏️</button>
                <button class="btn-icon btn-delete" onclick="deleteItem(${groupIndex}, ${itemIndex})" title="删除">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<div style="padding: 20px; text-align: center; color: #999;">暂无菜单项</div>'}
    </div>
  `).join('');
}

/**
 * 显示空状态
 */
function showEmptyState() {
  menuConfigContent.innerHTML = `
    <div class="menu-empty-state">
      <div class="menu-empty-state-icon">📋</div>
      <div class="menu-empty-state-text">菜单配置为空</div>
      <div class="menu-empty-state-hint">点击"添加分组"开始创建菜单</div>
    </div>
  `;
}

// ==================== 分组操作 ====================

/**
 * 打开分组编辑模态框
 */
function openGroupModal(groupIndex = null) {
  editingGroupIndex = groupIndex;
  const modal = document.getElementById('group-modal');
  const title = document.getElementById('group-modal-title');
  const nameInput = document.getElementById('group-name');

  if (groupIndex !== null) {
    title.textContent = '编辑分组';
    nameInput.value = currentMenuData.children[groupIndex].name;
  } else {
    title.textContent = '添加分组';
    nameInput.value = '';
  }

  modal.classList.add('show');
  nameInput.focus();
}

/**
 * 保存分组
 */
function saveGroup() {
  const nameInput = document.getElementById('group-name');
  const name = nameInput.value.trim();

  if (!name) {
    alert('请输入分组名称');
    return;
  }

  if (editingGroupIndex !== null) {
    // 编辑现有分组
    currentMenuData.children[editingGroupIndex].name = name;
  } else {
    // 添加新分组
    currentMenuData.children.push({
      name: name,
      children: []
    });
  }

  closeModal('group-modal');
  renderMenuConfig();
  showStatusMessage('分组已保存', 'success');
}

/**
 * 删除分组
 */
function deleteGroup(groupIndex) {
  const group = currentMenuData.children[groupIndex];
  if (confirm(`确定要删除分组"${group.name}"及其所有菜单项吗？`)) {
    currentMenuData.children.splice(groupIndex, 1);
    renderMenuConfig();
    showStatusMessage('分组已删除', 'success');
  }
}

// ==================== 菜单项操作 ====================

/**
 * 打开菜单项编辑模态框
 */
function openItemModal(groupIndex, itemIndex = null) {
  currentGroupIndex = groupIndex;
  editingItemIndex = itemIndex;
  const modal = document.getElementById('item-modal');
  const title = document.getElementById('item-modal-title');
  const nameInput = document.getElementById('item-name');
  const urlInput = document.getElementById('item-url');

  if (itemIndex !== null) {
    title.textContent = '编辑菜单项';
    const item = currentMenuData.children[groupIndex].children[itemIndex];
    nameInput.value = item.name;
    urlInput.value = item.url || '';
  } else {
    title.textContent = '添加菜单项';
    nameInput.value = '';
    urlInput.value = '';
  }

  modal.classList.add('show');
  nameInput.focus();
}

/**
 * 保存菜单项
 */
function saveItem() {
  const nameInput = document.getElementById('item-name');
  const urlInput = document.getElementById('item-url');
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name) {
    alert('请输入菜单项名称');
    return;
  }

  if (!url) {
    alert('请输入链接地址');
    return;
  }

  // 验证 URL 格式
  try {
    new URL(url);
  } catch (e) {
    alert('请输入有效的链接地址（如：https://example.com）');
    return;
  }

  const group = currentMenuData.children[currentGroupIndex];

  if (editingItemIndex !== null) {
    // 编辑现有菜单项
    group.children[editingItemIndex].name = name;
    group.children[editingItemIndex].url = url;
  } else {
    // 添加新菜单项
    group.children.push({
      name: name,
      url: url,
      children: []
    });
  }

  closeModal('item-modal');
  renderMenuConfig();
  showStatusMessage('菜单项已保存', 'success');
}

/**
 * 删除菜单项
 */
function deleteItem(groupIndex, itemIndex) {
  const item = currentMenuData.children[groupIndex].children[itemIndex];
  if (confirm(`确定要删除菜单项"${item.name}"吗？`)) {
    currentMenuData.children[groupIndex].children.splice(itemIndex, 1);
    renderMenuConfig();
    showStatusMessage('菜单项已删除', 'success');
  }
}

// ==================== 保存配置 ====================

/**
 * 保存菜单配置到 storage
 */
function saveMenuConfig() {
  if (!validateMenuData(currentMenuData)) {
    alert('菜单配置结构无效，请检查后重试');
    return;
  }

  chrome.storage.local.set({ [CUSTOM_MENU_CONFIG_KEY]: currentMenuData }, () => {
    showStatusMessage('菜单配置已保存', 'success');
  });
}

/**
 * 验证菜单数据结构
 */
function validateMenuData(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.name !== 'string') return false;
  if (typeof data.isRoot !== 'boolean') return false;
  if (!Array.isArray(data.children)) return false;

  for (const child of data.children) {
    if (!child || typeof child !== 'object') return false;
    if (typeof child.name !== 'string') return false;
    if (!Array.isArray(child.children)) return false;

    // 验证菜单项
    for (const item of child.children) {
      if (!item || typeof item !== 'object') return false;
      if (typeof item.name !== 'string') return false;
      if (typeof item.url !== 'string') return false;
      if (!Array.isArray(item.children)) return false;
    }
  }

  return true;
}

// ==================== 视图切换 ====================

/**
 * 切换到 JSON 编辑器
 */
function switchToJsonEditor() {
  document.getElementById('visual-editor').style.display = 'none';
  document.getElementById('json-editor-section').style.display = 'block';
  jsonEditor.value = JSON.stringify(currentMenuData, null, 2);
}

/**
 * 切换到可视化编辑器
 */
function switchToVisualEditor() {
  document.getElementById('visual-editor').style.display = 'block';
  document.getElementById('json-editor-section').style.display = 'none';
  renderMenuConfig();
}

/**
 * 加载 JSON 到编辑器
 */
function loadJsonEditor() {
  jsonEditor.value = JSON.stringify(currentMenuData, null, 2);
  showJsonStatus('配置已加载', 'valid');
}

/**
 * 保存 JSON 配置
 */
function saveJsonConfig() {
  const jsonText = jsonEditor.value.trim();

  if (!jsonText) {
    showJsonStatus('配置不能为空', 'invalid');
    return;
  }

  try {
    const config = JSON.parse(jsonText);

    if (!validateMenuData(config)) {
      showJsonStatus('配置结构无效：必须包含 name, isRoot, children 属性，且每个菜单项必须有 name 和 url', 'invalid');
      return;
    }

    currentMenuData = config;
    chrome.storage.local.set({ [CUSTOM_MENU_CONFIG_KEY]: config }, () => {
      showJsonStatus('配置已保存', 'valid');
      showStatusMessage('菜单配置已保存', 'success');
    });
  } catch (e) {
    showJsonStatus('JSON 格式错误: ' + e.message, 'invalid');
  }
}

/**
 * 格式化 JSON
 */
function formatJson() {
  const jsonText = jsonEditor.value.trim();

  if (!jsonText) {
    showJsonStatus('没有内容可格式化', 'invalid');
    return;
  }

  try {
    const config = JSON.parse(jsonText);
    jsonEditor.value = JSON.stringify(config, null, 2);
    showJsonStatus('已格式化', 'valid');
  } catch (e) {
    showJsonStatus('JSON 格式错误，无法格式化: ' + e.message, 'invalid');
  }
}

/**
 * 显示 JSON 状态
 */
function showJsonStatus(message, type) {
  jsonStatus.textContent = message;
  jsonStatus.className = `status-message show ${type === 'valid' ? 'success' : 'error'}`;

  setTimeout(() => {
    jsonStatus.classList.remove('show');
  }, 3000);
}

// ==================== 工具函数 ====================

/**
 * 关闭模态框
 */
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
  // 清空表单
  if (modalId === 'group-modal') {
    document.getElementById('group-name').value = '';
  } else if (modalId === 'item-modal') {
    document.getElementById('item-name').value = '';
    document.getElementById('item-url').value = '';
  }
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;

  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 恢复默认配置（隐藏功能，可通过控制台调用）
 */
function resetToDefault() {
  if (confirm('确定要恢复默认菜单配置吗？这将清除所有自定义配置。')) {
    chrome.storage.local.remove(CUSTOM_MENU_CONFIG_KEY, () => {
      currentMenuData = JSON.parse(JSON.stringify(defaultMenuData));
      renderMenuConfig();
      showStatusMessage('已恢复默认菜单配置', 'success');
    });
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeMenuConfig);

// 点击模态框背景关闭
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
});

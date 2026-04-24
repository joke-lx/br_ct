/**
 * 提示词编辑器
 * 使用 Native Messaging 与 Go 程序通信
 */

// 状态
let port = null;
let currentFile = null;
let prompts = [];
let hasUnsavedChanges = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initConnection();
  initEventListeners();
});

// 初始化连接
function initConnection() {
  updateConnectionStatus(false);
  connectToNative();
}

// 连接到原生主机
function connectToNative() {
  try {
    port = chrome.runtime.connectNative('com.brochat.prompts_editor');

    port.onMessage.addListener((msg) => {
      handleNativeMessage(msg);
    });

    port.onDisconnect.addListener(() => {
      console.log('Native host disconnected');
      port = null;
      updateConnectionStatus(false);
    });

    updateConnectionStatus(true);
    loadFiles();
  } catch (err) {
    console.error('Connect error:', err);
    updateConnectionStatus(false);
  }
}

// 断开连接
function disconnectNative() {
  if (port) {
    port.disconnect();
    port = null;
  }
  updateConnectionStatus(false);
}

// 处理原生消息
function handleNativeMessage(msg) {
  console.log('Native message:', msg);

  if (msg.status === 'error') {
    showNotification(msg.message || '操作失败', 'error');
    return;
  }

  // 根据命令类型处理响应
  if (msg.command) {
    switch (msg.command) {
      case 'listDir':
        renderFileList(msg.data || []);
        break;
      case 'parsePrompts':
        prompts = msg.data || [];
        renderPromptsList();
        break;
      case 'writeFile':
      case 'savePrompts':
        hasUnsavedChanges = false;
        document.getElementById('saveFile').disabled = true;
        showNotification('保存成功', 'success');
        break;
      case 'createBackup':
        showNotification('备份已创建', 'success');
        break;
    }
  }
}

// 发送消息到原生主机
function sendToNative(command, params = {}) {
  if (!port) {
    showNotification('未连接到原生主机', 'error');
    return Promise.reject('Not connected');
  }

  return new Promise((resolve, reject) => {
    // 确保 command 和 path 分开传递
    const message = { command: command };
    if (params.path !== undefined) message.path = params.path;
    if (params.content !== undefined) message.content = params.content;

    console.log('Sending to native:', JSON.stringify(message));

    // 设置超时
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);

    // 临时监听器处理响应
    const listener = (msg) => {
      clearTimeout(timeout);
      port.onMessage.removeListener(listener);
      resolve(msg);
    };

    port.onMessage.addListener(listener);
    port.postMessage(message);
  });
}

// 初始化事件监听
function initEventListeners() {
  // 刷新文件列表
  document.getElementById('refreshFiles').addEventListener('click', () => {
    loadFiles();
  });

  // 启动连接
  document.getElementById('connectBtn').addEventListener('click', () => {
    connectToNative();
  });

  // 断开连接
  document.getElementById('disconnectBtn').addEventListener('click', () => {
    disconnectNative();
  });

  // 保存文件
  document.getElementById('saveFile').addEventListener('click', () => {
    saveCurrentFile();
  });

  // 添加提示词
  document.getElementById('addPrompt').addEventListener('click', () => {
    showAddPromptModal();
  });

  // 取消添加
  document.getElementById('cancelAddPrompt').addEventListener('click', () => {
    hideAddPromptModal();
  });

  // 确认添加
  document.getElementById('confirmAddPrompt').addEventListener('click', () => {
    addNewPrompt();
  });

  // 模态框点击外部关闭
  document.getElementById('addPromptModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      hideAddPromptModal();
    }
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentFile && !document.getElementById('saveFile').disabled) {
        saveCurrentFile();
      }
    }
  });
}

// 更新连接状态
function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  if (connected) {
    statusEl.textContent = '已连接';
    statusEl.className = 'status-badge connected';
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
  } else {
    statusEl.textContent = '未连接';
    statusEl.className = 'status-badge disconnected';
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
  }
}

// 加载文件列表
async function loadFiles() {
  try {
    // 获取 prompts 目录路径
    const dirResponse = await sendToNative('getPromptsDir');
    const promptsDir = dirResponse.data;

    // 列出目录
    const listResponse = await sendToNative('listDir', { path: promptsDir });
    renderFileList(listResponse.data || []);
  } catch (err) {
    console.error('Load files error:', err);
    showNotification('加载文件列表失败: ' + err.message, 'error');
  }
}

// 渲染文件列表
function renderFileList(files) {
  const fileListEl = document.getElementById('fileList');

  if (!files || files.length === 0) {
    fileListEl.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p>没有找到提示词文件</p>
      </div>
    `;
    return;
  }

  // 过滤 .js 文件
  const jsFiles = files.filter(f => f.extension === 'js' && !f.isDir);

  if (jsFiles.length === 0) {
    fileListEl.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p>没有找到提示词文件</p>
      </div>
    `;
    return;
  }

  fileListEl.innerHTML = jsFiles.map(file => `
    <div class="file-item" data-name="${file.name}">
      <span class="icon">📄</span>
      <span class="name">${file.name}</span>
    </div>
  `).join('');

  // 绑定点击事件
  fileListEl.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => {
      selectFile(item.dataset.name);
    });
  });
}

// 选择文件
async function selectFile(fileName) {
  // 标记当前文件
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.toggle('active', item.dataset.name === fileName);
  });

  // 更新标题
  document.getElementById('currentFileName').textContent = fileName;
  currentFile = fileName;

  // 显示加载状态
  const contentEl = document.getElementById('editorContent');
  contentEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    // 获取 prompts 目录
    const dirResponse = await sendToNative('getPromptsDir');
    const promptsDir = dirResponse.data;
    const filePath = `${promptsDir}\\${fileName}`;

    // 解析提示词文件
    const response = await sendToNative('parsePrompts', { path: filePath });
    prompts = response.data || [];
    renderPromptsList();

    // 启用保存按钮
    document.getElementById('saveFile').disabled = true;
    hasUnsavedChanges = false;
  } catch (err) {
    console.error('Load file error:', err);
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <h3>加载失败</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

// 渲染提示词列表
function renderPromptsList() {
  const contentEl = document.getElementById('editorContent');

  if (prompts.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <h3>没有提示词</h3>
        <p>点击"添加"按钮创建新的提示词</p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = `
    <div class="prompts-list">
      ${prompts.map((prompt, index) => `
        <div class="prompt-item" data-index="${index}">
          <div class="prompt-item-header" data-action="toggle" data-index="${index}">
            <div class="prompt-item-title">
              <span>${prompt.label}</span>
              <span class="group-tag">${prompt.group}</span>
            </div>
            <div class="prompt-item-actions">
              <button class="btn btn-secondary" data-action="edit" data-index="${index}" title="编辑">✏️</button>
              <button class="btn btn-danger" data-action="delete" data-index="${index}" title="删除">🗑️</button>
            </div>
          </div>
          <div class="prompt-item-body" id="prompt-body-${index}">
            <textarea id="prompt-template-${index}" placeholder="输入模板内容...">${escapeHtml(prompt.template)}</textarea>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 绑定事件（使用 addEventListener 而非内联 onclick）
  contentEl.querySelectorAll('[data-action="toggle"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const index = parseInt(el.dataset.index);
      togglePromptItem(index);
    });
  });

  contentEl.querySelectorAll('[data-action="edit"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(el.dataset.index);
      editPrompt(index);
    });
  });

  contentEl.querySelectorAll('[data-action="delete"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(el.dataset.index);
      deletePrompt(index);
    });
  });

  // 绑定文本框变化事件
  prompts.forEach((prompt, index) => {
    const textarea = document.getElementById(`prompt-template-${index}`);
    if (textarea) {
      textarea.addEventListener('input', () => {
        prompts[index].template = textarea.value;
        markAsChanged();
      });
    }
  });
}

// 展开/折叠提示词项
function togglePromptItem(index) {
  const body = document.getElementById(`prompt-body-${index}`);
  if (body) {
    body.classList.toggle('expanded');
  }
}

// 标记为已修改
function markAsChanged() {
  if (!hasUnsavedChanges) {
    hasUnsavedChanges = true;
    document.getElementById('saveFile').disabled = false;
  }
}

// 编辑提示词（复制内容到剪贴板以便编辑）
function editPrompt(index) {
  const textarea = document.getElementById(`prompt-template-${index}`);
  if (textarea) {
    textarea.focus();
    textarea.select();
  }
}

// 删除提示词
function deletePrompt(index) {
  if (confirm(`确定要删除提示词 "${prompts[index].label}" 吗？`)) {
    prompts.splice(index, 1);
    renderPromptsList();
    markAsChanged();
  }
}

// 显示添加提示词弹窗
function showAddPromptModal() {
  document.getElementById('addPromptModal').style.display = 'flex';
  document.getElementById('promptLabel').value = '';
  document.getElementById('promptGroup').value = '';
  document.getElementById('promptLabel').focus();
}

// 隐藏添加提示词弹窗
function hideAddPromptModal() {
  document.getElementById('addPromptModal').style.display = 'none';
}

// 添加新提示词
function addNewPrompt() {
  const label = document.getElementById('promptLabel').value.trim();
  const group = document.getElementById('promptGroup').value.trim();

  if (!label) {
    showNotification('请输入提示词名称', 'error');
    return;
  }

  if (!group) {
    showNotification('请输入分组名称', 'error');
    return;
  }

  // 检查是否已存在
  if (prompts.some(p => p.label === label)) {
    showNotification('提示词名称已存在', 'error');
    return;
  }

  prompts.push({
    id: generateId(),
    group: group,
    label: label,
    template: ''
  });

  hideAddPromptModal();
  renderPromptsList();
  markAsChanged();
}

// 保存当前文件
async function saveCurrentFile() {
  if (!currentFile) return;

  try {
    // 获取 prompts 目录
    const dirResponse = await sendToNative('getPromptsDir');
    const promptsDir = dirResponse.data;
    const filePath = `${promptsDir}\\${currentFile}`;

    // 生成文件内容
    const content = generatePromptsFileContent();

    // 保存
    await sendToNative('savePrompts', { path: filePath, content: content });

    showNotification('保存成功', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showNotification('保存失败: ' + err.message, 'error');
  }
}

// 生成提示词文件内容
function generatePromptsFileContent() {
  // 按分组整理
  const groups = {};
  prompts.forEach(p => {
    if (!groups[p.group]) {
      groups[p.group] = [];
    }
    groups[p.group].push(p);
  });

  // 生成内容
  let content = 'export const PROMPTS = {\n';

  prompts.forEach((p, index) => {
    const template = p.template
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');

    content += `  ${p.label}: {\n`;
    content += `    group: "${p.group}",\n`;
    content += `    label: "${p.label}",\n`;
    content += `    template: \`${template}\`\n`;
    content += `  }`;
    content += index < prompts.length - 1 ? ',\n' : '\n';
  });

  content += '};\n';
  return content;
}

// 生成唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// HTML 转义
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 显示通知
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

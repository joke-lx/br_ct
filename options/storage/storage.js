/**
 * 存储调试页面
 */

// DOM 元素
let debugContent;
let statusMessage;
let lastBackupTimeElement;

/**
 * 初始化存储调试页面
 */
function initializeStorageDebug() {
  debugContent = document.getElementById('storage-debug-content');
  statusMessage = document.getElementById('storage-status-message');
  lastBackupTimeElement = document.getElementById('last-backup-time');

  // 加载存储数据
  loadStorageDebug();

  // 加载最后备份时间
  loadLastBackupTime();

  // 刷新按钮
  document.getElementById('refresh-storage').addEventListener('click', loadStorageDebug);

  // 清空按钮
  document.getElementById('clear-storage').addEventListener('click', clearAllStorage);

  // 备份按钮
  document.getElementById('backup-now-btn').addEventListener('click', performManualBackup);

  // 使用事件委托处理折叠/展开
  debugContent.addEventListener('click', (e) => {
    const target = e.target.closest('[data-toggle]');
    if (!target) return;

    const toggleType = target.getAttribute('data-toggle');
    if (toggleType === 'group') {
      // 切换分组
      const content = target.nextElementSibling;
      content.classList.toggle('collapsed');
    } else if (toggleType === 'item') {
      // 切换项目
      const content = target.nextElementSibling;
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
    }
  });
}

/**
 * 加载并显示存储数据（分组显示）
 */
function loadStorageDebug() {
  chrome.storage.local.get(null, (items) => {
    if (Object.keys(items).length === 0) {
      debugContent.innerHTML = '';
      return;
    }

    // 对 key 进行分组
    const grouped = groupStorageKeys(items);

    // 渲染分组
    debugContent.innerHTML = renderGroupedStorage(grouped);
  });
}

/**
 * 对存储 key 进行分组
 */
function groupStorageKeys(items) {
  const groups = {
    queue: { name: '📋 任务队列', items: [], keys: [] },
    config: { name: '⚙️ 配置设置', items: [], keys: [] },
    menu: { name: '📋 菜单配置', items: [], keys: [] },
    video: { name: '🎬 视频配置', items: [], keys: [] },
    history: { name: '🕒 历史记录', items: [], keys: [] },
    other: { name: '📦 其他数据', items: [], keys: [] }
  };

  Object.entries(items).forEach(([key, value]) => {
    const item = { key, value };

    // 队列相关
    if (key.includes('Queue') || key.includes('queue') || key === 'actionsQueue') {
      groups.queue.items.push(item);
      groups.queue.keys.push(key);
    }
    // 配置相关
    else if (key.includes('Config') || key.includes('config') || key.includes('Settings') || key.includes('settings')) {
      groups.config.items.push(item);
      groups.config.keys.push(key);
    }
    // 菜单相关
    else if (key.includes('Menu') || key.includes('menu')) {
      groups.menu.items.push(item);
      groups.menu.keys.push(key);
    }
    // 视频相关
    else if (key.includes('video') || key.includes('Video')) {
      groups.video.items.push(item);
      groups.video.keys.push(key);
    }
    // 历史记录
    else if (key.includes('history') || key.includes('History')) {
      groups.history.items.push(item);
      groups.history.keys.push(key);
    }
    // 其他
    else {
      groups.other.items.push(item);
      groups.other.keys.push(key);
    }
  });

  // 只返回有数据的分组
  return Object.values(groups).filter(g => g.items.length > 0);
}

/**
 * 渲染分组存储
 */
function renderGroupedStorage(groups) {
  return groups.map(group => `
    <div class="storage-group">
      <div class="storage-group-header" data-toggle="group">
        <span>${group.name}</span>
        <span class="group-badge">${group.items.length} 项</span>
      </div>
      <div class="storage-group-content">
        ${group.items.map(item => renderStorageItem(item)).join('')}
      </div>
    </div>
  `).join('');
}

/**
 * 渲染单个存储项
 */
function renderStorageItem(item) {
  const valueType = getValueType(item.value);
  const content = renderValue(item.value, item.key);

  return `
    <div class="storage-item">
      <div class="storage-item-header" data-toggle="item">
        <span class="key-name">${escapeHtml(item.key)}</span>
        <span class="key-type">${valueType}</span>
      </div>
      <div class="storage-item-content" style="display: none;">
        ${content}
      </div>
    </div>
  `;
}

/**
 * 获取值类型
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array[]';
    return `array[${value.length}]`;
  }
  const type = typeof value;
  if (type === 'object') return 'object';
  return type;
}

/**
 * 渲染值（结构化显示）
 */
function renderValue(value, key) {
  // 特殊处理 actionsQueue
  if (key === 'actionsQueue' && Array.isArray(value)) {
    return renderActionsQueue(value);
  }

  // 数组类型
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<div class="json-null">空数组 []</div>';
    }
    return `
      <div class="json-viewer">
        ${value.map((item, index) => `
          <div class="array-card">
            <div class="array-card-header">[${index}] ${getValueType(item)}</div>
            <div class="array-card-body">${formatValue(item)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 对象类型
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '<div class="json-null">空对象 {}</div>';
    }
    return `
      <div class="json-viewer">
        ${Object.entries(value).map(([k, v]) => `
          <div class="json-object-item">
            <span class="json-key">${escapeHtml(k)}</span>: <span class="json-${getJsonClass(v)}">${formatValue(v)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 基础类型
  return `<div class="json-viewer"><span class="json-${getJsonClass(value)}">${escapeHtml(String(value))}</span></div>`;
}

/**
 * 特殊渲染 actionsQueue
 */
function renderActionsQueue(queue) {
  if (!queue || queue.length === 0) {
    return '<div class="json-null">队列为空</div>';
  }

  return `
    <div>
      ${queue.map((item, index) => {
        const platform = item.platform || 'unknown';
        const message = item.message ? (typeof item.message === 'string' ? item.message : JSON.stringify(item.message).substring(0, 100)) : '';
        return `
          <div class="queue-item">
            <div class="queue-item-index">${index + 1}</div>
            <div class="queue-item-content">
              <span class="queue-item-platform">${escapeHtml(platform)}</span>
              ${message ? `<div style="color: #6c757d; margin-top: 2px;">${escapeHtml(message)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 格式化值用于显示
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${escapeHtml(value)}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `Array[${value.length}]`;
  if (typeof value === 'object') return `Object{${Object.keys(value).length} keys}`;
  return String(value);
}

/**
 * 获取 JSON CSS 类名
 */
function getJsonClass(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'object';
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
 * 清空所有存储数据
 */
function clearAllStorage() {
  if (confirm('确定要清空所有存储数据吗？此操作不可恢复！')) {
    chrome.storage.local.clear(() => {
      showStatusMessage('存储数据已清空', 'success');
      loadStorageDebug();
    });
  }
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;

  // 3秒后自动隐藏
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}

// ==================== 备份功能 ====================

/**
 * 加载最后备份时间
 */
function loadLastBackupTime() {
  chrome.runtime.sendMessage({ action: 'getLastBackupTime' }, (response) => {
    if (response) {
      updateLastBackupTimeDisplay(response);
    }
  });
}

/**
 * 更新最后备份时间显示
 */
function updateLastBackupTimeDisplay(timestamp) {
  if (!timestamp) {
    lastBackupTimeElement.textContent = '从未备份';
    lastBackupTimeElement.classList.add('never');
    return;
  }

  lastBackupTimeElement.classList.remove('never');
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeText;
  if (diffMins < 1) {
    timeText = '刚刚';
  } else if (diffMins < 60) {
    timeText = `${diffMins} 分钟前`;
  } else if (diffHours < 24) {
    timeText = `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    timeText = `${diffDays} 天前`;
  } else {
    timeText = `上次备份：${formatDateTime(date)}`;
  }

  lastBackupTimeElement.textContent = timeText;
}

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 执行手动备份
 */
function performManualBackup() {
  const btn = document.getElementById('backup-now-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 备份中...';

  chrome.runtime.sendMessage({ action: 'performBackup' }, (response) => {
    btn.disabled = false;
    btn.textContent = '📥 立即备份';

    if (response && response.success) {
      showStatusMessage(`备份成功: ${response.filename}`, 'success');
      updateLastBackupTimeDisplay(response.time);
    } else {
      showStatusMessage(`备份失败: ${response?.error || '未知错误'}`, 'error');
    }
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeStorageDebug);

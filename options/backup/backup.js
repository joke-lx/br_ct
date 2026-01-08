/**
 * 备份设置页面
 * 管理自动备份配置和手动备份
 */

// DOM 元素
let lastBackupTimeElement;
let autoBackupToggle;
let backupIntervalSelect;
let maxBackupsSelect;
let folderNameInput;
let saveAsToggle;
let statusMessage;
let totalBackupsCount;
let storageSizeCount;
let nextBackupCount;
let backupHistoryList;

/**
 * 初始化备份设置页面
 */
function initializeBackupSettings() {
  // 获取 DOM 元素
  lastBackupTimeElement = document.getElementById('last-backup-time');
  autoBackupToggle = document.getElementById('auto-backup-toggle');
  backupIntervalSelect = document.getElementById('backup-interval-select');
  maxBackupsSelect = document.getElementById('max-backups-select');
  folderNameInput = document.getElementById('folder-name-input');
  saveAsToggle = document.getElementById('save-as-toggle');
  statusMessage = document.getElementById('backup-status-message');
  totalBackupsCount = document.getElementById('total-backups-count');
  storageSizeCount = document.getElementById('storage-size-count');
  nextBackupCount = document.getElementById('next-backup-count');
  backupHistoryList = document.getElementById('backup-history-list');

  // 加载设置
  loadSettings();

  // 加载最后备份时间
  loadLastBackupTime();

  // 加载存储大小
  loadStorageSize();

  // 加载备份历史
  loadBackupHistory();

  // 更新调试信息
  updateDebugInfo();

  // 事件监听器
  document.getElementById('backup-now-btn').addEventListener('click', performManualBackup);
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

  // 当自动备份开关改变时更新下次备份显示
  autoBackupToggle.addEventListener('change', () => {
    updateNextBackupDisplay();
    updateDebugInfo();
  });
  backupIntervalSelect.addEventListener('change', () => {
    updateNextBackupDisplay();
    updateDebugInfo();
  });
}

/**
 * 加载备份设置
 */
function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getBackupSettings' }, (response) => {
    if (response) {
      autoBackupToggle.checked = response.enabled;
      backupIntervalSelect.value = response.intervalHours;
      maxBackupsSelect.value = response.maxBackups;
      folderNameInput.value = response.folderName || 'bro_chat_backups';
      saveAsToggle.checked = response.saveAs || false;
      updateNextBackupDisplay();
    }
  });
}

/**
 * 保存备份设置
 */
function saveSettings() {
  const folderName = folderNameInput.value.trim();
  if (!folderName) {
    showStatusMessage('请输入文件夹名称', 'error');
    return;
  }

  const settings = {
    enabled: autoBackupToggle.checked,
    intervalHours: parseInt(backupIntervalSelect.value),
    maxBackups: parseInt(maxBackupsSelect.value),
    folderName: folderName,
    saveAs: saveAsToggle.checked
  };

  chrome.runtime.sendMessage({ action: 'updateBackupSettings', settings }, (response) => {
    if (response) {
      showStatusMessage('设置已保存', 'success');
      updateNextBackupDisplay();
      updateDebugInfo();
      loadBackupHistory(); // 重新加载备份历史以匹配新文件夹
    } else {
      showStatusMessage('保存失败', 'error');
    }
  });
}

/**
 * 加载最后备份时间
 */
function loadLastBackupTime() {
  chrome.runtime.sendMessage({ action: 'getLastBackupTime' }, (response) => {
    if (response !== undefined) {
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
 * 更新下次备份显示
 * 增强版：从实际的 alarm 获取时间，而不是计算
 */
function updateNextBackupDisplay() {
  if (!autoBackupToggle.checked) {
    nextBackupCount.textContent = '未启用';
    return;
  }

  // 从 chrome.alarms 获取实际的下次备份时间
  chrome.alarms.get('storage-auto-backup', (alarm) => {
    const intervalHours = parseInt(backupIntervalSelect.value);

    if (chrome.runtime.lastError) {
      console.warn('获取 alarm 失败:', chrome.runtime.lastError);
      nextBackupCount.textContent = '未知';
      return;
    }

    if (!alarm) {
      // 没有 alarm，可能未启用或出错
      chrome.runtime.sendMessage({ action: 'getLastBackupTime' }, (response) => {
        if (!response) {
          nextBackupCount.textContent = `${intervalHours} 小时后（首次）`;
        } else {
          // 有上次备份时间但没有 alarm，说明可能有问题
          nextBackupCount.textContent = '等待调度...';
        }
      });
      return;
    }

    // 使用实际的 alarm 时间
    const nextBackupTime = new Date(alarm.scheduledTime);
    const now = new Date();
    const diffMs = nextBackupTime - now;

    if (diffMs <= 0) {
      nextBackupCount.textContent = '即将执行';
      return;
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) {
      nextBackupCount.textContent = `${diffMins} 分钟后`;
    } else if (diffHours < 24) {
      nextBackupCount.textContent = `${diffHours} 小时后`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      nextBackupCount.textContent = `${diffDays} 天后`;
    }
  });
}

/**
 * 加载存储大小
 */
function loadStorageSize() {
  chrome.storage.local.get(null, (items) => {
    const jsonStr = JSON.stringify(items);
    const sizeBytes = new Blob([jsonStr]).size;
    storageSizeCount.textContent = formatBytes(sizeBytes);
  });
}

/**
 * 加载备份历史
 */
function loadBackupHistory() {
  // 先获取当前设置以获取文件夹名称
  chrome.runtime.sendMessage({ action: 'getBackupSettings' }, (settings) => {
    const folderName = (settings?.folderName || 'bro_chat_backups').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filenameRegex = `^${folderName}/bro_chat_backup_.*\\.json$`;

    chrome.downloads.search({
      filenameRegex: filenameRegex,
      orderBy: ['-startTime'],
      limit: 10
    }, (results) => {
      if (!results || results.length === 0) {
        backupHistoryList.innerHTML = '<div class="empty-history">暂无备份记录</div>';
        totalBackupsCount.textContent = '0';
        return;
      }

      totalBackupsCount.textContent = results.length;

      backupHistoryList.innerHTML = results.map(item => `
        <div class="backup-history-item">
          <div class="backup-history-info">
            <div class="backup-history-name">${escapeHtml(item.filename)}</div>
            <div class="backup-history-time">${formatDateTime(new Date(item.startTime))}</div>
          </div>
          <div class="backup-history-size">${formatBytes(item.fileSize)}</div>
        </div>
      `).join('');
    });
  });
}

/**
 * 执行手动备份
 */
function performManualBackup() {
  const btn = document.getElementById('backup-now-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 备份中...';

  // 使用 performManualBackup 动作，会根据用户设置决定是否弹出对话框
  chrome.runtime.sendMessage({ action: 'performManualBackup' }, (response) => {
    btn.disabled = false;
    btn.textContent = '📥 立即备份';

    if (response && response.success) {
      showStatusMessage(`备份成功: ${response.filename}`, 'success');
      updateLastBackupTimeDisplay(response.time);
      loadStorageSize();
      loadBackupHistory();
      updateNextBackupDisplay();
    } else {
      showStatusMessage(`备份失败: ${response?.error || '未知错误'}`, 'error');
    }
  });
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
 * 格式化字节大小
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
 * 更新调试信息
 */
function updateDebugInfo() {
  const alarmStatusEl = document.getElementById('debug-alarm-status');
  const alarmTimeEl = document.getElementById('debug-alarm-time');
  const swStatusEl = document.getElementById('debug-sw-status');

  if (!alarmStatusEl) return; // 调试区域可能不存在

  // 检查 Service Worker 状态
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.active) {
        swStatusEl.textContent = '运行中';
        swStatusEl.style.color = 'green';
      } else {
        swStatusEl.textContent = '未激活';
        swStatusEl.style.color = 'orange';
      }
    }).catch(() => {
      swStatusEl.textContent = '不支持';
      swStatusEl.style.color = 'gray';
    });
  } else {
    swStatusEl.textContent = '不支持';
    swStatusEl.style.color = 'gray';
  }

  // 检查 Alarm 状态
  chrome.alarms.get('storage-auto-backup', (alarm) => {
    if (chrome.runtime.lastError) {
      alarmStatusEl.textContent = '错误: ' + chrome.runtime.lastError.message;
      alarmStatusEl.style.color = 'red';
      alarmTimeEl.textContent = '-';
      return;
    }

    if (!alarm) {
      alarmStatusEl.textContent = '未设置';
      alarmStatusEl.style.color = 'orange';
      alarmTimeEl.textContent = '-';
    } else {
      alarmStatusEl.textContent = '已设置';
      alarmStatusEl.style.color = 'green';

      const scheduledTime = new Date(alarm.scheduledTime);
      alarmTimeEl.textContent = scheduledTime.toLocaleString('zh-CN');

      // 检查是否过期
      const now = new Date();
      if (scheduledTime < now) {
        alarmTimeEl.textContent += ' (已过期)';
        alarmTimeEl.style.color = 'red';
      } else {
        const diffMs = scheduledTime - now;
        const diffMins = Math.floor(diffMs / 60000);
        alarmTimeEl.textContent += ` (${diffMins}分钟后)`;
        alarmTimeEl.style.color = 'green';
      }
    }
  });

  // 定期刷新调试信息（每30秒）
  setTimeout(updateDebugInfo, 30000);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeBackupSettings);

/**
 * 备份服务模块
 * 提供定时备份和手动备份功能，将 chrome.storage.local 导出为 JSON 文件
 */

const BACKUP_ALARM_NAME = 'storage-auto-backup';
const BACKUP_SETTINGS_KEY = 'backupSettings';
const LAST_BACKUP_TIME_KEY = 'lastBackupTime';

// 默认备份设置
const DEFAULT_BACKUP_SETTINGS = {
  enabled: false,
  intervalHours: 24, // 默认24小时备份一次
  maxBackups: 7 // 最多保留7个备份文件
};

/**
 * 初始化备份服务
 */
export function initBackupService() {
  // 设置定时监听器
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BACKUP_ALARM_NAME) {
      performBackup();
    }
  });

  // 加载设置并创建定时任务
  loadBackupSettings().then(settings => {
    if (settings.enabled) {
      scheduleBackup(settings.intervalHours);
    }
  });
}

/**
 * 加载备份设置
 */
async function loadBackupSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([BACKUP_SETTINGS_KEY], (result) => {
      resolve({ ...DEFAULT_BACKUP_SETTINGS, ...(result[BACKUP_SETTINGS_KEY] || {}) });
    });
  });
}

/**
 * 保存备份设置
 */
async function saveBackupSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [BACKUP_SETTINGS_KEY]: settings }, () => {
      resolve();
    });
  });
}

/**
 * 更新备份设置
 */
export async function updateBackupSettings(settings) {
  await saveBackupSettings(settings);

  // 重新调度定时任务
  chrome.alarms.clear(BACKUP_ALARM_NAME);

  if (settings.enabled) {
    scheduleBackup(settings.intervalHours);
  }

  return settings;
}

/**
 * 获取备份设置
 */
export async function getBackupSettings() {
  return await loadBackupSettings();
}

/**
 * 获取上次备份时间
 */
export async function getLastBackupTime() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LAST_BACKUP_TIME_KEY], (result) => {
      resolve(result[LAST_BACKUP_TIME_KEY] || null);
    });
  });
}

/**
 * 调度定时备份任务
 */
function scheduleBackup(intervalHours) {
  const intervalMinutes = intervalHours * 60;
  chrome.alarms.create(BACKUP_ALARM_NAME, {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });
}

/**
 * 执行备份
 * 导出 chrome.storage.local 的所有数据到 JSON 文件
 */
export async function performBackup() {
  try {
    // 获取所有存储数据
    const data = await getAllStorageData();

    // 生成备份文件名
    const timestamp = new Date();
    const dateStr = formatDate(timestamp);
    const timeStr = formatTime(timestamp);
    const filename = `bro_chat_backup_${dateStr}_${timeStr}.json`;

    // 创建 JSON 内容
    const jsonContent = JSON.stringify({
      version: '1.1.0',
      backupTime: timestamp.toISOString(),
      backupDate: `${dateStr} ${timeStr}`,
      data: data
    }, null, 2);

    // 下载文件
    await downloadFile(filename, jsonContent);

    // 更新最后备份时间
    await saveLastBackupTime(timestamp.getTime());

    // 清理旧备份
    await cleanupOldBackups();

    // 发送通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '备份成功',
      message: `数据备份已完成: ${filename}`
    });

    return { success: true, filename, time: timestamp.getTime() };
  } catch (error) {
    console.error('Backup failed:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '备份失败',
      message: `备份失败: ${error.message}`
    });
    return { success: false, error: error.message };
  }
}

/**
 * 获取所有存储数据
 */
function getAllStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      resolve(items);
    });
  });
}

/**
 * 下载文件
 * Service Worker 不支持 URL.createObjectURL，使用 Data URI
 */
function downloadFile(filename, content) {
  return new Promise((resolve, reject) => {
    // 将内容转换为 base64 Data URI（使用 TextEncoder 处理 UTF-8）
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64Content = btoa(binary);
    const dataUri = `data:application/json;base64,${base64Content}`;

    chrome.downloads.download({
      url: dataUri,
      filename: `bro_chat_backups/${filename}`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

/**
 * 保存最后备份时间
 */
function saveLastBackupTime(time) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LAST_BACKUP_TIME_KEY]: time }, () => {
      resolve();
    });
  });
}

/**
 * 清理旧备份文件
 */
async function cleanupOldBackups() {
  const settings = await loadBackupSettings();
  if (settings.maxBackups <= 0) return;

  try {
    // 获取下载历史中的备份文件
    const downloads = await new Promise((resolve) => {
      chrome.downloads.search({
        filenameRegex: '^bro_chat_backups/bro_chat_backup_.*\\.json$',
        orderBy: ['-startTime']
      }, resolve);
    });

    // 删除超过数量的旧备份
    if (downloads.length > settings.maxBackups) {
      const toDelete = downloads.slice(settings.maxBackups);
      for (const item of toDelete) {
        try {
          await chrome.downloads.removeFile(item.id);
          await chrome.downloads.erase({ id: item.id });
        } catch (e) {
          // 忽略删除失败
        }
      }
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

/**
 * 格式化日期 YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间 HH-MM-SS
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}-${minutes}-${seconds}`;
}

/**
 * 设置消息监听器，用于从其他页面调用备份功能
 */
export function setupBackupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'performBackup') {
      performBackup().then(sendResponse);
      return true; // 异步响应
    }
    if (message.action === 'getBackupSettings') {
      getBackupSettings().then(sendResponse);
      return true;
    }
    if (message.action === 'updateBackupSettings') {
      updateBackupSettings(message.settings).then(sendResponse);
      return true;
    }
    if (message.action === 'getLastBackupTime') {
      getLastBackupTime().then(sendResponse);
      return true;
    }
  });
}

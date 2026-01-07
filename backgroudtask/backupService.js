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
  maxBackups: 7, // 最多保留7个备份文件
  folderName: 'bro_chat_backups', // 备份文件夹名称
  saveAs: false // 是否每次弹出保存对话框
};

/**
 * 初始化备份服务
 */
export async function initBackupService() {
  console.log('[BackupService] 初始化备份服务...');

  // 检查现有的 alarm
  const existingAlarms = await chrome.alarms.getAll();
  console.log('[BackupService] 现有的 alarms:', existingAlarms.map(a => ({ name: a.name, scheduledTime: a.scheduledTime })));

  // 设置定时监听器（每次 SW 启动都会重新设置）
  chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('[BackupService] Alarm 触发:', alarm.name, 'scheduledTime:', new Date(alarm.scheduledTime));
    if (alarm.name === BACKUP_ALARM_NAME) {
      console.log('[BackupService] 执行自动备份...');
      performBackup().catch(error => {
        console.error('[BackupService] 自动备份失败:', error);
      });
    }
  });
  console.log('[BackupService] Alarm 监听器已设置');

  // 加载设置并创建/更新定时任务
  const settings = await loadBackupSettings();
  console.log('[BackupService] 当前备份设置:', settings);

  if (settings.enabled) {
    await scheduleBackup(settings.intervalHours);
  } else {
    // 如果未启用，确保清除现有的 alarm
    await chrome.alarms.clear(BACKUP_ALARM_NAME);
    console.log('[BackupService] 备份未启用，已清除 alarm');
  }

  console.log('[BackupService] 初始化完成');
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
  console.log('[BackupService] 更新备份设置:', settings);
  await saveBackupSettings(settings);

  // 重新调度定时任务
  await chrome.alarms.clear(BACKUP_ALARM_NAME);

  if (settings.enabled) {
    await scheduleBackup(settings.intervalHours);
  } else {
    console.log('[BackupService] 备份已禁用');
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
async function scheduleBackup(intervalHours) {
  const intervalMinutes = intervalHours * 60;
  console.log(`[BackupService] 调度备份任务: ${intervalHours}小时 (${intervalMinutes}分钟) 后执行`);

  // 先清除旧的 alarm
  await chrome.alarms.clear(BACKUP_ALARM_NAME);

  // 创建新的 alarm
  chrome.alarms.create(BACKUP_ALARM_NAME, {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes
  });

  // 验证 alarm 是否创建成功
  const alarm = await chrome.alarms.get(BACKUP_ALARM_NAME);
  if (alarm) {
    const nextTime = new Date(alarm.scheduledTime);
    console.log(`[BackupService] Alarm 创建成功，下次备份时间: ${nextTime.toLocaleString('zh-CN')}`);
  } else {
    console.error('[BackupService] Alarm 创建失败！');
  }
}

/**
 * 执行备份（自动备份 - 始终静默下载）
 * 导出 chrome.storage.local 的所有数据到 JSON 文件
 * 注意：自动备份会强制 saveAs: false，不弹出对话框
 */
export async function performBackup() {
  console.log('[BackupService] ========== 开始执行自动备份 ==========');
  return await performBackupInternal(false);
}

/**
 * 执行手动备份（可选择是否弹出对话框）
 * @param {boolean} saveAs - 是否弹出保存对话框
 */
export async function performManualBackup(saveAs = false) {
  console.log('[BackupService] ========== 开始执行手动备份 ==========');
  return await performBackupInternal(saveAs);
}

/**
 * 内部备份执行函数
 * @param {boolean} saveAs - 是否弹出保存对话框
 */
async function performBackupInternal(saveAs) {
  console.log('[BackupService] 执行备份, saveAs:', saveAs);
  try {
    // 获取当前设置
    const settings = await loadBackupSettings();
    console.log('[BackupService] 当前设置:', settings);

    // 获取所有存储数据
    console.log('[BackupService] 正在获取存储数据...');
    const data = await getAllStorageData();
    console.log('[BackupService] 存储数据大小:', JSON.stringify(data).length, '字符');

    // 生成备份文件名
    const timestamp = new Date();
    const dateStr = formatDate(timestamp);
    const timeStr = formatTime(timestamp);
    const filename = `bro_chat_backup_${dateStr}_${timeStr}.json`;
    console.log('[BackupService] 备份文件名:', filename);

    // 创建 JSON 内容
    const jsonContent = JSON.stringify({
      version: '1.1.0',
      backupTime: timestamp.toISOString(),
      backupDate: `${dateStr} ${timeStr}`,
      data: data
    }, null, 2);

    // 下载文件（使用传入的 saveAs 参数）
    console.log('[BackupService] 正在下载文件, saveAs:', saveAs, '(自动备份强制为 false)');
    await downloadFile(filename, jsonContent, settings, saveAs);

    // 更新最后备份时间
    await saveLastBackupTime(timestamp.getTime());

    // 清理旧备份
    console.log('[BackupService] 正在清理旧备份...');
    await cleanupOldBackups(settings);

    // 发送通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '备份成功',
      message: `数据备份已完成: ${filename}`
    });

    console.log('[BackupService] ========== 备份成功 ==========');
    return { success: true, filename, time: timestamp.getTime() };
  } catch (error) {
    console.error('[BackupService] ========== 备份失败 ==========', error);
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
 * @param {string} filename - 文件名
 * @param {string} content - 文件内容
 * @param {object} settings - 备份设置
 * @param {boolean} saveAs - 是否弹出保存对话框（覆盖 settings.saveAs）
 */
function downloadFile(filename, content, settings, saveAs) {
  return new Promise((resolve, reject) => {
    console.log('[BackupService] downloadFile - 文件名:', filename, '文件夹:', settings.folderName, 'saveAs:', saveAs);

    // 将内容转换为 base64 Data URI（使用 TextEncoder 处理 UTF-8）
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64Content = btoa(binary);
    const dataUri = `data:application/json;base64,${base64Content}`;

    // 构建完整路径（包含自定义文件夹名称）
    const fullPath = `${settings.folderName || 'bro_chat_backups'}/${filename}`;
    console.log('[BackupService] downloadFile - 完整路径:', fullPath);

    // 使用传入的 saveAs 参数（自动备份强制 false，手动备份使用用户设置）
    const actualSaveAs = saveAs !== undefined ? saveAs : (settings.saveAs || false);
    console.log('[BackupService] downloadFile - 实际 saveAs 值:', actualSaveAs);

    chrome.downloads.download({
      url: dataUri,
      filename: fullPath,
      saveAs: actualSaveAs
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[BackupService] downloadFile - 下载失败:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('[BackupService] downloadFile - 下载成功, ID:', downloadId);
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
 * @param {object} settings - 备份设置
 */
async function cleanupOldBackups(settings) {
  if (!settings) settings = await loadBackupSettings();
  if (settings.maxBackups <= 0) {
    console.log('[BackupService] cleanupOldBackups - maxBackups 设置为 0，跳过清理');
    return;
  }

  try {
    console.log('[BackupService] cleanupOldBackups - 开始清理，最多保留:', settings.maxBackups);

    // 构建正则表达式（使用自定义文件夹名称）
    const folderName = (settings.folderName || 'bro_chat_backups').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filenameRegex = `^${folderName}/bro_chat_backup_.*\\.json$`;
    console.log('[BackupService] cleanupOldBackups - 搜索正则:', filenameRegex);

    // 获取下载历史中的备份文件
    const downloads = await new Promise((resolve) => {
      chrome.downloads.search({
        filenameRegex: filenameRegex,
        orderBy: ['-startTime']
      }, resolve);
    });

    console.log('[BackupService] cleanupOldBackups - 找到备份文件:', downloads.length);

    // 删除超过数量的旧备份
    if (downloads.length > settings.maxBackups) {
      const toDelete = downloads.slice(settings.maxBackups);
      console.log('[BackupService] cleanupOldBackups - 需要删除:', toDelete.length);
      for (const item of toDelete) {
        try {
          await chrome.downloads.removeFile(item.id);
          await chrome.downloads.erase({ id: item.id });
          console.log('[BackupService] cleanupOldBackups - 已删除:', item.filename);
        } catch (e) {
          console.warn('[BackupService] cleanupOldBackups - 删除失败:', item.filename, e);
        }
      }
    } else {
      console.log('[BackupService] cleanupOldBackups - 无需删除');
    }
  } catch (error) {
    console.error('[BackupService] cleanupOldBackups - 清理失败:', error);
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
      // 自动备份（定时任务触发）- 始终静默下载
      performBackup().then(sendResponse);
      return true; // 异步响应
    }
    if (message.action === 'performManualBackup') {
      // 手动备份（用户点击按钮）- 使用用户设置的 saveAs 选项
      loadBackupSettings().then(settings => {
        performManualBackup(settings.saveAs || false).then(sendResponse);
      });
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

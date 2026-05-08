/**
 * 右键菜单管理模块 - 翻译/OCR功能
 * 负责创建、更新和处理右键菜单
 */

// 菜单ID (使用前缀避免冲突)
export const MENU_ID = 'translationSelection';
export const OCR_MENU_ID = 'translationOCR';

/**
 * 创建右键菜单项
 */
function removeContextMenuSafe(id) {
  chrome.contextMenus.remove(id, () => {
    // Swallow "not found" and other benign errors.
    void chrome.runtime.lastError;
  });
}

function createContextMenus() {
  // 先删除已存在的菜单（如果存在）
  removeContextMenuSafe(MENU_ID);
  removeContextMenuSafe(OCR_MENU_ID);

  // 创建新菜单
  chrome.contextMenus.create(
    {
      id: MENU_ID,
      title: '📝 翻译 "%s"',
      contexts: ['selection'],
    },
    () => {
      void chrome.runtime.lastError;
    }
  );

  chrome.contextMenus.create(
    {
      id: OCR_MENU_ID,
      title: '📷 OCR 区域识别',
      contexts: ['page', 'image'],
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
}

/**
 * 根据设置更新菜单显示状态
 */
export function updateContextMenuVisibility() {
  chrome.storage.local.get(['translation.settings'], (result) => {
    const settings = result['translation.settings'] || { showContextMenu: true };

    if (settings.showContextMenu) {
      // 显示菜单
      chrome.contextMenus.create(
        {
          id: MENU_ID,
          title: '📝 翻译 "%s"',
          contexts: ['selection'],
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
      chrome.contextMenus.create(
        {
          id: OCR_MENU_ID,
          title: '📷 OCR 区域识别',
          contexts: ['page', 'image'],
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } else {
      // 隐藏菜单
      removeContextMenuSafe(MENU_ID);
      removeContextMenuSafe(OCR_MENU_ID);
    }
  });
}

/**
 * 处理右键菜单点击事件
 */
function handleContextMenuClick(info, tab) {
  if (info.menuItemId === MENU_ID) {
    const selectedText = info.selectionText;

    // 发送翻译请求到content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'translation.show',
      originalText: selectedText
    });
  } else if (info.menuItemId === OCR_MENU_ID) {
    // 启动 OCR 区域选择
    chrome.tabs.sendMessage(tab.id, {
      action: 'translation.ocr.start'
    });
  }
}

/**
 * 初始化右键菜单模块
 */
let contextMenuSetup = false;

export function setupContextMenu() {
  if (contextMenuSetup) {
    return;
  }
  contextMenuSetup = true;

  const syncContextMenus = () => {
    createContextMenus();
  };

  // 启动时先同步一次，避免重启后菜单缺失
  syncContextMenus();

  // 监听扩展安装/更新事件，创建右键菜单
  chrome.runtime.onInstalled.addListener(() => {
    syncContextMenus();
  });

  // 监听右键菜单点击事件
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}

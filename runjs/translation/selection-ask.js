/**
 * 划词快捷提问模块
 * 仅在 AI 平台页面显示模板面板，点击后发送消息
 */

// ========== 提示词模板（硬编码） ==========
const SELECTION_ASK_PROMPTS = [
  { label: "解释", template: "请解释：%s" },

];

// ========== 全局状态 ==========
let selectionAskPanel = null;
let selectionAskLastSelection = '';

// ========== 平台判断逻辑 ==========
// AI 平台 URL 映射（与 platformConfig.js 保持一致）
const PLATFORM_URLS = {
  'yuanbao.tencent.com': 'yuanbao',
  'gemini.google.com': 'gemini',
  'chatgpt.com': 'chatgpt',
  'claude.ai': 'claude',
  'doubao.com': 'doubao',
  'chatglm.cn': 'glm',
  'qianwen.com': 'tongyi',
  'aistudio.google.com': 'googlestudio',
  'grok.com': 'grok',
  'notion.so': 'notionai',
};

/**
 * 获取当前页面所属平台
 * @returns {string|null} 平台名或 null
 */
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  for (const [domain, platform] of Object.entries(PLATFORM_URLS)) {
    if (hostname.includes(domain)) {
      return platform;
    }
  }
  return null;
}

/**
 * 检查当前页面是否为 AI 平台
 */
function isAIPatform() {
  return getCurrentPlatform() !== null;
}

// ========== 面板创建和定位逻辑 ==========
/**
 * 创建面板元素
 */
function createPanel() {
  const panel = document.createElement('div');
  panel.id = 'selection-ask-panel';
  panel.className = 'selection-ask-panel';

  let itemsHtml = SELECTION_ASK_PROMPTS.map(p =>
    `<div class="selection-ask-item" data-template="${encodeURIComponent(p.template)}">${p.label}</div>`
  ).join('');

  panel.innerHTML = `
    <div class="selection-ask-header">💬 快捷提问</div>
    <div class="selection-ask-list">${itemsHtml}</div>
  `;

  // 绑定点击事件
  panel.querySelectorAll('.selection-ask-item').forEach(item => {
    item.addEventListener('click', () => {
      const template = decodeURIComponent(item.dataset.template);
      handleTemplateClick(template);
    });
  });

  return panel;
}

/**
 * 获取选中文字的边界框
 */
function getSelectionRect() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return range.getBoundingClientRect();
}

/**
 * 定位面板在选中文字旁边
 */
function positionPanel(panel, rect) {
  const panelWidth = 160;
  const panelHeight = 200;
  const padding = 10;

  let left = rect.right + padding;
  let top = rect.top;

  // 右侧空间不够，显示在左侧
  if (left + panelWidth > window.innerWidth) {
    left = rect.left - panelWidth - padding;
  }

  // 下方空间不够，显示在上方
  if (top + panelHeight > window.innerHeight) {
    top = window.innerHeight - panelHeight - padding;
  }

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

// ========== 面板显示/隐藏逻辑 ==========
/**
 * 显示面板
 */
function showPanel() {
  if (!selectionAskPanel) {
    selectionAskPanel = createPanel();
    document.body.appendChild(selectionAskPanel);
  }

  const rect = getSelectionRect();
  if (!rect) return;

  positionPanel(selectionAskPanel, rect);
  selectionAskPanel.style.display = 'block';
}

/**
 * 隐藏面板
 */
function hidePanel() {
  if (selectionAskPanel) {
    selectionAskPanel.style.display = 'none';
  }
}

// ========== 发送消息逻辑 ==========
/**
 * 处理模板点击 - 组合消息并发送
 */
function handleTemplateClick(template) {
  const selectedText = selectionAskLastSelection;
  if (!selectedText) return;

  // 组合消息
  const message = template.replace('%s', selectedText);
  const platform = getCurrentPlatform();

  if (!platform) {
    console.warn('[SelectionAsk] 非 AI 平台页面');
    hidePanel();
    return;
  }

  console.log(`[SelectionAsk] 发送消息到 ${platform}: "${message}"`);

  // 通过 background.js 发送
  chrome.runtime.sendMessage({
    action: 'processTaskQueue',
    queue: [{ platform, message }]
  });

  hidePanel();
}

// ========== 划词监听和初始化逻辑 ==========
// ========== 划词监听 ==========
let selectionTimeout = null;

document.addEventListener('mouseup', (e) => {
  // 仅在 AI 平台页面处理
  if (!isAIPatform()) return;

  // 延迟获取选中文本，确保选择完成
  if (selectionTimeout) clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text && text !== selectionAskLastSelection) {
      selectionAskLastSelection = text;
      showPanel();
    } else if (!text) {
      selectionAskLastSelection = '';
      hidePanel();
    }
  }, 100);
});

// 点击页面其他地方关闭面板
document.addEventListener('mousedown', (e) => {
  if (selectionAskPanel && !selectionAskPanel.contains(e.target)) {
    hidePanel();
  }
});

// ESC 键关闭面板
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hidePanel();
  }
});

console.log('[SelectionAsk] 划词快捷提问模块已加载');

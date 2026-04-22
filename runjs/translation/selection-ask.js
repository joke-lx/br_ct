/**
 * 划词快捷提问模块
 * 仅在 AI 平台页面显示模板面板，点击后发送消息
 */

// ========== 提示词模板（硬编码） ==========
const SELECTION_ASK_PROMPTS = [
  { label: "解释", template: "请深入解释：%s" },
  { label: "证据", template: "证据是什么,这是对的? 开源项目和社区?官方文档?\n%s" },
  { label: "枚举关联", template: "和他们处理的需求,按照场景的推导出他们,而不是直接告诉我他们存在,从真实的问题出发,演进历史出发,没有他们会出现什么问题,以及在这个领域 有没有其他更多的技术\n%s" },
  { label: "more", template: "如果你是一个面试官,你听到了这些实习生的解释,你会提出哪些更加深入的问题和企业级别的复杂场景,以及对应答案,进行深入的挖掘\n%s" },
  { label: "具体具体", template: "具体具体,我要知道原子操作,让我自己也可以编码实现这个机制,我要自己实现类xx的机制,而不是简单的使用,作为一个核心开发者,以及开源案例或者案例结构设计\n%s" },


];

// ========== 全局状态 ==========
let selectionAskPanel = null;
let selectionAskLastSelection = '';
let selectionAskEnabled = true; // 默认启用
let platformDomains = {}; // 从 background 获取

// ========== 初始化：获取配置 ==========
async function initializeSelectionAsk() {
  try {
    // 获取平台域名映射
    const domainResponse = await chrome.runtime.sendMessage({ action: 'getPlatformDomains' });
    if (domainResponse && domainResponse.domains) {
      platformDomains = domainResponse.domains;
    }

    // 获取启用设置
    const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSelectionAskSettings' });
    if (settingsResponse && settingsResponse.settings) {
      selectionAskEnabled = settingsResponse.settings.enabled !== false;
    }

    console.log('[SelectionAsk] 配置加载完成，启用状态:', selectionAskEnabled);
  } catch (e) {
    console.warn('[SelectionAsk] 配置加载失败，使用默认配置:', e);
  }
}

/**
 * 获取当前页面所属平台
 * @returns {string|null} 平台名或 null
 */
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  // 移除 www. 前缀进行匹配
  const cleanHost = hostname.replace(/^www\./, '');

  for (const [domain, platform] of Object.entries(platformDomains)) {
    if (cleanHost.includes(domain) || hostname.includes(domain)) {
      return platform;
    }
  }
  return null;
}

/**
 * 检查当前页面是否为 AI 平台
 */
function isAIPatform() {
  return selectionAskEnabled && getCurrentPlatform() !== null;
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
  try {
    chrome.runtime.sendMessage({
      action: 'processTaskQueue',
      queue: [{ platform, message }]
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[SelectionAsk] 消息发送失败:', chrome.runtime.lastError.message);
      } else {
        console.log('[SelectionAsk] 消息发送成功');
      }
    });
  } catch (e) {
    console.warn('[SelectionAsk] 扩展 context 已失效，请刷新页面:', e.message);
  }

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

// 监听设置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.selectionAskSettings) {
    selectionAskEnabled = changes.selectionAskSettings.newValue.enabled !== false;
    console.log('[SelectionAsk] 启用状态已更新:', selectionAskEnabled);
    if (!selectionAskEnabled) {
      hidePanel();
    }
  }
});

// 初始化并加载配置
initializeSelectionAsk();

console.log('[SelectionAsk] 划词快捷提问模块已加载');

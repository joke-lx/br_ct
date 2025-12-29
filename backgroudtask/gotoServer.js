// ========== 菜单配置数据 ==========
const CUSTOM_MENU_CONFIG_KEY = 'customMenuConfig';

const menuData = {
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
        { name: '上海演唱会', url: 'https://www.bilibili.com/video/BV1L48qzsESK?spm_id_from=333.788.videopod.sections', children: [] },
        { name: '宁波演唱会', url: 'https://www.bilibili.com/video/BV1pca3zPECZ/?spm_id_from=333.337.search-card.all.click&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '北京演唱会', url: 'https://www.bilibili.com/video/BV13hSzYfEfD?spm_id_from=333.788.videopod.sections&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '广州演唱会', url: 'https://www.bilibili.com/video/BV1g2oiYqEiM?spm_id_from=333.788.videopod.sections&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '成都演唱会', url: 'https://www.bilibili.com/video/BV1dUjkzqEUj/?spm_id_from=333.788.videopod.sections&vd_source=b00eb5ad0e31d2629f81cb48d7fab1f2', children: [] },
        { name: '天津演唱会', url: 'https://www.bilibili.com/video/BV1hNq1BTEG8/?spm_id_from=333.337.search-card.all.click', children: [] },
      ]
    },
    {
      name: '📄 网站跳转3',
      children: [
        { name: 'gitee_api', url: 'https://gitee.com/api/v5/swagger', children: [] },
        { name: '高德地图', url: 'https://ditu.amap.com/', children: [] },
        { name: '抖音', url: 'https://www.douyin.com', children: [] },
      ]
    }
  ]
};
// ===================================

/**
 * 初始化右键菜单
 */
export function initContextMenu() {
  // 创建右键菜单
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'addToCircularMenu',
      title: '➕ 添加到圆形菜单',
      contexts: ['link', 'page']
    });
  });

  // 监听右键菜单点击事件
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'addToCircularMenu') {
      // 获取 URL 和标题
      let url = info.linkUrl || tab.url;
      let title = info.linkUrl ? info.selectionText || getDomainName(url) : tab.title;

      // 添加到自定义菜单
      addToCustomMenu(url, title);
    }
  });
}

/**
 * 添加到自定义菜单
 */
function addToCustomMenu(url, title) {
  chrome.storage.local.get([CUSTOM_MENU_CONFIG_KEY], (result) => {
    let customConfig = result[CUSTOM_MENU_CONFIG_KEY];

    // 如果没有自定义配置，创建一个空的
    if (!customConfig) {
      customConfig = {
        name: '菜单',
        isRoot: true,
        children: []
      };
    }

    // 确保有 children 数组
    if (!customConfig.children) {
      customConfig.children = [];
    }

    // 创建一个默认分组（如果没有分组）
    if (customConfig.children.length === 0) {
      customConfig.children.push({
        name: '📄 我的收藏',
        children: []
      });
    }

    // 添加到第一个分组
    const firstGroup = customConfig.children[0];
    if (!firstGroup.children) {
      firstGroup.children = [];
    }

    // 检查是否已存在相同的 URL
    const existingIndex = firstGroup.children.findIndex(item => item.url === url);
    if (existingIndex !== -1) {
      // 已存在，提示用户
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: '圆形菜单',
        message: '该链接已在菜单中'
      });
      return;
    }

    // 添加新项
    firstGroup.children.push({
      name: title || getDomainName(url) || '未命名',
      url: url,
      children: []
    });

    // 保存配置
    chrome.storage.local.set({ [CUSTOM_MENU_CONFIG_KEY]: customConfig }, () => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: '圆形菜单',
        message: `已添加 "${title || getDomainName(url)}" 到菜单`
      });
    });
  });
}

export function setTabTransListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openUrl') {
      const targetUrl = message.url;

      // 解析目标 URL 的域名和路径
      let targetDomain, targetPath;
      try {
        const urlObj = new URL(targetUrl);
        targetDomain = urlObj.hostname;
        // 使用 pathname 进行前缀匹配，它不包含查询参数和哈希
        targetPath = urlObj.pathname;
      } catch (e) {
        console.error("Invalid URL provided:", targetUrl, e);
        sendResponse({ status: 'error', message: 'Invalid URL' });
        return true; // 即使出错也返回 true，因为我们异步调用了 sendResponse
      }

      // 查询所有标签页
      chrome.tabs.query({}, (tabs) => {
        let existingTab = null;

        // 遍历所有标签页，寻找匹配的
        for (const tab of tabs) {
          // 忽略没有有效 URL 的标签页（如 chrome:// 页面）
          if (!tab.url || tab.url.startsWith('chrome://')) {
            continue;
          }

          try {
            const tabUrlObj = new URL(tab.url);

            // 1. 域名必须完全相同
            // 2. 目标路径必须是当前标签页路径的前缀
            //    例如：目标 /a/b 可以匹配 /a/b 和 /a/b?c=1，但不能匹配 /a
            if (tabUrlObj.hostname === targetDomain && tabUrlObj.pathname.startsWith(targetPath)) {
              existingTab = tab;
              break; // 找到第一个匹配的就可以停止了
            }
          } catch (e) {
            // 忽略无法解析的标签页 URL
            continue;
          }
        }

        if (existingTab) {
          // 如果找到匹配的标签页，则激活它
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });
          console.log(`Found existing tab for ${targetUrl}, activating tab ${existingTab.id}`);
        } else {
          // 否则，创建新标签页
          chrome.tabs.create({ url: targetUrl });
          console.log(`No existing tab found for ${targetUrl}, creating a new one.`);
        }
      });

      sendResponse({ status: 'ok' });
      return true; // 表示异步响应
    } else if (message.action === 'getMenuData') {
      // 先检查是否有自定义菜单配置
      chrome.storage.local.get(['customMenuConfig'], (result) => {
        if (result.customMenuConfig) {
          // 返回自定义菜单
          sendResponse({ status: 'ok', data: result.customMenuConfig });
        } else {
          // 返回默认菜单
          sendResponse({ status: 'ok', data: menuData });
        }
      });
      return true;
    } else if (message.action === 'getHistory') {
      // 获取浏览器历史记录
      const maxResults = message.maxResults || 5;

      chrome.history.search({
        text: '',
        maxResults: maxResults,
        startTime: Date.now() - 24 * 60 * 60 * 1000 // 最近24小时
      }, (historyItems) => {
        if (chrome.runtime.lastError) {
          console.error('History search error:', chrome.runtime.lastError);
          sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          return;
        }

        // 格式化历史记录数据
        const historyData = historyItems.map(item => ({
          name: getDomainName(item.url) || item.title || 'Unknown',
          url: item.url,
          title: item.title || '',
          visitCount: item.visitCount || 0,
          lastVisitTime: item.lastVisitTime || 0
        }));

        sendResponse({ status: 'ok', data: historyData });
      });

      return true; // 异步响应
    }
  });
}

// 获取域名的友好名称
function getDomainName(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    // 移除 www. 前缀
    if (domain.startsWith('www.')) {
      domain = domain.slice(4);
    }

    // 提取主域名部分（去掉顶级域名）
    const parts = domain.split('.');
    let mainDomain = domain;

    if (parts.length >= 2) {
      // 对于常见域名格式，提取主域名部分
      const secondTld = parts[parts.length - 2];

      // 处理三段式域名（如 co.jp, com.cn, com.tw 等）
      if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(secondTld) && parts.length >= 3) {
        mainDomain = parts[parts.length - 3];
      } else {
        // 两段式域名，取第二部分（如 taobao.com → taobao）
        mainDomain = secondTld;
      }
    }

    // 简化一些常见域名的显示
    const domainMap = {
      'bilibili': 'B站',
      'github': 'GitHub',
      'gitee': 'Gitee',
      'zhihu': '知乎',
      'douyin': '抖音',
      'notion': 'Notion',
      'amap': '高德地图',
      'taobao': '淘宝',
      'tmall': '天猫',
      'jd': '京东',
      'google': 'Google',
      'baidu': '百度',
      'weibo': '微博',
      'youtube': 'YouTube',
      'facebook': 'Facebook',
      'twitter': 'Twitter',
      'instagram': 'Instagram',
      'linkedin': 'LinkedIn',
      'reddit': 'Reddit',
      'stackoverflow': 'StackOverflow',
      'csdn': 'CSDN',
      'juejin': '掘金',
      'aliyun': '阿里云',
      'console': '通义千问'
    };

    return domainMap[mainDomain] || mainDomain;
  } catch (e) {
    return null;
  }
}

// ========== 菜单配置数据 ==========
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
      // 返回菜单数据
      sendResponse({ status: 'ok', data: menuData });
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
    const domain = urlObj.hostname;

    // 简化一些常见域名的显示
    const domainMap = {
      'www.bilibili.com': 'B站',
      'github.com': 'GitHub',
      'gitee.com': 'Gitee',
      'www.zhihu.com': '知乎',
      'www.douyin.com': '抖音',
      'www.notion.so': 'Notion',
      'ditu.amap.com': '高德地图',
      'bailian.console.aliyun.com': '通义千问'
    };

    return domainMap[domain] || domain;
  } catch (e) {
    return null;
  }
}

// video_plane_server.js
// 视频片段播放器配置服务器
// 维护 URL 前缀 -> YAML 配置 的映射关系

/**
 * URL 前缀到 YAML 配置的映射表
 * 结构: Map<urlPrefix, yamlContent>
 *
 * 例如:
 * "https://www.bilibili.com/video" -> "Part 1:\n  - 01:16-01:21 打开\n..."
 * "https://www.youtube.com/watch" -> "..."
 */
const videoConfigMap = new Map();

/**
 * 预设配置示例（可根据需要添加）
 * 可以通过 API 动态添加/修改
 */
const presetConfigs = {
  // Bilibili 示例
  "https://www.bilibili.com/video/BV1hNq1BTEG8": 
  ` 

默认分组:
  - 01:21-01:11:45 前期
  - 01:21:05-01:48:38 大仙
  - 02:21:14-02:47:59 后期

`,
};

// 初始化预设配置
function initPresetConfigs() {
  Object.entries(presetConfigs).forEach(([urlPrefix, yaml]) => {
    videoConfigMap.set(urlPrefix, yaml);
  });
}

/**
 * 从 URL 中提取前缀用于匹配
 * @param {string} url 完整 URL
 * @returns {string} URL 前缀
 */
function extractUrlPrefix(url) {
  try {
    const urlObj = new URL(url);
    // 提取 protocol + hostname + pathname 的第一段
    // 例如: https://www.bilibili.com/video/av12345 -> https://www.bilibili.com/video
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      return `${urlObj.protocol}//${urlObj.hostname}/${pathParts[0]}`;
    }
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (e) {
    console.error('URL 解析失败:', e);
    return url;
  }
}

/**
 * 查找匹配的 YAML 配置
 * @param {string} url 当前页面 URL
 * @returns {string|null} YAML 内容或 null
 */
function findYamlConfig(url) {
  const prefix = extractUrlPrefix(url);

  // 精确匹配
  if (videoConfigMap.has(prefix)) {
    console.log(`[VideoPlaneServer] 精确匹配: ${prefix}`);
    return videoConfigMap.get(prefix);
  }

  // 前缀模糊匹配（检查是否有已存储的配置是当前 URL 的前缀）
  for (const [storedPrefix, yaml] of videoConfigMap.entries()) {
    if (url.startsWith(storedPrefix)) {
      console.log(`[VideoPlaneServer] 前缀匹配: ${storedPrefix}`);
      return yaml;
    }
  }

  console.log(`[VideoPlaneServer] 未找到匹配配置: ${prefix}`);
  return null;
}

/**
 * 设置消息监听器
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // 获取视频配置
    if (request.action === "getVideoConfig") {
      const url = request.url;
      const yaml = findYamlConfig(url);
      sendResponse({
        status: "success",
        url: url,
        matchedPrefix: extractUrlPrefix(url),
        yaml: yaml
      });
      return true;
    }

    // 添加/更新视频配置
    if (request.action === "setVideoConfig") {
      const { urlPrefix, yaml } = request;
      if (urlPrefix && yaml) {
        videoConfigMap.set(urlPrefix, yaml);
        // 持久化到 chrome.storage
        chrome.storage.local.get(['videoConfigMap'], (result) => {
          const storedMap = result.videoConfigMap || {};
          storedMap[urlPrefix] = yaml;
          chrome.storage.local.set({ videoConfigMap: storedMap }, () => {
            console.log(`[VideoPlaneServer] 配置已保存: ${urlPrefix}`);
          });
        });
        sendResponse({
          status: "success",
          message: `配置已保存: ${urlPrefix}`
        });
      } else {
        sendResponse({
          status: "failed",
          message: "参数不完整"
        });
      }
      return true;
    }

    // 删除视频配置
    if (request.action === "deleteVideoConfig") {
      const { urlPrefix } = request;
      if (urlPrefix && videoConfigMap.has(urlPrefix)) {
        videoConfigMap.delete(urlPrefix);
        // 从存储中删除
        chrome.storage.local.get(['videoConfigMap'], (result) => {
          const storedMap = result.videoConfigMap || {};
          delete storedMap[urlPrefix];
          chrome.storage.local.set({ videoConfigMap: storedMap }, () => {
            console.log(`[VideoPlaneServer] 配置已删除: ${urlPrefix}`);
          });
        });
        sendResponse({
          status: "success",
          message: `配置已删除: ${urlPrefix}`
        });
      } else {
        sendResponse({
          status: "failed",
          message: "配置不存在"
        });
      }
      return true;
    }

    // 获取所有配置列表
    if (request.action === "listVideoConfigs") {
      const configs = Array.from(videoConfigMap.entries()).map(([urlPrefix, yaml]) => ({
        urlPrefix,
        segmentCount: (yaml.match(/- \d{1,2}:\d{2}/g) || []).length
      }));
      sendResponse({
        status: "success",
        configs: configs
      });
      return true;
    }
  });
}

/**
 * 从持久化存储加载配置
 */
export function loadStoredConfigs() {
  chrome.storage.local.get(['videoConfigMap'], (result) => {
    if (result.videoConfigMap) {
      Object.entries(result.videoConfigMap).forEach(([urlPrefix, yaml]) => {
        videoConfigMap.set(urlPrefix, yaml);
      });
      console.log(`[VideoPlaneServer] 已加载 ${videoConfigMap.size} 个配置`);
    }
  });
}

/**
 * 保存当前配置（用于从 content script 保存）
 */
export function saveCurrentConfig(urlPrefix, yaml) {
  videoConfigMap.set(urlPrefix, yaml);
  chrome.storage.local.get(['videoConfigMap'], (result) => {
    const storedMap = result.videoConfigMap || {};
    storedMap[urlPrefix] = yaml;
    chrome.storage.local.set({ videoConfigMap: storedMap }, () => {
      console.log(`[VideoPlaneServer] 配置已保存: ${urlPrefix}`);
    });
  });
}

/**
 * 初始化函数
 */
export function init() {
  initPresetConfigs();
  loadStoredConfigs();
  setupMessageListener();
  console.log('[VideoPlaneServer] 视频配置服务器已启动');
}

// 导出供外部使用
export { videoConfigMap, findYamlConfig, extractUrlPrefix };

/**
 * API 设置页面
 * 管理智谱 AI 的 API 配置
 */

// 存储键名
const STORAGE_KEY = 'translation.api.config';

// 默认配置
const DEFAULT_CONFIG = {
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  model: 'glm-4.5v'
};

// DOM 元素
let baseURLInput, apiKeyInput, modelInput;
let baseURLStatus, apiKeyStatus, modelStatus;
let testResultDiv, statusMessageDiv;

/**
 * 初始化 API 设置页面
 */
function initializeAPISettings() {
  // 获取 DOM 元素
  baseURLInput = document.getElementById('baseurl-input');
  apiKeyInput = document.getElementById('apikey-input');
  modelInput = document.getElementById('model-input');
  baseURLStatus = document.getElementById('baseurl-status');
  apiKeyStatus = document.getElementById('apikey-status');
  modelStatus = document.getElementById('model-status');
  testResultDiv = document.getElementById('test-result');
  statusMessageDiv = document.getElementById('status-message');

  // 加载已保存的设置
  loadAPISettings();

  // 绑定事件监听器
  bindEventListeners();
}

/**
 * 加载 API 设置
 */
function loadAPISettings() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const config = result[STORAGE_KEY] || { ...DEFAULT_CONFIG };

    // 填充表单
    baseURLInput.value = config.baseURL || DEFAULT_CONFIG.baseURL;
    apiKeyInput.value = config.apiKey || '';
    modelInput.value = config.model || DEFAULT_CONFIG.model;

    // 更新状态显示
    updateStatusDisplay();
  });
}

/**
 * 更新状态显示
 */
function updateStatusDisplay() {
  // Base URL 状态
  if (baseURLInput.value && baseURLInput.value !== DEFAULT_CONFIG.baseURL) {
    baseURLStatus.textContent = '已配置';
    baseURLStatus.className = 'api-status configured';
  } else if (baseURLInput.value === DEFAULT_CONFIG.baseURL) {
    baseURLStatus.textContent = '默认值';
    baseURLStatus.className = 'api-status configured';
  } else {
    baseURLStatus.textContent = '未配置';
    baseURLStatus.className = 'api-status not-configured';
  }

  // API Key 状态
  if (apiKeyInput.value) {
    apiKeyStatus.textContent = '已配置';
    apiKeyStatus.className = 'api-status configured';
  } else {
    apiKeyStatus.textContent = '未配置';
    apiKeyStatus.className = 'api-status not-configured';
  }

  // Model 状态
  if (modelInput.value) {
    modelStatus.textContent = '已配置';
    modelStatus.className = 'api-status configured';
  } else {
    modelStatus.textContent = '未配置';
    modelStatus.className = 'api-status not-configured';
  }
}

/**
 * 保存 API 设置
 */
function saveAPISettings() {
  const config = {
    baseURL: baseURLInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim()
  };

  // 验证必填项
  if (!config.baseURL) {
    showStatusMessage('请输入 API Base URL', 'error');
    return;
  }

  if (!config.apiKey) {
    showStatusMessage('请输入 API Key', 'error');
    return;
  }

  if (!config.model) {
    showStatusMessage('请输入模型名称', 'error');
    return;
  }

  // 保存到本地存储
  chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
    showStatusMessage('设置已保存', 'success');
    updateStatusDisplay();

    // 隐藏测试结果
    testResultDiv.style.display = 'none';
  });
}

/**
 * 重置为默认设置
 */
function resetToDefaults() {
  baseURLInput.value = DEFAULT_CONFIG.baseURL;
  apiKeyInput.value = '';
  modelInput.value = DEFAULT_CONFIG.model;

  showStatusMessage('已重置为默认设置，请点击保存', 'success');
  updateStatusDisplay();
}

/**
 * 测试 API 连接
 */
async function testAPIConnection() {
  const config = {
    baseURL: baseURLInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim()
  };

  // 验证配置
  if (!config.baseURL || !config.apiKey || !config.model) {
    showTestResult('请先填写完整的 API 配置信息', 'error');
    return;
  }

  // 显示测试中
  showTestResult('正在测试连接...', 'info');

  try {
    // 构建测试请求
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: 'Hi'
          }
        ],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        showTestResult('连接成功，API 配置有效', 'success');
      } else {
        showTestResult('连接成功，但返回格式异常', 'error');
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      showTestResult(`连接失败：${errorData.error?.message || response.statusText}`, 'error');
    }
  } catch (error) {
    showTestResult(`连接失败：${error.message}`, 'error');
  }
}

/**
 * 显示测试结果
 */
function showTestResult(message, type) {
  testResultDiv.textContent = message;
  testResultDiv.className = `test-result ${type}`;
  testResultDiv.style.display = 'block';
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, type = 'success') {
  statusMessageDiv.textContent = message;
  statusMessageDiv.className = `status-message show ${type}`;

  // 3秒后自动隐藏
  setTimeout(() => {
    statusMessageDiv.classList.remove('show');
  }, 3000);
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
  // 保存设置按钮
  document.getElementById('save-btn').addEventListener('click', saveAPISettings);

  // 重置设置按钮
  document.getElementById('reset-btn').addEventListener('click', resetToDefaults);

  // 测试连接按钮
  document.getElementById('test-btn').addEventListener('click', testAPIConnection);

  // 监听输入变化更新状态
  baseURLInput.addEventListener('input', updateStatusDisplay);
  apiKeyInput.addEventListener('input', updateStatusDisplay);
  modelInput.addEventListener('input', updateStatusDisplay);

  // 监听来自其他页面的消息
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'getAPISettings') {
      const config = {
        baseURL: baseURLInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim()
      };
      sendResponse({ config });
    }
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeAPISettings);

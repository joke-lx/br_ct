/**
 * AI 提问优化器
 * 对话式优化用户提问
 */

// 存储键名
const STORAGE_KEY = 'translation.api.config';

// DOM 元素
let optimizeBtn, optimizePanel, optimizeOverlay, closeOptimizeBtn;
let messagesContainer, optionsContainer, userInput, submitBtn, applyBtn;

// 对话状态
let conversationHistory = [];
let isProcessing = false;
let finalPrompt = null;

/**
 * 初始化 AI 优化器
 */
export function initializeAIOptimizer() {
  // 获取 DOM 元素
  optimizeBtn = document.getElementById('ai-optimize-btn');
  optimizePanel = document.getElementById('ai-optimize-panel');
  optimizeOverlay = document.getElementById('ai-optimize-overlay');
  closeOptimizeBtn = document.getElementById('close-ai-optimize-btn');
  messagesContainer = document.getElementById('ai-optimize-messages');
  optionsContainer = document.getElementById('ai-optimize-options');
  userInput = document.getElementById('ai-optimize-user-input');
  submitBtn = document.getElementById('ai-optimize-submit-btn');
  applyBtn = document.getElementById('ai-optimize-apply-btn');

  // 绑定事件
  bindEvents();
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
  // 打开优化面板
  optimizeBtn.addEventListener('click', startOptimization);

  // 关闭优化面板
  closeOptimizeBtn.addEventListener('click', closeOptimizationPanel);
  optimizeOverlay.addEventListener('click', closeOptimizationPanel);

  // 发送用户回答
  submitBtn.addEventListener('click', submitUserAnswer);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitUserAnswer();
    }
  });

  // 应用优化结果
  applyBtn.addEventListener('click', applyOptimizedPrompt);
}

/**
 * 开始优化流程
 */
async function startOptimization() {
  // 获取用户输入
  const userInputs = document.querySelectorAll('#dynamic-inputs textarea');
  const userQuestion = Array.from(userInputs).map(input => input.value).join('\n\n').trim();

  if (!userQuestion) {
    alert('请先输入您的提问内容');
    return;
  }

  // 重置状态
  conversationHistory = [];
  finalPrompt = null;
  messagesContainer.innerHTML = '';
  optionsContainer.innerHTML = '';
  applyBtn.disabled = true;

  // 显示面板
  showOptimizationPanel();

  // 显示用户问题
  addMessage('user', userQuestion);

  // 调用 AI 开始优化
  await callAI(userQuestion, 'start');
}

/**
 * 关闭优化面板
 */
function closeOptimizationPanel() {
  optimizePanel.style.display = 'none';
  optimizeOverlay.style.display = 'none';
  conversationHistory = [];
  finalPrompt = null;
}

/**
 * 显示优化面板
 */
function showOptimizationPanel() {
  optimizePanel.style.display = 'flex';
  optimizeOverlay.style.display = 'block';
}

/**
 * 添加消息到对话
 */
function addMessage(type, content, options = []) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-message ${type}`;

  if (type === 'ai') {
    messageDiv.innerHTML = `
      <div class="ai-message-avatar">🤖</div>
      <div class="ai-message-content">${formatMessage(content)}</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="ai-message-content">${formatMessage(content)}</div>
    `;
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // 如果有选项，显示选项按钮
  if (options.length > 0) {
    showOptions(options);
  }
}

/**
 * 格式化消息内容
 */
function formatMessage(content) {
  // 简单的 Markdown 格式化
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

/**
 * 显示选项按钮
 */
function showOptions(options) {
  optionsContainer.innerHTML = '';

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'ai-option-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => {
      userInput.value = option;
      submitUserAnswer();
    });
    optionsContainer.appendChild(btn);
  });
}

/**
 * 提交用户回答
 */
async function submitUserAnswer() {
  const answer = userInput.value.trim();
  if (!answer || isProcessing) return;

  // 清空输入和选项
  userInput.value = '';
  optionsContainer.innerHTML = '';

  // 显示用户消息
  addMessage('user', answer);

  // 继续对话
  await callAI(answer, 'continue');
}

/**
 * 调用 AI API
 */
async function callAI(userInput, stage) {
  isProcessing = true;
  submitBtn.disabled = true;

  // 显示加载动画
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-message ai';
  loadingDiv.innerHTML = `
    <div class="ai-message-avatar">🤖</div>
    <div class="ai-message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    // 获取 API 配置
    const config = await getAPIConfig();
    if (!config || !config.apiKey) {
      throw new Error('API Key 未配置，请先在设置中配置 API Key');
    }

    // 构建请求
    const messages = buildConversationMessages(userInput, stage);

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    // 移除加载动画
    messagesContainer.removeChild(loadingDiv);

    // 解析响应
    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    // 处理 AI 响应
    await processAIResponse(aiResponse);

  } catch (error) {
    // 移除加载动画
    messagesContainer.removeChild(loadingDiv);

    addMessage('ai', `❌ 处理失败：${error.message}`);
  } finally {
    isProcessing = false;
    submitBtn.disabled = false;
  }
}

/**
 * 构建对话消息
 */
function buildConversationMessages(userInput, stage) {
  const systemPrompt = `你是一个专业的提问优化助手。你的任务是通过对话式提问，帮助用户将模糊的问题优化为清晰、具体、可执行的提示词。

规则：
1. 分析用户的问题，识别缺失的关键信息
2. 每次只问1-2个最关键的问题
3. 提供具体的选择选项（如：编程语言选择：Python / Go / JavaScript / 其他）
4. 当信息足够时，输出完整优化的提示词
5. 优化的提示词应该：具体、可执行、包含必要的技术细节
6. 当完成优化时，在回复开头明确标注 "[COMPLETE]" 然后给出最终优化的提示词

输出格式：
- 提问阶段：直接提问，然后提供选项按钮
- 完成阶段："[COMPLETE]" 后跟完整的优化提示词

示例：
用户：编写代码实现docx的阅读
你：请问您希望使用什么编程语言？选择：Python / Go / JavaScript / 其他

用户：Python
你：您需要读取docx文件的哪些内容？选择：文本内容 / 表格数据 / 图片 / 全部内容

用户：文本内容
你：[COMPLETE] 请使用Python的python-docx库，编写代码读取docx文件中的所有文本内容。要求：
1. 使用Document类打开文件
2. 遍历所有段落提取文本
3. 处理可能的异常情况
4. 提供完整可运行的代码示例`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // 添加对话历史
  conversationHistory.forEach((msg, index) => {
    if (index % 2 === 0) {
      messages.push({ role: 'user', content: msg });
    } else {
      messages.push({ role: 'assistant', content: msg });
    }
  });

  // 添加当前用户输入
  messages.push({ role: 'user', content: userInput });

  return messages;
}

/**
 * 处理 AI 响应
 */
async function processAIResponse(aiResponse) {
  // 添加到对话历史
  conversationHistory.push(aiResponse);

  // 检查是否完成
  if (aiResponse.includes('[COMPLETE]')) {
    // 提取最终提示词
    finalPrompt = aiResponse.replace('[COMPLETE]', '').trim();

    // 显示完成消息（不包含 COMPLETE 标记）
    const displayMessage = aiResponse.replace('[COMPLETE]', '✅ <strong>优化完成！</strong><br><br>');
    addMessage('ai', displayMessage);

    // 启用应用按钮
    applyBtn.disabled = false;

    // 滚动到底部
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);

  } else {
    // 解析选项（如果有的话）
    const options = parseOptions(aiResponse);

    // 显示 AI 消息
    addMessage('ai', aiResponse, options);
  }
}

/**
 * 解析 AI 响应中的选项
 */
function parseOptions(response) {
  const options = [];

  // 匹配 "选择：A / B / C" 格式
  const choiceMatch = response.match(/选择[:：](.+)/);
  if (choiceMatch) {
    const choiceText = choiceMatch[1];
    const choiceOptions = choiceText.split('/').map(opt => opt.trim()).filter(opt => opt);
    options.push(...choiceOptions);
  }

  // 匹配 "A. xxx B. xxx C. xxx" 格式
  const letterOptions = response.match(/([A-Z]\.\s+[^\n]+)/g);
  if (letterOptions) {
    letterOptions.forEach(opt => {
      const match = opt.match(/([A-Z])\.\s+(.+)/);
      if (match) {
        options.push(match[2].trim());
      }
    });
  }

  return options;
}

/**
 * 应用优化结果
 */
function applyOptimizedPrompt() {
  if (!finalPrompt) return;

  // 关闭面板
  closeOptimizationPanel();

  // 获取第一个输入框并设置值
  const firstInput = document.querySelector('#dynamic-inputs textarea');
  if (firstInput) {
    firstInput.value = finalPrompt;
    firstInput.dispatchEvent(new Event('input'));

    // 显示成功提示
    const originalText = optimizeBtn.innerHTML;
    optimizeBtn.innerHTML = '<span class="ai-icon">✓</span> 已应用优化';
    setTimeout(() => {
      optimizeBtn.innerHTML = originalText;
    }, 2000);
  }
}

/**
 * 获取 API 配置
 */
async function getAPIConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY]);
    });
  });
}

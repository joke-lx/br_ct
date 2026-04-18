/**
 * OCR批量识别插件主逻辑
 * 使用 chrome.storage.local 存储所有数据
 * 集成 marked.min.js 进行 Markdown 渲染
 */

class OCRPlugin {
    constructor() {
        this.currentImage = null;
        this.currentImageData = null;
        this.currentImageId = null;
        this.prompts = [];
        this.currentResults = [];
        this.isProcessing = false;

        // 默认API配置
        this.apiConfig = {
            baseURL: 'https://open.bigmodel.cn/api/paas/v4',
            apiKey: '',
            model: 'glm-4.5v'
        };

        this.init();
    }

    async init() {
        this.initElements();
        await this.loadConfig();
        await this.loadPrompts();
        this.attachEventListeners();
        this.renderPrompts();
        this.renderHistory();
        this.updateQueueStatus();
    }

    initElements() {
        this.pasteZone = document.getElementById('pasteZone');
        this.pasteContent = document.getElementById('pasteContent');
        this.imagePreview = document.getElementById('imagePreview');
        this.processBtn = document.getElementById('processBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.promptList = document.getElementById('promptList');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.historyList = document.getElementById('historyList');
        this.queueStatus = document.getElementById('queueStatus');
        this.queueCount = document.getElementById('queueCount');
    }

    attachEventListeners() {
        // 图片粘贴和拖拽
        document.addEventListener('paste', (e) => this.handlePaste(e));
        this.pasteZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.pasteZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.pasteZone.addEventListener('drop', (e) => this.handleDrop(e));

        // 控制按钮
        this.processBtn.addEventListener('click', () => this.processQueue());
        this.clearBtn.addEventListener('click', () => this.clearCurrent());

        // 提示词管理
        document.getElementById('addPromptBtn').addEventListener('click', () => this.addPrompt());

        // 结果和历史
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearHistory());
        document.getElementById('refreshHistoryBtn').addEventListener('click', () => this.renderHistory());

        // 使用事件委托处理提示词列表的点击事件
        this.promptList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-prompt');
            if (deleteBtn) {
                const promptId = parseInt(deleteBtn.dataset.promptId);
                if (!isNaN(promptId)) {
                    this.deletePrompt(promptId);
                }
            }
        });

        // 使用事件委托处理结果列表的点击事件
        this.resultsContainer.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.btn-copy-result');
            if (copyBtn) {
                const content = copyBtn.dataset.content;
                if (content) {
                    this.copyResult(content);
                }
            }
        });

        this.historyList.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.btn-view-history');
            if (viewBtn) {
                const recordId = parseInt(viewBtn.dataset.recordId);
                if (!isNaN(recordId)) {
                    this.viewHistory(recordId);
                }
            }

            const deleteBtn = e.target.closest('.btn-delete-history');
            if (deleteBtn) {
                const recordId = parseInt(deleteBtn.dataset.recordId);
                if (!isNaN(recordId)) {
                    this.deleteHistory(recordId);
                }
            }
        });
    }

    // ========== 存储辅助函数 ==========
    async getData(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => resolve(result[key] || null));
        });
    }

    async setData(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
        });
    }

    // ========== 配置管理 ==========
    async loadConfig() {
        // 优先使用 translation.api.config，如果没有则使用旧的配置
        const apiConfig = await this.getData('translation.api.config');
        const legacyApiKey = await this.getData('apiKey');
        const legacyBaseURL = await this.getData('baseURL');

        if (apiConfig && apiConfig.apiKey) {
            this.apiConfig = {
                baseURL: apiConfig.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
                apiKey: apiConfig.apiKey,
                model: apiConfig.model || 'glm-4.5v'
            };
        } else {
            // 兼容旧配置
            if (legacyApiKey) this.apiConfig.apiKey = legacyApiKey;
            if (legacyBaseURL) this.apiConfig.baseURL = legacyBaseURL;
        }
    }

    // ========== 提示词管理 ==========
    async loadPrompts() {
        const saved = await this.getData('ocr.batch.prompts');
        this.prompts = saved || [];

        if (this.prompts.length === 0) {
            // 默认提示词
            this.prompts = [
                { id: 1, text: '请识别这张图片中的所有文字内容' },
                { id: 2, text: '请描述这张图片的主要内容' },
                { id: 3, text: '请提取这张图片中的关键信息，以列表形式输出' }
            ];
            await this.setData('ocr.batch.prompts', this.prompts);
        }
    }

    async addPrompt() {
        const newId = Date.now();
        this.prompts.push({ id: newId, text: '' });
        await this.setData('ocr.batch.prompts', this.prompts);
        this.renderPrompts();
    }

    async updatePrompt(id, text) {
        const prompt = this.prompts.find(p => p.id === id);
        if (prompt) {
            prompt.text = text;
            await this.setData('ocr.batch.prompts', this.prompts);
            this.updateQueueStatus();
        }
    }

    async deletePrompt(id) {
        this.prompts = this.prompts.filter(p => p.id !== id);
        await this.setData('ocr.batch.prompts', this.prompts);
        this.renderPrompts();
        this.updateQueueStatus();
    }

    renderPrompts() {
        if (this.prompts.length === 0) {
            this.promptList.innerHTML = '<div class="empty-state">暂无提示词，点击"添加"按钮添加</div>';
            return;
        }

        this.promptList.innerHTML = this.prompts.map(prompt => `
            <div class="prompt-item" data-prompt-id="${prompt.id}">
                <textarea class="prompt-textarea" placeholder="输入提示词..."
                    data-prompt-id="${prompt.id}">${this.escapeHtml(prompt.text)}</textarea>
                <div class="prompt-actions">
                    <button class="btn btn-sm btn-danger btn-delete-prompt" data-prompt-id="${prompt.id}">删除</button>
                </div>
            </div>
        `).join('');

        // 绑定输入事件
        this.promptList.querySelectorAll('.prompt-textarea').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const promptId = parseInt(e.target.dataset.promptId);
                if (!isNaN(promptId)) {
                    this.updatePrompt(promptId, e.target.value);
                }
            });
        });

        this.updateQueueStatus();
    }

    // ========== 图片处理 ==========
    handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                this.processImage(file);
                break;
            }
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.pasteZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.pasteZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.pasteZone.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (!files) return;

        for (const file of files) {
            if (file.type.indexOf('image') !== -1) {
                this.processImage(file);
                break;
            }
        }
    }

    async processImage(file) {
        const reader = new FileReader();

        reader.onload = async (e) => {
            this.currentImageData = e.target.result;
            this.currentImage = file;
            this.currentImageId = Date.now();
            this.showPreview(this.currentImageData);
            this.processBtn.disabled = this.prompts.filter(p => p.text.trim()).length === 0;
            this.showToast('图片已加载', 'success');
        };

        reader.readAsDataURL(file);
    }

    showPreview(dataUrl) {
        this.pasteContent.style.display = 'none';
        this.imagePreview.innerHTML = `<img src="${dataUrl}" alt="预览">`;
        this.imagePreview.classList.add('active');
        this.pasteZone.classList.add('has-image');
    }

    clearCurrent() {
        this.currentImage = null;
        this.currentImageData = null;
        this.currentImageId = null;
        this.processBtn.disabled = true;

        this.pasteContent.style.display = 'block';
        this.imagePreview.innerHTML = '';
        this.imagePreview.classList.remove('active');
        this.pasteZone.classList.remove('has-image');

        this.currentResults = [];
        this.renderResults();
    }

    // ========== 队列处理 ==========
    updateQueueStatus() {
        const validPrompts = this.prompts.filter(p => p.text.trim());
        this.queueCount.textContent = `待处理: ${validPrompts.length}`;

        this.queueStatus.innerHTML = this.isProcessing
            ? '<span class="queue-status-dot processing"></span>处理中...'
            : '<span class="queue-status-dot"></span>空闲';

        this.processBtn.disabled = !this.currentImageData || validPrompts.length === 0 || this.isProcessing;
    }

    async processQueue() {
        if (!this.currentImageData || this.isProcessing) return;

        const validPrompts = this.prompts.filter(p => p.text.trim());
        if (validPrompts.length === 0) {
            this.showToast('请先添加提示词', 'error');
            return;
        }

        if (!this.apiConfig.apiKey) {
            this.showToast('请先在 API 设置页完成共享配置', 'error');
            return;
        }

        this.isProcessing = true;
        this.currentResults = [];
        this.updateQueueStatus();

        // 创建结果项
        for (const prompt of validPrompts) {
            this.currentResults.push({
                id: Date.now() + Math.random(),
                prompt: prompt.text,
                status: 'pending',
                content: ''
            });
        }
        this.renderResults();

        // 依次处理
        for (let i = 0; i < this.currentResults.length; i++) {
            const result = this.currentResults[i];
            result.status = 'processing';
            this.renderResults();

            try {
                const content = await this.callOCR(result.prompt, result);
                result.status = 'success';
                result.content = content;
            } catch (error) {
                result.status = 'error';
                result.content = `错误: ${error.message}`;
            }

            this.renderResults();
        }

        // 保存结果到历史
        await this.saveToHistory();

        this.isProcessing = false;
        this.updateQueueStatus();
        this.renderHistory();
        this.showToast('识别完成', 'success');
    }

    async saveToHistory() {
        const history = await this.getData('ocr.batch.history') || [];
        const record = {
            id: this.currentImageId,
            image: this.currentImageData,
            results: [...this.currentResults],
            createdAt: Date.now()
        };
        history.unshift(record);

        // 只保留最近50条
        if (history.length > 50) {
            history.splice(50);
        }

        await this.setData('ocr.batch.history', history);
    }

    async callOCR(prompt, resultItem) {
        const response = await fetch(`${this.apiConfig.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: this.apiConfig.model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: this.currentImageData } },
                        { type: 'text', text: prompt }
                    ]
                }],
                temperature: 0.7,
                max_tokens: 2000,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API请求失败: ${response.status}`);
        }

        // 读取流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            fullContent += content;
                            // 实时更新结果内容（带Markdown渲染）
                            if (resultItem) {
                                resultItem.content = fullContent;
                                this.updateResultContent(resultItem.id, fullContent);
                            }
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }

        return fullContent || '无返回内容';
    }

    // 更新单个结果项的内容（用于流式输出）
    updateResultContent(resultId, content) {
        const resultElement = document.querySelector(`[data-result-id="${resultId}"] .result-content`);
        if (resultElement) {
            // 使用 marked.js 渲染 Markdown
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false
                });
                resultElement.innerHTML = marked.parse(content);
                resultElement.classList.add('markdown');
            } else {
                resultElement.textContent = content;
            }
            // 自动滚动到底部
            resultElement.scrollTop = resultElement.scrollHeight;
        }
    }

    // ========== 结果展示 ==========
    renderResults() {
        if (this.currentResults.length === 0) {
            this.resultsContainer.innerHTML = '<div class="empty-state">暂无识别结果</div>';
            return;
        }

        this.resultsContainer.innerHTML = this.currentResults.map(result => `
            <div class="result-item" data-result-id="${result.id}">
                <div class="result-header">
                    <span class="result-prompt">${this.escapeHtml(result.prompt)}</span>
                    <span class="result-status ${result.status}">${this.getStatusText(result.status)}</span>
                </div>
                <div class="result-content">${result.status === 'processing' ? '处理中...' : this.renderMarkdown(result.content)}</div>
                ${result.status === 'success' ? `
                <div class="result-actions">
                    <button class="btn btn-sm btn-secondary btn-copy-result" data-content="${this.escapeForAttr(result.content)}">复制原始文本</button>
                </div>` : ''}
            </div>
        `).join('');
    }

    renderMarkdown(content) {
        if (!content) return '';
        // 使用 marked.js 渲染 Markdown
        if (typeof marked !== 'undefined') {
            try {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false
                });
                return marked.parse(content);
            } catch (e) {
                console.error('Markdown渲染失败:', e);
                return this.escapeHtml(content);
            }
        }
        return this.escapeHtml(content);
    }

    async renderHistory() {
        const history = await this.getData('ocr.batch.history') || [];

        if (history.length === 0) {
            this.historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
            return;
        }

        this.historyList.innerHTML = history.slice(0, 20).map(record => `
            <div class="history-item">
                <div class="history-date">${new Date(record.createdAt).toLocaleString('zh-CN')}</div>
                <div class="history-prompts">${record.results.length} 个识别结果</div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-secondary btn-view-history" data-record-id="${record.id}">查看</button>
                    <button class="btn btn-sm btn-danger btn-delete-history" data-record-id="${record.id}">删除</button>
                </div>
            </div>
        `).join('');
    }

    async viewHistory(recordId) {
        const history = await this.getData('ocr.batch.history') || [];
        const record = history.find(r => r.id === recordId);

        if (record) {
            if (record.image) {
                this.showPreview(record.image);
            }
            this.currentResults = [...record.results];
            this.currentImageId = record.id;
            this.currentImageData = record.image;
            this.renderResults();
        }
    }

    async deleteHistory(recordId) {
        const history = await this.getData('ocr.batch.history') || [];
        const filtered = history.filter(r => r.id !== recordId);
        await this.setData('ocr.batch.history', filtered);

        this.renderHistory();
        this.showToast('已删除', 'success');
    }

    async clearHistory() {
        if (!confirm('确定清空所有历史记录？')) return;
        await this.setData('ocr.batch.history', []);
        this.renderHistory();
        this.renderResults();
        this.showToast('已清空', 'success');
    }

    getStatusText(status) {
        const map = { pending: '等待中', processing: '处理中', success: '完成', error: '失败' };
        return map[status] || status;
    }

    copyResult(content) {
        navigator.clipboard.writeText(content).then(() => {
            this.showToast('已复制', 'success');
        }).catch(() => {
            this.showToast('复制失败', 'error');
        });
    }

    // ========== 数据管理 ==========
    async exportData() {
        const data = {
            version: '1.0.0',
            exportTime: new Date().toISOString(),
            config: this.apiConfig,
            prompts: this.prompts,
            history: await this.getData('ocr.batch.history') || []
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `ocr-batch-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showToast('导出成功', 'success');
    }

    // ========== 工具函数 ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeForAttr(text) {
        if (!text) return '';
        return text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }
}

// 初始化
const plugin = new OCRPlugin();

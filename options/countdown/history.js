console.log("history.js loaded");

// 流水表管理器
class HistoryManager {
    constructor() {
        this.history = [];
        this.filteredHistory = [];
        this.currentDeleteId = null;
        this.cloneData = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadHistory();
        // 请求通知权限
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // 从 chrome.storage.sync 加载流水记录
    loadHistory() {
        chrome.storage.sync.get(['countdownHistory'], (result) => {
            this.history = result.countdownHistory || [];
            this.applyFilters();
        });
    }

    // 保存流水记录
    saveHistory() {
        chrome.storage.sync.set({ countdownHistory: this.history }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save history:', chrome.runtime.lastError);
                alert('保存失败：' + chrome.runtime.lastError.message);
            }
        });
    }

    // 绑定事件
    bindEvents() {
        // 返回按钮
        document.getElementById('backBtn').addEventListener('click', () => {
            // 直接跳转回倒计时面板
            window.location.href = 'index.html';
        });

        // 导出按钮
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportHistory();
        });

        // 清空按钮
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('确定要清空所有流水记录吗？此操作不可恢复。')) {
                this.clearAllHistory();
            }
        });

        // 搜索输入
        document.getElementById('searchInput').addEventListener('input', () => {
            this.applyFilters();
        });

        // 日期筛选
        document.getElementById('dateFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        // 克隆弹窗
        document.getElementById('cloneModalClose').addEventListener('click', () => {
            this.closeCloneModal();
        });

        document.getElementById('cloneModalCancel').addEventListener('click', () => {
            this.closeCloneModal();
        });

        document.getElementById('cloneModalConfirm').addEventListener('click', () => {
            this.confirmClone();
        });

        // 删除确认弹窗
        document.getElementById('deleteRecordModalClose').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('deleteRecordModalCancel').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('deleteRecordModalConfirm').addEventListener('click', () => {
            this.confirmDelete();
        });

        // 点击遮罩关闭
        document.getElementById('cloneModal').addEventListener('click', (e) => {
            if (e.target.id === 'cloneModal') {
                this.closeCloneModal();
            }
        });

        document.getElementById('deleteRecordModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteRecordModal') {
                this.closeDeleteModal();
            }
        });

        // ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCloneModal();
                this.closeDeleteModal();
            }
        });
    }

    // 应用筛选
    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const dateFilter = document.getElementById('dateFilter').value;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);

        this.filteredHistory = this.history.filter(record => {
            // 搜索筛选
            if (searchTerm && !record.timerName.toLowerCase().includes(searchTerm)) {
                return false;
            }

            // 日期筛选
            const recordDate = new Date(record.createdAt);
            switch (dateFilter) {
                case 'today':
                    return recordDate >= today;
                case 'yesterday':
                    return recordDate >= yesterday && recordDate < today;
                case 'week':
                    return recordDate >= weekAgo;
                case 'month':
                    return recordDate >= monthAgo;
                default:
                    return true;
            }
        });

        this.render();
        this.updateStats();
    }

    // 渲染流水列表
    render() {
        const list = document.getElementById('historyList');
        const emptyState = document.getElementById('emptyState');
        const countEl = document.getElementById('recordCount');

        countEl.textContent = `${this.filteredHistory.length} 条记录`;

        if (this.filteredHistory.length === 0) {
            list.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }

        emptyState.classList.remove('show');

        list.innerHTML = this.filteredHistory.map(record => {
            const formattedDate = this.formatDateTime(record.createdAt);
            const realElapsed = this.formatElapsedTime(record.realElapsed);
            const plannedElapsed = this.formatDuration(record.duration);
            const accuracy = this.calculateAccuracy(record);

            return `
                <div class="record-card" style="--record-color: ${record.timerColor}" data-record-id="${record.id}">
                    <div class="record-header">
                        <div class="record-title">${this.escapeHtml(record.timerName)}</div>
                        <div class="record-time">${formattedDate}</div>
                    </div>
                    ${record.timerDesc ? `<div class="record-desc">${this.escapeHtml(record.timerDesc)}</div>` : ''}
                    <div class="record-stats">
                        <div class="record-stat">
                            <span class="record-stat-label">计划时长:</span>
                            <span class="record-stat-value">${plannedElapsed}</span>
                        </div>
                        <div class="record-stat">
                            <span class="record-stat-label">真实耗时:</span>
                            <span class="record-stat-value highlight">${realElapsed}</span>
                        </div>
                        <div class="record-stat">
                            <span class="record-stat-label">准确度:</span>
                            <span class="record-stat-value">${accuracy}</span>
                        </div>
                    </div>
                    <div class="record-actions">
                        <button class="record-action-btn clone" data-id="${record.id}">📋 克隆创建时钟</button>
                        <button class="record-action-btn delete" data-id="${record.id}">🗑️ 删除</button>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定按钮事件
        list.querySelectorAll('.record-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (e.target.classList.contains('clone')) {
                    this.openCloneModal(id);
                } else if (e.target.classList.contains('delete')) {
                    this.openDeleteModal(id);
                }
            });
        });
    }

    // 更新统计数据
    updateStats() {
        const totalCompletions = this.history.length;
        const totalTime = this.history.reduce((sum, r) => sum + r.realElapsed, 0);

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayCompletions = this.history.filter(r => new Date(r.createdAt) >= today).length;

        const avgTime = totalCompletions > 0 ? totalTime / totalCompletions : 0;

        document.getElementById('totalCompletions').textContent = totalCompletions;
        document.getElementById('totalTime').textContent = this.formatTotalTime(totalTime);
        document.getElementById('todayCompletions').textContent = todayCompletions;
        document.getElementById('avgTime').textContent = this.formatDuration(Math.round(avgTime / 60000));
    }

    // 打开克隆弹窗
    openCloneModal(recordId) {
        const record = this.history.find(r => r.id === recordId);
        if (!record) return;

        // 先检查现有倒计时数量
        chrome.storage.sync.get(['countdownTimers'], (result) => {
            const timers = result.countdownTimers || [];
            if (timers.length >= 8) {
                alert('倒计时面板已满（最多8个），请先删除一些倒计时');
                return;
            }

            this.cloneData = record;
            document.getElementById('cloneOriginalName').textContent = record.timerName;
            document.getElementById('cloneOriginalDuration').textContent = this.formatDuration(record.duration);
            document.getElementById('cloneName').value = `${record.timerName} (克隆)`;
            document.getElementById('cloneDesc').value = record.timerDesc || '';

            document.getElementById('cloneModal').classList.add('show');
        });
    }

    // 关闭克隆弹窗
    closeCloneModal() {
        document.getElementById('cloneModal').classList.remove('show');
        this.cloneData = null;
    }

    // 确认克隆
    confirmClone() {
        if (!this.cloneData) return;

        const name = document.getElementById('cloneName').value.trim();
        const desc = document.getElementById('cloneDesc').value.trim();

        if (!name) {
            alert('请输入倒计时名称');
            return;
        }

        const newTimer = {
            id: Date.now().toString(),
            name: name,
            desc: desc,
            duration: this.cloneData.duration,
            color: this.cloneData.timerColor,
            status: 'idle',
            createdAt: Date.now()
        };

        chrome.storage.sync.get(['countdownTimers'], (result) => {
            const timers = result.countdownTimers || [];
            timers.push(newTimer);
            chrome.storage.sync.set({ countdownTimers: timers }, () => {
                this.closeCloneModal();
                alert('倒计时已创建！点击"返回面板"查看');
            });
        });
    }

    // 打开删除确认弹窗
    openDeleteModal(recordId) {
        this.currentDeleteId = recordId;
        document.getElementById('deleteRecordModal').classList.add('show');
    }

    // 关闭删除确认弹窗
    closeDeleteModal() {
        document.getElementById('deleteRecordModal').classList.remove('show');
        this.currentDeleteId = null;
    }

    // 确认删除
    confirmDelete() {
        if (!this.currentDeleteId) return;

        const index = this.history.findIndex(r => r.id === this.currentDeleteId);
        if (index !== -1) {
            this.history.splice(index, 1);
            this.saveHistory();
            this.applyFilters();
        }

        this.closeDeleteModal();
    }

    // 清空所有历史
    clearAllHistory() {
        this.history = [];
        this.saveHistory();
        this.applyFilters();
    }

    // 导出历史
    exportHistory() {
        if (this.history.length === 0) {
            alert('没有记录可导出');
            return;
        }

        const dataStr = JSON.stringify(this.history, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `countdown-history-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 计算准确度
    calculateAccuracy(record) {
        const planned = record.duration * 60 * 1000;
        const actual = record.realElapsed;
        const diff = Math.abs(actual - planned);
        const percent = Math.round((1 - diff / planned) * 100);

        if (percent >= 95) return '🎯 完美';
        if (percent >= 80) return '👍 准确';
        if (percent >= 60) return '� 一般';
        return '⚠️ 偏差较大';
    }

    // 格式化日期时间
    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 格式化耗时
    formatElapsedTime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}时${minutes}分${seconds}秒`;
        }
        if (minutes > 0) {
            return `${minutes}分${seconds}秒`;
        }
        return `${seconds}秒`;
    }

    // 格式化总时间
    formatTotalTime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}小时${minutes}分钟`;
        }
        return `${minutes}分钟`;
    }

    // 格式化时长（分钟转为可读格式）
    formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours > 0) {
            return `${hours}小时${mins}分钟`;
        }
        return `${mins}分钟`;
    }

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new HistoryManager();
});

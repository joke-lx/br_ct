console.log("history.js loaded");

// 流水表管理器
class HistoryManager {
    constructor() {
        this.history = [];
        this.filteredHistory = [];
        this.currentDeleteId = null;
        this.cloneData = null;
        this.saveDebounce = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadHistory();
        // 请求通知权限
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        // 启动定时刷新，每秒更新一次真实耗时
        this.startRealtimeUpdate();
    }

    // 启动实时更新
    startRealtimeUpdate() {
        setInterval(() => {
            // 只在有记录且页面可见时更新
            if (this.history.length > 0 && !document.hidden) {
                this.render();
            }
        }, 1000);
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

        // 先获取当前运行中的计时器数据
        chrome.storage.sync.get(['countdownTimers'], (result) => {
            const timers = result.countdownTimers || [];

            list.innerHTML = this.filteredHistory.map(record => {
                const formattedDate = this.formatDateTime(record.createdAt);

                // 动态计算真实耗时
                let realElapsed;
                const timer = timers.find(t => t.id === record.timerId && (t.status === 'finished' || t.status === 'running'));
                if (timer && timer.startedAt) {
                    // 计时器还在运行或已结束，实时计算真实耗时
                    realElapsed = Date.now() - timer.startedAt;
                    // 实时更新流水记录
                    this.updateRecordRealElapsed(record.id, realElapsed);
                } else {
                    // 使用已保存的值
                    realElapsed = record.realElapsed || 0;
                }

                // 基于秒级别计算（四舍五入）
                const realElapsedSeconds = Math.round(realElapsed / 1000);
                const realElapsedText = this.formatElapsedTime(realElapsed);
                const plannedElapsed = this.formatDuration(record.duration);
                const accuracy = this.calculateAccuracyWithValue(record.duration, realElapsedSeconds);
                const isOvertime = realElapsedSeconds > record.duration;
                const overtimeSeconds = realElapsedSeconds - record.duration;
                const overtimeInfo = isOvertime ? this.formatOvertimeSeconds(overtimeSeconds) : null;

                return `
                    <div class="record-card ${isOvertime ? 'overtime' : ''}" style="--record-color: ${record.timerColor}" data-record-id="${record.id}">
                        <div class="record-header">
                            <div class="record-title">${this.escapeHtml(record.timerName)}${isOvertime ? ' <span class="overtime-badge">⏰ 超时</span>' : ''}</div>
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
                                <span class="record-stat-value highlight ${isOvertime ? 'overtime-text' : ''}">${realElapsedText}</span>
                            </div>
                            ${overtimeInfo ? `
                            <div class="record-stat">
                                <span class="record-stat-label">超时时长:</span>
                                <span class="record-stat-value overtime-text">${overtimeInfo}</span>
                            </div>
                            ` : ''}
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
        });
    }

    // 更新流水记录的真实耗时
    updateRecordRealElapsed(recordId, realElapsed) {
        const record = this.history.find(r => r.id === recordId);
        if (record) {
            record.realElapsed = realElapsed;
            // 节流保存，避免频繁写入
            if (!this.saveDebounce) {
                this.saveDebounce = setTimeout(() => {
                    this.saveHistory();
                    this.saveDebounce = null;
                }, 1000);
            }
        }
    }

    // 更新统计数据
    updateStats() {
        const totalCompletions = this.history.length;
        const totalTime = this.history.reduce((sum, r) => sum + (r.realElapsed || 0), 0);

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayCompletions = this.history.filter(r => new Date(r.createdAt) >= today).length;

        const avgTime = totalCompletions > 0 ? totalTime / totalCompletions : 0;

        document.getElementById('totalCompletions').textContent = totalCompletions;
        document.getElementById('totalTime').textContent = this.formatTotalTime(totalTime);
        document.getElementById('todayCompletions').textContent = todayCompletions;
        document.getElementById('avgTime').textContent = this.formatDuration(Math.round(avgTime / 1000));
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

    // 计算准确度（使用 record 对象）
    calculateAccuracy(record) {
        const planned = record.duration;
        const actual = Math.round((record.realElapsed || 0) / 1000);
        const diff = Math.abs(actual - planned);
        const percent = planned > 0 ? Math.round((1 - diff / planned) * 100) : 100;

        if (percent >= 95) return '🎯 完美';
        if (percent >= 80) return '👍 准确';
        if (percent >= 60) return ' 一般';
        return '⚠️ 偏差较大';
    }

    // 计算准确度（直接使用值）
    calculateAccuracyWithValue(plannedSeconds, actualSeconds) {
        const diff = Math.abs(actualSeconds - plannedSeconds);
        const percent = plannedSeconds > 0 ? Math.round((1 - diff / plannedSeconds) * 100) : 100;

        if (percent >= 95) return '🎯 完美';
        if (percent >= 80) return '👍 准确';
        if (percent >= 60) return ' 一般';
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
        // 四舍五入到秒
        const totalSeconds = Math.round(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

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
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}小时${mins}分钟${secs}秒`;
        }
        if (mins > 0) {
            return `${mins}分${secs}秒`;
        }
        return `${secs}秒`;
    }

    // 格式化超时时长
    // 基于秒的超时格式化（旧函数，保留兼容）
    formatOvertime(realElapsed, plannedElapsed) {
        const realSeconds = Math.round(realElapsed / 1000);
        const plannedSeconds = Math.round(plannedElapsed / 1000);
        return this.formatOvertimeSeconds(realSeconds - plannedSeconds);
    }

    // 基于秒的超时格式化
    formatOvertimeSeconds(overtimeSeconds) {
        if (overtimeSeconds <= 0) return '+0秒';

        const hours = Math.floor(overtimeSeconds / 3600);
        const minutes = Math.floor((overtimeSeconds % 3600) / 60);
        const seconds = overtimeSeconds % 60;

        if (hours > 0) {
            return `+${hours}时${minutes}分${seconds}秒`;
        }
        if (minutes > 0) {
            return `+${minutes}分${seconds}秒`;
        }
        return `+${seconds}秒`;
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

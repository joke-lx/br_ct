console.log("countdown.js loaded");

// 倒计时管理器
class CountdownManager {
    constructor() {
        this.timers = [];
        this.currentEditId = null;
        this.currentDeleteId = null;
        this.selectedColor = '#3b82f6';
        this.timerIntervals = new Map(); // 存储每个计时器的 interval
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTimers();
        // 启动全局定时器更新
        this.startGlobalTicker();
    }

    // 从 chrome.storage.sync 加载倒计时
    loadTimers() {
        chrome.storage.sync.get(['countdownTimers'], (result) => {
            this.timers = result.countdownTimers || [];
            // 恢复运行中的计时器
            this.restoreRunningTimers();
            this.render();
        });
    }

    // 保存倒计时到 chrome.storage.sync
    saveTimers() {
        chrome.storage.sync.set({ countdownTimers: this.timers }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save timers:', chrome.runtime.lastError);
                alert('保存失败：' + chrome.runtime.lastError.message);
            }
        });
    }

    // 恢复运行中的计时器
    restoreRunningTimers() {
        const now = Date.now();
        this.timers.forEach(timer => {
            if (timer.status === 'running' && timer.startedAt) {
                const elapsed = now - timer.startedAt;
                const remaining = (timer.duration * 60 * 1000) - elapsed;
                if (remaining <= 0) {
                    // 已经过期
                    this.finishTimer(timer.id);
                }
            }
        });
    }

    // 启动全局定时器
    startGlobalTicker() {
        setInterval(() => {
            this.updateAllDisplays();
        }, 100);
    }

    // 更新所有显示
    updateAllDisplays() {
        const now = Date.now();
        this.timers.forEach(timer => {
            if (timer.status === 'running' && timer.startedAt) {
                const display = document.querySelector(`[data-timer-id="${timer.id}"] .timer-display`);
                if (display) {
                    const elapsed = now - timer.startedAt;
                    const remaining = (timer.duration * 60 * 1000) - elapsed;
                    display.textContent = this.formatTime(remaining);

                    // 检查是否结束
                    if (remaining <= 0 && !timer.finishedAt) {
                        this.finishTimer(timer.id);
                    }
                }
            }
        });
    }

    // 绑定事件
    bindEvents() {
        // 新建按钮
        document.getElementById('addBtn').addEventListener('click', () => {
            this.openModal();
        });

        // 流水表按钮
        document.getElementById('historyBtn').addEventListener('click', () => {
            // 直接跳转
            window.location.href = 'history.html';
        });

        // 弹窗关闭
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalCancel').addEventListener('click', () => {
            this.closeModal();
        });

        // 弹窗保存
        document.getElementById('modalSave').addEventListener('click', () => {
            this.saveTimer();
        });

        // 删除确认弹窗
        document.getElementById('deleteModalClose').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('deleteModalCancel').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('deleteModalConfirm').addEventListener('click', () => {
            this.confirmDelete();
        });

        // 点击遮罩关闭
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeModal();
            }
        });

        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.closeDeleteModal();
            }
        });

        // 颜色选择
        document.getElementById('colorPicker').addEventListener('click', (e) => {
            if (e.target.classList.contains('color-btn')) {
                document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedColor = e.target.dataset.color;
            }
        });

        // ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }
        });

        // 监听来自流水表的消息
        window.addEventListener('message', (e) => {
            if (e.data.action === 'refreshTimers') {
                this.loadTimers();
            }
        });
    }

    // 渲染倒计时列表
    render() {
        const grid = document.getElementById('countdownGrid');
        const emptyState = document.getElementById('emptyState');
        const countEl = document.getElementById('countStat');

        const activeTimers = this.timers.filter(t => t.status !== 'deleted');
        countEl.textContent = `${activeTimers.length} / 8`;

        if (activeTimers.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }

        emptyState.classList.remove('show');

        grid.innerHTML = activeTimers.map(timer => {
            const statusText = this.getStatusText(timer);
            const timeDisplay = this.getTimerDisplay(timer);
            const actionButtons = this.getActionButtons(timer);

            return `
                <div class="timer-card ${timer.status}" data-timer-id="${timer.id}" style="--timer-color: ${timer.color}">
                    <div class="timer-header">
                        <div class="timer-title" title="${this.escapeHtml(timer.name)}">${this.escapeHtml(timer.name)}</div>
                        <div class="timer-status">${statusText}</div>
                    </div>
                    ${timer.desc ? `<div class="timer-desc">${this.escapeHtml(timer.desc)}</div>` : '<div class="timer-desc"></div>'}
                    <div class="timer-display">${timeDisplay}</div>
                    <div class="timer-actions">
                        ${actionButtons}
                        <button class="timer-more-btn" data-timer-id="${timer.id}">⋮</button>
                    </div>
                    <div class="more-menu" id="moreMenu-${timer.id}">
                        <div class="more-menu-item" data-action="edit" data-id="${timer.id}">✏️ 编辑</div>
                        <div class="more-menu-item" data-action="clone" data-id="${timer.id}">📋 克隆</div>
                        <div class="more-menu-item danger" data-action="delete" data-id="${timer.id}">🗑️ 删除</div>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定卡片事件
        this.bindCardEvents();
    }

    // 绑定卡片事件
    bindCardEvents() {
        // 开始/暂停/重置按钮
        document.querySelectorAll('.timer-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timerId = e.target.closest('[data-timer-id]').dataset.timerId;
                const action = e.target.dataset.action;

                if (action === 'start') this.startTimer(timerId);
                else if (action === 'pause') this.pauseTimer(timerId);
                else if (action === 'reset') this.resetTimer(timerId);
                else if (action === 'restart') this.restartTimer(timerId);
            });
        });

        // 更多菜单按钮
        document.querySelectorAll('.timer-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const timerId = e.target.dataset.timerId;
                this.toggleMoreMenu(timerId);
            });
        });

        // 更多菜单项
        document.querySelectorAll('.more-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                this.hideAllMoreMenus();

                if (action === 'edit') this.openModal(id);
                else if (action === 'clone') this.cloneTimer(id);
                else if (action === 'delete') this.openDeleteModal(id);
            });
        });

        // 点击其他地方关闭菜单
        document.addEventListener('click', () => {
            this.hideAllMoreMenus();
        });
    }

    // 切换更多菜单
    toggleMoreMenu(timerId) {
        this.hideAllMoreMenus();
        const menu = document.getElementById(`moreMenu-${timerId}`);
        if (menu) {
            menu.classList.toggle('show');
        }
    }

    // 隐藏所有更多菜单
    hideAllMoreMenus() {
        document.querySelectorAll('.more-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }

    // 获取状态文本
    getStatusText(timer) {
        switch (timer.status) {
            case 'idle': return '待开始';
            case 'running': return '进行中';
            case 'paused': return '已暂停';
            case 'finished': return '已结束';
            default: return '';
        }
    }

    // 获取计时器显示
    getTimerDisplay(timer) {
        if (timer.status === 'idle' || timer.status === 'paused') {
            return this.formatTime(timer.duration * 60 * 1000);
        } else if (timer.status === 'running') {
            const now = Date.now();
            const elapsed = now - timer.startedAt;
            const remaining = (timer.duration * 60 * 1000) - elapsed;
            return this.formatTime(remaining);
        } else if (timer.status === 'finished') {
            // 显示负数（超出的时间）
            const now = Date.now();
            const elapsed = now - timer.startedAt;
            const overTime = (timer.duration * 60 * 1000) - elapsed;
            return this.formatTime(overTime);
        }
        return '00:00:00';
    }

    // 格式化时间
    formatTime(ms) {
        const isNegative = ms < 0;
        const absMs = Math.abs(ms);
        const hours = Math.floor(absMs / (1000 * 60 * 60));
        const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absMs % (1000 * 60)) / 1000);

        const sign = isNegative ? '-' : '';
        if (hours > 0) {
            return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // 获取操作按钮
    getActionButtons(timer) {
        switch (timer.status) {
            case 'idle':
                return `<button class="timer-action-btn btn-start" data-action="start">▶ 开始</button>`;
            case 'running':
                return `
                    <button class="timer-action-btn btn-pause" data-action="pause">⏸ 暂停</button>
                    <button class="timer-action-btn btn-reset" data-action="reset">↺ 重置</button>
                `;
            case 'paused':
                return `
                    <button class="timer-action-btn btn-start" data-action="start">▶ 继续</button>
                    <button class="timer-action-btn btn-reset" data-action="reset">↺ 重置</button>
                `;
            case 'finished':
                return `
                    <button class="timer-action-btn btn-finish" data-action="restart">↻ 重新开始</button>
                    <button class="timer-action-btn btn-reset" data-action="reset">↺ 重置</button>
                `;
            default:
                return '';
        }
    }

    // 开始计时器
    startTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        if (timer.status === 'paused') {
            // 从暂停恢复，调整 startedAt
            const now = Date.now();
            const pausedDuration = now - timer.pausedAt;
            timer.startedAt += pausedDuration;
        } else {
            // 新开始
            timer.startedAt = Date.now();
        }

        timer.status = 'running';
        timer.pausedAt = null;
        this.saveTimers();
        this.render();
    }

    // 暂停计时器
    pauseTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer || timer.status !== 'running') return;

        timer.status = 'paused';
        timer.pausedAt = Date.now();
        this.saveTimers();
        this.render();
    }

    // 重置计时器
    resetTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        timer.status = 'idle';
        timer.startedAt = null;
        timer.pausedAt = null;
        timer.finishedAt = null;
        this.saveTimers();
        this.render();
    }

    // 重新开始计时器
    restartTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        timer.status = 'running';
        timer.startedAt = Date.now();
        timer.pausedAt = null;
        timer.finishedAt = null;
        this.saveTimers();
        this.render();
    }

    // 完成计时器
    finishTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        timer.status = 'finished';
        timer.finishedAt = Date.now();

        // 计算真实耗时
        const realElapsed = timer.finishedAt - timer.startedAt;

        // 保存流水记录
        this.saveHistoryRecord(timer, realElapsed);

        this.saveTimers();
        this.render();

        // 显示通知
        this.showNotification(timer);
    }

    // 保存流水记录
    saveHistoryRecord(timer, realElapsed) {
        chrome.storage.sync.get(['countdownHistory'], (result) => {
            const history = result.countdownHistory || [];
            const record = {
                id: Date.now().toString(),
                timerId: timer.id,
                timerName: timer.name,
                timerDesc: timer.desc,
                timerColor: timer.color,
                duration: timer.duration,
                startedAt: timer.startedAt,
                finishedAt: timer.finishedAt,
                realElapsed: realElapsed,
                createdAt: Date.now()
            };
            history.unshift(record);
            // 只保留最近 500 条
            if (history.length > 500) {
                history.splice(500);
            }
            chrome.storage.sync.set({ countdownHistory: history });
        });
    }

    // 显示通知
    showNotification(timer) {
        if (Notification.permission === 'granted') {
            new Notification('倒计时结束', {
                body: `${timer.name} 已完成！`,
                icon: '/icons/icon128.png'
            });
        }
    }

    // 克隆计时器
    cloneTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        if (this.timers.length >= 8) {
            alert('最多只能创建 8 个倒计时');
            return;
        }

        const newTimer = {
            id: Date.now().toString(),
            name: `${timer.name} (副本)`,
            desc: timer.desc,
            duration: timer.duration,
            color: timer.color,
            status: 'idle',
            createdAt: Date.now()
        };

        this.timers.push(newTimer);
        this.saveTimers();
        this.render();
    }

    // 打开编辑弹窗
    openModal(timerId = null) {
        const modal = document.getElementById('editModal');
        const title = document.getElementById('modalTitle');
        const nameInput = document.getElementById('timerName');
        const descInput = document.getElementById('timerDesc');
        const durationInput = document.getElementById('timerDuration');

        this.currentEditId = timerId;

        if (timerId) {
            title.textContent = '编辑倒计时';
            const timer = this.timers.find(t => t.id === timerId);
            if (timer) {
                nameInput.value = timer.name;
                descInput.value = timer.desc || '';
                durationInput.value = timer.duration;
                this.selectColor(timer.color);
            }
        } else {
            if (this.timers.length >= 8) {
                alert('最多只能创建 8 个倒计时');
                return;
            }
            title.textContent = '新建倒计时';
            nameInput.value = '';
            descInput.value = '';
            durationInput.value = '';
            this.selectColor('#3b82f6');
        }

        modal.classList.add('show');
        setTimeout(() => nameInput.focus(), 100);
    }

    // 关闭弹窗
    closeModal() {
        const modal = document.getElementById('editModal');
        modal.classList.remove('show');
        this.currentEditId = null;
    }

    // 选择颜色
    selectColor(color) {
        this.selectedColor = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });
    }

    // 保存计时器
    saveTimer() {
        const name = document.getElementById('timerName').value.trim();
        const desc = document.getElementById('timerDesc').value.trim();
        const duration = parseInt(document.getElementById('timerDuration').value);

        if (!name) {
            alert('请输入倒计时名称');
            return;
        }

        if (!duration || duration < 1) {
            alert('请输入有效的时长（至少1分钟）');
            return;
        }

        if (this.currentEditId) {
            // 更新
            const index = this.timers.findIndex(t => t.id === this.currentEditId);
            if (index !== -1) {
                // 只有空闲状态才能编辑
                if (this.timers[index].status !== 'idle') {
                    alert('只能编辑待开始的倒计时');
                    return;
                }
                this.timers[index].name = name;
                this.timers[index].desc = desc;
                this.timers[index].duration = duration;
                this.timers[index].color = this.selectedColor;
            }
        } else {
            // 新建
            const timer = {
                id: Date.now().toString(),
                name: name,
                desc: desc,
                duration: duration,
                color: this.selectedColor,
                status: 'idle',
                createdAt: Date.now()
            };
            this.timers.push(timer);
        }

        this.saveTimers();
        this.render();
        this.closeModal();
    }

    // 打开删除确认弹窗
    openDeleteModal(timerId) {
        this.currentDeleteId = timerId;
        const modal = document.getElementById('deleteModal');
        modal.classList.add('show');
    }

    // 关闭删除确认弹窗
    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        modal.classList.remove('show');
        this.currentDeleteId = null;
    }

    // 确认删除
    confirmDelete() {
        if (!this.currentDeleteId) return;

        const index = this.timers.findIndex(t => t.id === this.currentDeleteId);
        if (index !== -1) {
            this.timers.splice(index, 1);
            this.saveTimers();
            this.render();
        }

        this.closeDeleteModal();
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
    new CountdownManager();
});

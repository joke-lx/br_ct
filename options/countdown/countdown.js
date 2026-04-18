console.log("countdown.js loaded");

// 倒计时管理器
class CountdownManager {
    constructor() {
        this.timers = [];
        this.timerOrder = []; // 保存排序后的ID顺序
        this.currentEditId = null;
        this.currentDeleteId = null;
        this.selectedColor = '#99673f';
        this.timerIntervals = new Map(); // 存储每个计时器的 interval
        this.sortableInstance = null; // SortableJS 实例
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
        chrome.storage.sync.get(['countdownTimers', 'countdownTimerOrder'], (result) => {
            this.timers = result.countdownTimers || [];
            this.timerOrder = result.countdownTimerOrder || [];
            // 按保存的顺序排序计时器
            this.sortTimersByOrder();
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

    // 保存排序顺序
    saveTimerOrder() {
        chrome.storage.sync.set({ countdownTimerOrder: this.timerOrder }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save timer order:', chrome.runtime.lastError);
            }
        });
    }

    // 按保存的顺序排序计时器
    sortTimersByOrder() {
        if (this.timerOrder.length === 0) return;

        this.timers.sort((a, b) => {
            const aIndex = this.timerOrder.indexOf(a.id);
            const bIndex = this.timerOrder.indexOf(b.id);
            // 如果ID不在顺序列表中，放到最后
            const aOrder = aIndex === -1 ? 999 : aIndex;
            const bOrder = bIndex === -1 ? 999 : bIndex;
            return aOrder - bOrder;
        });
    }

    // 初始化拖拽排序
    initSortable() {
        const grid = document.getElementById('countdownGrid');
        if (!grid || typeof Sortable === 'undefined') return;

        // 如果已存在实例，先销毁
        if (this.sortableInstance) {
            this.sortableInstance.destroy();
        }

        this.sortableInstance = Sortable.create(grid, {
            animation: 200,
            ghostClass: 'timer-card-ghost',
            chosenClass: 'timer-card-chosen',
            dragClass: 'timer-card-drag',
            handle: '.timer-card', // 整个卡片都可拖拽
            onEnd: (evt) => {
                // 更新内部顺序
                const newOrder = [];
                const cards = grid.querySelectorAll('.timer-card');
                cards.forEach(card => {
                    newOrder.push(card.dataset.timerId);
                });
                this.timerOrder = newOrder;

                // 更新 timers 数组顺序
                this.sortTimersByOrder();

                // 保存到 storage
                this.saveTimerOrder();
            }
        });
    }

    // 恢复运行中的计时器
    restoreRunningTimers() {
        const now = Date.now();
        this.timers.forEach(timer => {
            if (timer.status === 'running' && timer.startedAt) {
                const elapsed = now - timer.startedAt;
                const remaining = (timer.duration * 1000) - elapsed;
                if (remaining <= 0 && !timer.notifiedAt) {
                    // 已经过期但还未通知
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
                    const remaining = (timer.duration * 1000) - elapsed;
                    display.textContent = this.formatTime(remaining);

                    // 检查是否结束（第一次到0时触发通知）
                    if (remaining <= 0 && !timer.notifiedAt) {
                        this.finishTimer(timer.id);
                    }
                }
            } else if (timer.status === 'finished' && timer.startedAt) {
                // finished 状态也继续更新显示（显示负数时间）
                const display = document.querySelector(`[data-timer-id="${timer.id}"] .timer-display`);
                if (display) {
                    const elapsed = now - timer.startedAt;
                    const remaining = (timer.duration * 1000) - elapsed;
                    display.textContent = this.formatTime(remaining);
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

        // 时长输入框滚轮支持
        const minutesInput = document.getElementById('timerDurationMinutes');
        const secondsInput = document.getElementById('timerDurationSeconds');

        // 分钟输入框滚轮
        minutesInput.addEventListener('wheel', (e) => {
            e.preventDefault();
            const currentValue = parseInt(minutesInput.value) || 0;
            const delta = e.deltaY > 0 ? -1 : 1;
            const newValue = Math.max(0, currentValue + delta);
            minutesInput.value = newValue;
        }, { passive: false });

        // 秒输入框滚轮（支持按住Shift快速调整）
        secondsInput.addEventListener('wheel', (e) => {
            e.preventDefault();
            const currentValue = parseInt(secondsInput.value) || 0;
            // 按住Shift时每次调整10秒，否则调整1秒
            const step = e.shiftKey ? 10 : 1;
            const delta = e.deltaY > 0 ? -step : step;
            const newValue = Math.max(0, Math.min(59, currentValue + delta));
            secondsInput.value = newValue;
        }, { passive: false });

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
                        <div class="more-menu-item" data-action="edit" data-id="${timer.id}">编辑</div>
                        <div class="more-menu-item" data-action="clone" data-id="${timer.id}">克隆</div>
                        <div class="more-menu-item danger" data-action="delete" data-id="${timer.id}">删除</div>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定卡片事件
        this.bindCardEvents();

        // 初始化拖拽排序
        this.initSortable();
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
            return this.formatTime(timer.duration * 1000);
        } else if (timer.status === 'running') {
            const now = Date.now();
            const elapsed = now - timer.startedAt;
            const remaining = (timer.duration * 1000) - elapsed;
            return this.formatTime(remaining);
        } else if (timer.status === 'finished') {
            // 显示负数（超出的时间），持续更新
            const now = Date.now();
            const elapsed = now - timer.startedAt;
            const overTime = (timer.duration * 1000) - elapsed;
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
        timer.notifiedAt = null; // 清除通知标记
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
        timer.notifiedAt = null; // 清除通知标记，允许再次通知
        this.saveTimers();
        this.render();
    }

    // 完成计时器（到0时不停止，只是记录并提醒）
    finishTimer(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        // 只有第一次到0时才记录流水和发送通知
        if (!timer.notifiedAt) {
            timer.status = 'finished';
            timer.finishedAt = Date.now();
            timer.notifiedAt = Date.now(); // 记录已通知的时间

            // 计算真实耗时
            const realElapsed = timer.finishedAt - timer.startedAt;

            // 保存流水记录
            this.saveHistoryRecord(timer, realElapsed);

            this.saveTimers();
            this.render();

            // 显示系统通知（更强提醒）
            this.showSystemNotification(timer);

            // 可选：播放提示音
            this.playNotificationSound();
        }
    }

    // 显示系统通知（更强的提醒）
    showSystemNotification(timer) {
        // 请求通知权限
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.createNotification(timer);
                }
            });
        } else if (Notification.permission === 'granted') {
            this.createNotification(timer);
        }
    }

    // 创建通知对象
    createNotification(timer) {
        const notification = new Notification('⏰ 倒计时结束！', {
            body: `${timer.name} 已到达设定时间！\n点击查看详情`,
            icon: chrome.runtime.getURL('icons/icon128.png'),
            badge: chrome.runtime.getURL('icons/icon48.png'),
            tag: `countdown-${timer.id}`, // 相同tag的通知会替换之前的
            requireInteraction: true, // 需要用户交互才会关闭
            vibrate: [200, 100, 200], // 震动模式（支持的设备）
            data: { timerId: timer.id }
        });

        // 点击通知时聚焦到窗口
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            notification.close();
        };

        // 30秒后自动关闭
        setTimeout(() => {
            notification.close();
        }, 30000);
    }

    // 播放提示音
    playNotificationSound() {
        try {
            // 使用 Web Audio API 播放简单的提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800; // 频率
            oscillator.type = 'sine'; // 波形

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('播放提示音失败:', e);
        }
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
        const minutesInput = document.getElementById('timerDurationMinutes');
        const secondsInput = document.getElementById('timerDurationSeconds');

        this.currentEditId = timerId;

        if (timerId) {
            title.textContent = '编辑倒计时';
            const timer = this.timers.find(t => t.id === timerId);
            if (timer) {
                nameInput.value = timer.name;
                descInput.value = timer.desc || '';
                // 将总秒数转换为分钟和秒
                const totalSeconds = timer.duration;
                minutesInput.value = Math.floor(totalSeconds / 60);
                secondsInput.value = totalSeconds % 60;
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
            minutesInput.value = 25;
            secondsInput.value = 0;
            this.selectColor('#99673f');
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
        const minutes = parseInt(document.getElementById('timerDurationMinutes').value) || 0;
        const seconds = parseInt(document.getElementById('timerDurationSeconds').value) || 0;
        const duration = minutes * 60 + seconds; // 转换为总秒数

        if (!name) {
            alert('请输入倒计时名称');
            return;
        }

        if (!duration || duration < 1) {
            alert('请输入有效的时长（至少1秒）');
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

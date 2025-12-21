// ==================== 控制台视频片段播放器（全功能DOM版） ====================
// 用法: 复制整个代码到控制台执行，然后使用界面操作

(function() {
  'use strict';
  
  // 防止重复注入
  if (window._videoSegmentPlayer) {
    console.log('视频片段播放器已存在，重新加载...');
    window._videoSegmentPlayer.cleanup();
  }
  
  // 视频片段播放器类
  class VideoSegmentPlayer {
    constructor() {
      this.videos = [];
      this.currentVideo = null;
      this.segments = [];
      this.currentSegment = 0;
      this.isPlaying = false;
      this.intervalId = null;
      this.eventListeners = [];
      this.uiElement = null;
      this.debugMode = false;
      this.uiInitialized = false;
      
      this.init();
    }
    
    // 初始化
    init() {
      console.log('🔍 正在扫描页面中的视频元素...');
      this.findVideos();
      this.createUI();
      this.bindGlobalEvents();
      
      window._videoSegmentPlayer = this;
      console.log('✅ 视频片段播放器已加载成功!');
    }
    
    // 查找页面中的所有视频
    findVideos() {
      this.videos = Array.from(document.querySelectorAll('video'));

      if (this.videos.length > 0) {
        // 如果当前视频不在新的视频列表中，或者没有当前视频，则选择第一个
        if (!this.currentVideo || !this.videos.includes(this.currentVideo)) {
          this.currentVideo = this.videos[0];
          this.setupTimeUpdateListener();
        }
        this.updateUI();
      } else {
        console.log('❌ 未找到视频元素');
      }
    }
    
    // 获取视频源
    getVideoSource(video) {
      if (video.src) {
        return video.src.substring(0, 100) + (video.src.length > 100 ? '...' : '');
      } else if (video.querySelector('source')) {
        return '多个<source>标签';
      } else if (video.currentSrc) {
        return video.currentSrc.substring(0, 100) + (video.currentSrc.length > 100 ? '...' : '');
      }
      return '未知';
    }
    
    // 创建控制台UI
    createUI() {
      // 移除旧的UI
      if (this.uiElement) {
        this.uiElement.remove();
      }
      
      // 创建浮动控制面板
      this.uiElement = document.createElement('div');
      this.uiElement.id = 'videoSegmentPlayerUI';
      this.uiElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 12px;
        z-index: 999999;
        width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 2px solid #4CAF50;
        resize: both;
        overflow: auto;
        min-width: 350px;
        min-height: 200px;
      `;
      
      this.renderUI();
      document.body.appendChild(this.uiElement);
      this.uiInitialized = true;
    }
    
    // 渲染UI
    renderUI() {
      if (!this.uiElement) return;
      
      const videoOptions = this.videos.map((video, i) => 
        `<option value="${i}" ${video === this.currentVideo ? 'selected' : ''}>
          视频${i}: ${this.getVideoSource(video).split('/').pop().substring(0, 30) || '未知'}
        </option>`
      ).join('');
      
      const segmentsList = this.segments.map((seg, i) =>
        `<div class="segment-item ${i === this.currentSegment ? 'active' : ''}" data-index="${i}">
          <div class="segment-info">
            <span class="segment-index">${i+1}.</span>
            <input type="text" class="segment-start" value="${this.formatTime(seg.start)}"
                   placeholder="开始时间" data-index="${i}">
            <span> - </span>
            <input type="text" class="segment-end" value="${this.formatTime(seg.end)}"
                   placeholder="结束时间" data-index="${i}">
            <input type="text" class="segment-label" value="${seg.label || ''}"
                   placeholder="标签(可选)" data-index="${i}">
          </div>
          <div class="segment-actions">
            <button class="btn btn-play-segment" data-index="${i}" title="播放此片段">▶</button>
            <button class="btn btn-remove-segment" data-index="${i}" title="删除">×</button>
          </div>
        </div>`
      ).join('');
      
      this.uiElement.innerHTML = `
        <div class="header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <strong style="color: #4CAF50; font-size: 14px;">🎬 视频片段播放器</strong>
            <button class="btn btn-small" id="minimizeBtn" title="缩小">📐</button>
          </div>
          <button class="btn btn-close" id="closeUI" title="关闭面板">×</button>
        </div>

        <div class="main-content" id="mainContent">
          <div class="section">
            <div class="section-title">📹 视频选择</div>
            <select id="videoSelect" class="select-input" style="width: 100%; padding: 5px; margin-bottom: 10px;">
              ${videoOptions}
            </select>
            <div style="font-size: 11px; color: #bbb; margin-bottom: 10px;">
              ${this.currentVideo ?
                `时长: ${this.currentVideo.duration ? this.currentVideo.duration.toFixed(1) + 's' : '加载中...'} |
                尺寸: ${this.currentVideo.videoWidth || 0}x${this.currentVideo.videoHeight || 0}` :
                '无视频'}
            </div>
            ${this.currentVideo ? `
              <div style="font-size: 12px; color: #4CAF50; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                <span>当前时间: <strong id="currentTimeDisplay">${this.formatTime(this.currentVideo.currentTime || 0)}</strong></span>
                <button class="btn btn-small" id="copyTimeBtn" title="复制当前时间">📋 复制</button>
              </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
              <span>📊 片段列表 (${this.segments.length})</span>
              <div>
                <button class="btn btn-small" id="quickAddBtn">快速添加</button>
                <button class="btn btn-small" id="clearSegmentsBtn">清空</button>
              </div>
            </div>
            <div id="segmentsList" class="segments-list" style="max-height: 200px; overflow-y: auto; margin: 10px 0;">
              ${segmentsList || '<div style="text-align: center; padding: 20px; color: #888;">暂无片段</div>'}
            </div>
          </div>

          <div class="section">
            <div class="section-title">🎮 播放控制</div>
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px;">
              <button class="btn btn-success" id="playAllBtn" style="flex: 1;">播放全部</button>
              <button class="btn btn-info" id="playNextBtn" style="flex: 1;">下一段</button>
              <button class="btn btn-warning" id="stopBtn" style="flex: 1;">停止</button>
            </div>
            <div style="display: flex; gap: 5px;">
              <button class="btn" id="prevSegmentBtn" style="flex: 1;">上一段</button>
              <button class="btn" id="nextSegmentBtn" style="flex: 1;">下一段</button>
            </div>
          </div>

          <div class="section">
            <div class="section-title">⚙️ 设置</div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
              <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                <input type="checkbox" id="autoPlayNext" checked> 自动播放下一个
              </label>
              <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                <input type="checkbox" id="debugMode"> 调试模式
              </label>
              <button class="btn btn-small" id="exportBtn">导出YAML</button>
              <button class="btn btn-small" id="importBtn">导入YAML</button>
            </div>
          </div>

          <div class="section">
            <div class="section-title">🔧 批量操作</div>
            <textarea id="batchInput" placeholder="YAML格式 (支持分组):
Part 1:
  - 01:16-01:21 打开
  - 08:37-08:42 没语季节

或简单格式 (每行一个):
01:16-01:21 打开
08:37-08:42 没语季节"
                      style="width: 100%; height: 80px; padding: 8px; font-family: monospace; font-size: 11px; background: rgba(255,255,255,0.1); color: white; border: 1px solid #444; border-radius: 4px; resize: vertical; margin-bottom: 8px;"></textarea>
            <div style="display: flex; gap: 5px;">
              <button class="btn" id="batchAddBtn" style="flex: 1;">批量添加</button>
              <button class="btn" id="replaceAllBtn" style="flex: 1;">全部替换</button>
              <button class="btn" id="clearBatchBtn" style="flex: 1;">清空</button>
            </div>
          </div>

          <div class="section">
            <div class="section-title">⏱️ 添加片段</div>
            <div style="display: flex; gap: 5px; margin-bottom: 10px;">
              <input type="text" id="segmentStart" class="time-input" placeholder="00:00"
                     style="flex: 1; padding: 5px;">
              <input type="text" id="segmentEnd" class="time-input" placeholder="00:05"
                     style="flex: 1; padding: 5px;">
              <input type="text" id="segmentLabel" class="label-input" placeholder="标签(可选)"
                     style="flex: 1.5; padding: 5px;">
              <button class="btn btn-primary" id="addSegmentBtn">添加</button>
            </div>
            <div style="font-size: 11px; color: #bbb; margin-bottom: 10px;">
              格式: 00:01-00:05 或 00:01:10-00:01:20
            </div>
          </div>
        </div>

        <div class="minimized-content" id="minimizedContent" style="display: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 10px;">
            <span style="font-size: 11px; color: #4CAF50;">${this.segments.length} 片段</span>
            <div style="display: flex; gap: 5px;">
              <button class="btn btn-small" id="playAllMiniBtn" style="padding: 2px 6px;">▶</button>
              <button class="btn btn-small" id="stopMiniBtn" style="padding: 2px 6px;">⏸</button>
            </div>
          </div>
        </div>

        <div class="status-bar">
          当前片段: ${this.currentSegment + 1}/${this.segments.length} | 状态: ${this.isPlaying ? '播放中' : '已停止'}
        </div>

        <style>
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
            padding-bottom: 8px;
          }

          .section {
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .section:last-child {
            border-bottom: none;
          }

          .section-title {
            font-weight: bold;
            margin-bottom: 6px;
            color: #4CAF50;
            font-size: 11px;
          }

          .btn {
            padding: 4px 10px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s;
            background: rgba(255,255,255,0.1);
            color: white !important;
          }

          .btn:hover {
            background: rgba(255,255,255,0.2);
            transform: translateY(-1px);
          }

          .btn:active {
            transform: translateY(0);
          }

          .btn-primary {
            background: #4CAF50;
            color: white;
          }

          .btn-success {
            background: #2196F3;
            color: white;
          }

          .btn-info {
            background: #00bcd4;
            color: white;
          }

          .btn-warning {
            background: #ff9800;
            color: white;
          }

          .btn-small {
            padding: 2px 6px;
            font-size: 10px;
          }

          .btn-close {
            background: #f44336;
            color: white;
            padding: 2px 6px;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          }

          .segment-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px;
            margin: 2px 0;
            background: rgba(255,255,255,0.05);
            border-radius: 3px;
            border-left: 3px solid #666;
            color: white !important;
          }

          .segment-item.active {
            border-left-color: #4CAF50;
            background: rgba(76, 175, 80, 0.1);
          }

          .segment-item.active .segment-index {
            color: #4CAF50 !important;
          }

          .segment-item.active .segment-start,
          .segment-item.active .segment-end,
          .segment-item.active .segment-label {
            color: white !important;
            background: rgba(255,255,255,0.15) !important;
          }

          .segment-item:hover {
            background: rgba(255,255,255,0.1);
          }

          .segment-info {
            display: flex;
            align-items: center;
            gap: 4px;
            flex: 1;
          }

          .segment-index {
            min-width: 16px;
            text-align: center;
            font-weight: bold;
            color: #aaa !important;
            font-size: 10px;
          }

          .time-input, .label-input {
            background: rgba(255,255,255,0.1) !important;
            border: 1px solid #444;
            border-radius: 2px;
            color: white !important;
            padding: 3px 5px;
            font-family: monospace;
            font-size: 10px;
          }

          .segment-start,
          .segment-end,
          .segment-label {
            background: rgba(255,255,255,0.1) !important;
            border: 1px solid #444;
            border-radius: 2px;
            color: white !important;
            padding: 3px 5px;
            font-family: monospace;
            font-size: 10px;
          }

          .time-input {
            width: 55px;
          }

          .label-input {
            width: 75px;
          }

          .segment-actions {
            display: flex;
            gap: 2px;
          }

          .segments-list::-webkit-scrollbar {
            width: 4px;
          }

          .segments-list::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
          }

          .segments-list::-webkit-scrollbar-thumb {
            background: #4CAF50;
            border-radius: 2px;
          }

          .select-input {
            background: rgba(255,255,255,0.1);
            border: 1px solid #444;
            border-radius: 3px;
            color: white;
            padding: 5px;
            font-size: 11px;
          }

          .select-input option {
            background: #222;
            color: white;
          }

          .status-bar {
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #444;
            font-size: 9px;
            color: #aaa;
            text-align: center;
          }

          /* 最小化状态 */
          .minimized-ui {
            width: auto !important;
            height: auto !important;
            min-width: 120px !important;
            min-height: 30px !important;
          }

          .minimized-ui .main-content {
            display: none;
          }

          .minimized-ui .minimized-content {
            display: block !important;
          }

          .minimized-ui .status-bar {
            display: none;
          }
        </style>
      `;
      
      this.bindUIEvents();
    }
    
    // 绑定UI事件
    bindUIEvents() {
      if (!this.uiElement) return;
      
      // 视频选择
      const videoSelect = this.uiElement.querySelector('#videoSelect');
      if (videoSelect) {
        videoSelect.addEventListener('change', (e) => {
          const index = parseInt(e.target.value);
          this.setVideo(index);
        });
      }
      
      // 添加片段按钮
      const addSegmentBtn = this.uiElement.querySelector('#addSegmentBtn');
      if (addSegmentBtn) {
        addSegmentBtn.addEventListener('click', () => {
          this.addSegmentFromInputs();
        });
      }
      
      // 快速添加按钮
      const quickAddBtn = this.uiElement.querySelector('#quickAddBtn');
      if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
          this.showQuickAddMenu();
        });
      }
      
      // 清空片段按钮
      const clearSegmentsBtn = this.uiElement.querySelector('#clearSegmentsBtn');
      if (clearSegmentsBtn) {
        clearSegmentsBtn.addEventListener('click', () => {
          this.clearSegments();
        });
      }
      
      // 播放全部按钮
      const playAllBtn = this.uiElement.querySelector('#playAllBtn');
      if (playAllBtn) {
        playAllBtn.addEventListener('click', () => {
          this.playSegments();
        });
      }
      
      // 播放下一个按钮
      const playNextBtn = this.uiElement.querySelector('#playNextBtn');
      if (playNextBtn) {
        playNextBtn.addEventListener('click', () => {
          this.playNextSegment();
        });
      }
      
      // 停止按钮
      const stopBtn = this.uiElement.querySelector('#stopBtn');
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          this.stop();
        });
      }
      
      // 上一段按钮
      const prevSegmentBtn = this.uiElement.querySelector('#prevSegmentBtn');
      if (prevSegmentBtn) {
        prevSegmentBtn.addEventListener('click', () => {
          this.playPreviousSegment();
        });
      }
      
      // 下一段按钮
      const nextSegmentBtn = this.uiElement.querySelector('#nextSegmentBtn');
      if (nextSegmentBtn) {
        nextSegmentBtn.addEventListener('click', () => {
          this.playNextSegment();
        });
      }
      
      // 批量操作按钮
      const batchAddBtn = this.uiElement.querySelector('#batchAddBtn');
      if (batchAddBtn) {
        batchAddBtn.addEventListener('click', () => {
          this.addSegmentsFromBatch();
        });
      }
      
      const replaceAllBtn = this.uiElement.querySelector('#replaceAllBtn');
      if (replaceAllBtn) {
        replaceAllBtn.addEventListener('click', () => {
          this.replaceSegmentsFromBatch();
        });
      }
      
      const clearBatchBtn = this.uiElement.querySelector('#clearBatchBtn');
      if (clearBatchBtn) {
        clearBatchBtn.addEventListener('click', () => {
          const batchInput = this.uiElement.querySelector('#batchInput');
          if (batchInput) batchInput.value = '';
        });
      }
      
      // 导入/导出按钮
      const exportBtn = this.uiElement.querySelector('#exportBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          this.exportConfig();
        });
      }
      
      const importBtn = this.uiElement.querySelector('#importBtn');
      if (importBtn) {
        importBtn.addEventListener('click', () => {
          this.importConfig();
        });
      }
      
      // 关闭按钮
      const closeBtn = this.uiElement.querySelector('#closeUI');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.removeUI();
        });
      }
      
      // 自动播放下一个复选框
      const autoPlayNext = this.uiElement.querySelector('#autoPlayNext');
      if (autoPlayNext) {
        autoPlayNext.addEventListener('change', (e) => {
          this.autoPlayNext = e.target.checked;
        });
      }
      
      // 调试模式复选框
      const debugMode = this.uiElement.querySelector('#debugMode');
      if (debugMode) {
        debugMode.addEventListener('change', (e) => {
          this.debugMode = e.target.checked;
        });
      }
      
      // 输入框回车键支持
      const segmentStart = this.uiElement.querySelector('#segmentStart');
      const segmentEnd = this.uiElement.querySelector('#segmentEnd');
      
      const handleEnterKey = (e) => {
        if (e.key === 'Enter') {
          this.addSegmentFromInputs();
        }
      };
      
      if (segmentStart) segmentStart.addEventListener('keypress', handleEnterKey);
      if (segmentEnd) segmentEnd.addEventListener('keypress', handleEnterKey);
      
      // 绑定片段列表事件
      this.bindSegmentListEvents();

      // 绑定复制时间按钮
      const copyTimeBtn = this.uiElement.querySelector('#copyTimeBtn');
      if (copyTimeBtn) {
        copyTimeBtn.addEventListener('click', () => {
          this.copyCurrentTime();
        });
      }

      // 绑定最小化按钮
      const minimizeBtn = this.uiElement.querySelector('#minimizeBtn');
      if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
          this.toggleMinimize();
        });
      }

      // 绑定最小化状态下的按钮
      const playAllMiniBtn = this.uiElement.querySelector('#playAllMiniBtn');
      if (playAllMiniBtn) {
        playAllMiniBtn.addEventListener('click', () => {
          this.playSegments();
        });
      }

      const stopMiniBtn = this.uiElement.querySelector('#stopMiniBtn');
      if (stopMiniBtn) {
        stopMiniBtn.addEventListener('click', () => {
          this.stop();
        });
      }
    }
    
    // 绑定片段列表事件
    bindSegmentListEvents() {
      if (!this.uiElement) return;
      
      // 播放片段按钮
      this.uiElement.querySelectorAll('.btn-play-segment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(e.target.dataset.index);
          this.playSingleSegment(index);
        });
      });
      
      // 删除片段按钮
      this.uiElement.querySelectorAll('.btn-remove-segment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(e.target.dataset.index);
          this.removeSegment(index);
        });
      });
      
      // 片段输入框变化
      this.uiElement.querySelectorAll('.segment-start, .segment-end, .segment-label').forEach(input => {
        input.addEventListener('change', (e) => {
          const index = parseInt(e.target.dataset.index);
          this.updateSegmentFromInput(index, e.target.className, e.target.value);
        });
        
        input.addEventListener('blur', (e) => {
          const index = parseInt(e.target.dataset.index);
          this.updateSegmentFromInput(index, e.target.className, e.target.value);
        });
      });
    }
    
    // 从输入框添加片段
    addSegmentFromInputs() {
      if (!this.uiElement) return;
      
      const startInput = this.uiElement.querySelector('#segmentStart');
      const endInput = this.uiElement.querySelector('#segmentEnd');
      const labelInput = this.uiElement.querySelector('#segmentLabel');
      
      if (!startInput || !endInput) return;
      
      const start = startInput.value.trim();
      const end = endInput.value.trim();
      const label = labelInput ? labelInput.value.trim() : '';
      
      if (!start || !end) {
        this.showMessage('请输入开始和结束时间', 'error');
        return;
      }
      
      const segment = this.parseTimeRange(`${start}-${end}`);
      if (!segment) {
        this.showMessage('时间格式错误，请使用 00:01-00:05 格式', 'error');
        return;
      }
      
      if (label) {
        segment.label = label;
      }
      
      this.segments.push(segment);
      this.renderUI();
      this.showMessage(`已添加片段: ${start}-${end} ${label ? '(' + label + ')' : ''}`, 'success');
      
      // 清空输入框
      startInput.value = '';
      endInput.value = '';
      if (labelInput) labelInput.value = '';
      startInput.focus();
    }
    
    // 从批量输入添加片段
    addSegmentsFromBatch() {
      if (!this.uiElement) return;

      const batchInput = this.uiElement.querySelector('#batchInput');
      if (!batchInput) return;

      const text = batchInput.value.trim();
      if (!text) {
        this.showMessage('请输入时间片段', 'error');
        return;
      }

      let added = 0;
      let errors = [];

      // 检查是否是YAML格式（包含冒号和短横线的缩进结构）
      const isYAML = text.includes(':') && text.includes('-');

      if (isYAML) {
        // 解析YAML格式
        try {
          const yamlData = this.parseSimpleYAML(text);

          Object.entries(yamlData).forEach(([sectionName, items]) => {
            items.forEach((item, index) => {
              const segment = this.parseTimeRange(item.timeRange);
              if (segment) {
                const label = item.label ? `${sectionName} - ${item.label}` : sectionName;
                segment.label = label;
                this.segments.push(segment);
                added++;
              } else {
                errors.push(`${sectionName} - ${item.timeRange}: 时间格式错误`);
              }
            });
          });

          this.showMessage(`YAML格式解析成功，已添加 ${added} 个片段`, 'success');
        } catch (err) {
          console.error('YAML解析错误:', err);
          this.showMessage('YAML格式解析失败', 'error');
        }
      } else {
        // 解析简单文本格式：每行一个 01:16-01:21 标签
        const lines = text.split('\n');

        lines.forEach((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          const timeRangeMatch = trimmed.match(/(\d{1,2}:\d{2}(?::\d{2})?-\d{1,2}:\d{2}(?::\d{2})?)\s*(.+)?/);
          if (timeRangeMatch) {
            const timeRange = timeRangeMatch[1];
            const label = timeRangeMatch[2] ? timeRangeMatch[2].trim() : '';

            const segment = this.parseTimeRange(timeRange);
            if (segment) {
              if (label) segment.label = label;
              this.segments.push(segment);
              added++;
            } else {
              errors.push(`第${i+1}行时间格式错误: ${line}`);
            }
          } else {
            errors.push(`第${i+1}行格式错误: ${line}`);
          }
        });

        this.showMessage(`简单格式解析成功，已添加 ${added} 个片段`, 'success');
      }

      this.renderUI();

      if (errors.length > 0) {
        console.error('解析错误:', errors);
        this.showMessage(`${errors.length} 个格式错误，已跳过无效行`, 'warning');
      }
    }
    
    // 从批量输入替换所有片段
    replaceSegmentsFromBatch() {
      if (!this.uiElement) return;
      
      const batchInput = this.uiElement.querySelector('#batchInput');
      if (!batchInput) return;
      
      const text = batchInput.value.trim();
      if (!text) {
        this.showMessage('请输入时间片段', 'error');
        return;
      }
      
      this.segments = [];
      this.addSegmentsFromBatch();
    }
    
    // 更新片段
    updateSegmentFromInput(index, className, value) {
      if (index < 0 || index >= this.segments.length) return;
      
      if (className.includes('segment-start')) {
        const start = this.parseTimeStr(value);
        if (!isNaN(start)) {
          this.segments[index].start = start;
        }
      } else if (className.includes('segment-end')) {
        const end = this.parseTimeStr(value);
        if (!isNaN(end)) {
          this.segments[index].end = end;
        }
      } else if (className.includes('segment-label')) {
        this.segments[index].label = value;
      }
      
      this.updateUI();
    }
    
    // 删除片段
    removeSegment(index) {
      if (index >= 0 && index < this.segments.length) {
        this.segments.splice(index, 1);
        if (this.currentSegment >= this.segments.length) {
          this.currentSegment = Math.max(0, this.segments.length - 1);
        }
        this.renderUI();
        this.showMessage('片段已删除', 'info');
      }
    }
    
    // 显示快速添加菜单
    showQuickAddMenu() {
      if (!this.currentVideo || !this.currentVideo.duration) {
        this.showMessage('视频未加载完成', 'error');
        return;
      }
      
      const duration = this.currentVideo.duration;
      const menu = document.createElement('div');
      menu.style.cssText = `
        position: absolute;
        background: rgba(0,0,0,0.95);
        border: 1px solid #4CAF50;
        border-radius: 4px;
        padding: 10px;
        z-index: 1000000;
        min-width: 200px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      
      menu.innerHTML = `
        <div style="margin-bottom: 8px; color: #4CAF50; font-weight: bold;">快速添加</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px;">
          <button class="btn btn-small quick-add-btn" data-interval="5">每5秒</button>
          <button class="btn btn-small quick-add-btn" data-interval="10">每10秒</button>
          <button class="btn btn-small quick-add-btn" data-interval="30">每30秒</button>
          <button class="btn btn-small quick-add-btn" data-interval="60">每60秒</button>
        </div>
        <div style="display: flex; gap: 5px;">
          <input type="number" id="quickInterval" placeholder="间隔(秒)" 
                 style="flex: 1; padding: 5px; background: rgba(255,255,255,0.1); color: white; border: 1px solid #444; border-radius: 3px;">
          <button class="btn btn-small" id="quickAddCustomBtn">自定义</button>
        </div>
        <div style="font-size: 10px; color: #aaa; margin-top: 8px;">
          视频时长: ${duration.toFixed(1)}秒
        </div>
      `;
      
      const quickAddBtn = this.uiElement.querySelector('#quickAddBtn');
      const rect = quickAddBtn.getBoundingClientRect();
      menu.style.left = (rect.left - 200) + 'px';
      menu.style.top = (rect.top - 150) + 'px';
      
      menu.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const interval = parseInt(e.target.dataset.interval);
          this.addSegmentsByInterval(interval);
          menu.remove();
        });
      });
      
      menu.querySelector('#quickAddCustomBtn').addEventListener('click', () => {
        const input = menu.querySelector('#quickInterval');
        const interval = parseInt(input.value);
        if (interval > 0) {
          this.addSegmentsByInterval(interval);
          menu.remove();
        }
      });
      
      // 点击外部关闭
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== quickAddBtn) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
      
      document.body.appendChild(menu);
    }
    
    // 按间隔添加片段
    addSegmentsByInterval(interval) {
      if (!this.currentVideo || !this.currentVideo.duration) return;
      
      const duration = this.currentVideo.duration;
      const segmentLength = 5; // 每个片段5秒
      
      this.segments = [];
      for (let time = 0; time < duration - segmentLength; time += interval) {
        const start = time;
        const end = Math.min(time + segmentLength, duration);
        this.segments.push({
          start,
          end,
          label: `片段${Math.floor(time/interval)+1}`
        });
      }
      
      this.renderUI();
      this.showMessage(`已添加 ${this.segments.length} 个片段，间隔${interval}秒`, 'success');
    }
    
    // 显示消息
    showMessage(message, type = 'info') {
      const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3',
        warning: '#ff9800'
      };
      
      const messageEl = document.createElement('div');
      messageEl.textContent = message;
      messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 999999;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      
      document.body.appendChild(messageEl);
      
      setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => messageEl.remove(), 300);
      }, 3000);
      
      // 添加动画样式
      if (!document.querySelector('#message-animations')) {
        const style = document.createElement('style');
        style.id = 'message-animations';
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // 切换最小化状态
    toggleMinimize() {
      if (!this.uiElement) return;

      const mainContent = this.uiElement.querySelector('#mainContent');
      const minimizedContent = this.uiElement.querySelector('#minimizedContent');
      const minimizeBtn = this.uiElement.querySelector('#minimizeBtn');

      if (this.uiElement.classList.contains('minimized-ui')) {
        // 展开UI
        this.uiElement.classList.remove('minimized-ui');
        mainContent.style.display = 'block';
        minimizedContent.style.display = 'none';
        minimizeBtn.textContent = '📐';
        minimizeBtn.title = '缩小';
      } else {
        // 最小化UI
        this.uiElement.classList.add('minimized-ui');
        mainContent.style.display = 'none';
        minimizedContent.style.display = 'block';
        minimizeBtn.textContent = '📖';
        minimizeBtn.title = '展开';
      }
    }

    // 更新UI
    updateUI() {
      this.renderUI();
    }

    // 更新时间显示
    updateTimeDisplay() {
      if (!this.uiElement || !this.currentVideo) return;

      const timeDisplay = this.uiElement.querySelector('#currentTimeDisplay');
      if (timeDisplay) {
        timeDisplay.textContent = this.formatTime(this.currentVideo.currentTime || 0);
      }
    }

    // 复制当前时间
    copyCurrentTime() {
      if (!this.currentVideo) {
        this.showMessage('没有可用的视频元素', 'error');
        return;
      }

      const currentTime = this.formatTime(this.currentVideo.currentTime || 0);
      navigator.clipboard.writeText(currentTime).then(() => {
        this.showMessage(`已复制时间: ${currentTime}`, 'success');
      }).catch(() => {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = currentTime;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showMessage(`已复制时间: ${currentTime}`, 'success');
      });
    }
    
    // 移除UI
    removeUI() {
      if (this.uiElement) {
        this.uiElement.remove();
        this.uiElement = null;
        this.uiInitialized = false;
        console.log('🔴 播放器UI已关闭，可在控制台使用 window._videoSegmentPlayer 访问');
      }
    }
    
    // 简单的YAML解析器
    parseSimpleYAML(yamlText) {
      const lines = yamlText.split('\n');
      const result = {};
      let currentSection = null;
      let currentList = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        // 检查是否是节标题（不以空格开头，以冒号结尾）
        if (!line.startsWith(' ') && trimmed.endsWith(':')) {
          // 保存上一个节
          if (currentSection && currentList.length > 0) {
            result[currentSection] = currentList;
          }
          currentSection = trimmed.slice(0, -1); // 移除冒号
          currentList = [];
          return;
        }

        // 检查是否是列表项（以空格和-开头）
        if (line.match(/^\s*-\s*/)) {
          const item = trimmed.replace(/^\s*-\s*/, '');

          // 解析时间范围和标签
          const timeRangeMatch = item.match(/(\d{1,2}:\d{2}(?::\d{2})?-\d{1,2}:\d{2}(?::\d{2})?)\s*(.+)?/);
          if (timeRangeMatch) {
            const timeRange = timeRangeMatch[1];
            const label = timeRangeMatch[2] ? timeRangeMatch[2].trim() : '';

            currentList.push({
              timeRange,
              label
            });
          }
        }
      });

      // 保存最后一个节
      if (currentSection && currentList.length > 0) {
        result[currentSection] = currentList;
      }

      return result;
    }

    // 绑定全局事件
    bindGlobalEvents() {
      // 监听页面变化，检测新视频
      const observer = new MutationObserver((mutations) => {
        const newVideos = document.querySelectorAll('video');
        if (newVideos.length > this.videos.length) {
          this.findVideos();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      this.eventListeners.push({ type: 'observer', value: observer });

      // 添加视频时间更新监听器
      if (this.currentVideo) {
        this.setupTimeUpdateListener();
      }
    }

    // 设置时间更新监听器
    setupTimeUpdateListener() {
      if (!this.currentVideo) return;

      const handleTimeUpdate = () => {
        this.updateTimeDisplay();
      };

      this.currentVideo.addEventListener('timeupdate', handleTimeUpdate);

      // 保存监听器以便清理
      this.eventListeners.push({
        type: 'videoTimeUpdate',
        target: this.currentVideo,
        handler: handleTimeUpdate
      });
    }
    
    // 将时间字符串转换为秒
    parseTimeStr(timeStr) {
      if (!timeStr || typeof timeStr !== 'string') return NaN;
      
      // 支持格式: "00:01:30.5" 或 "01:30" 或 "90.5"
      const parts = timeStr.split(':').map(part => parseFloat(part));
      
      if (parts.length === 3) {
        // 时:分:秒
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        // 分:秒
        return parts[0] * 60 + parts[1];
      } else if (parts.length === 1) {
        // 秒
        return parts[0];
      }
      
      return NaN;
    }
    
    // 将秒转换为时间字符串
    formatTime(seconds) {
      if (isNaN(seconds)) return "00:00";
      
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hrs > 0) {
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }
    
    // 解析时间段字符串
    parseTimeRange(rangeStr) {
      // 格式: "00:01-00:05" 或 "00:01:10-00:01:20"
      const match = rangeStr.match(/([\d:.]+)-([\d:.]+)/);
      if (!match) {
        console.error('❌ 时间格式错误，应为: "00:01-00:05"');
        return null;
      }
      
      const start = this.parseTimeStr(match[1]);
      const end = this.parseTimeStr(match[2]);
      
      if (isNaN(start) || isNaN(end)) {
        console.error('❌ 时间格式错误');
        return null;
      }
      
      if (start >= end) {
        console.error('❌ 开始时间必须小于结束时间');
        return null;
      }
      
      return { start, end };
    }
    
    // 添加播放片段
    addSegment(rangeStr, label = '') {
      const segment = this.parseTimeRange(rangeStr);
      if (!segment) return false;
      
      if (label) {
        segment.label = label;
      }
      
      this.segments.push(segment);
      this.updateUI();
      return true;
    }
    
    // 清除所有片段
    clearSegments() {
      this.segments = [];
      this.currentSegment = 0;
      this.stop();
      this.updateUI();
      this.showMessage('已清除所有片段', 'info');
    }
    
    // 播放片段
    playSegments(rangeStrings = null) {
      if (!this.currentVideo) {
        this.showMessage('没有可用的视频元素', 'error');
        return;
      }
      
      // 如果提供了新的片段列表，替换当前片段
      if (rangeStrings && Array.isArray(rangeStrings)) {
        this.segments = [];
        let allValid = true;
        
        rangeStrings.forEach(rangeStr => {
          if (!this.addSegment(rangeStr)) {
            allValid = false;
          }
        });
        
        if (!allValid) {
          this.showMessage('部分片段格式错误，播放取消', 'error');
          return;
        }
      }
      
      if (this.segments.length === 0) {
        this.showMessage('没有设置播放片段', 'error');
        return;
      }
      
      this.currentSegment = 0;
      this.playCurrentSegment();
    }
    
    // 播放单个片段
    playSingleSegment(index) {
      if (index < 0 || index >= this.segments.length) {
        this.showMessage('无效的片段索引', 'error');
        return;
      }
      
      this.currentSegment = index;
      this.playCurrentSegment();
    }
    
    // 播放当前片段
    playCurrentSegment() {
      if (this.currentSegment >= this.segments.length) {
        this.showMessage('所有片段播放完毕', 'success');
        this.isPlaying = false;
        this.updateUI();
        return;
      }
      
      const segment = this.segments[this.currentSegment];
      
      if (!this.currentVideo) {
        this.showMessage('视频元素不存在', 'error');
        return;
      }
      
      // 确保视频已加载
      if (this.currentVideo.readyState < 2) {
        this.showMessage('视频加载中...', 'info');
        this.currentVideo.load();
        
        const onLoaded = () => {
          this.currentVideo.removeEventListener('loadeddata', onLoaded);
          this.startSegmentPlayback(segment);
        };
        
        this.currentVideo.addEventListener('loadeddata', onLoaded);
      } else {
        this.startSegmentPlayback(segment);
      }
    }
    
    // 开始播放片段
    startSegmentPlayback(segment) {
      this.isPlaying = true;
      
      // 跳转到片段开始
      this.currentVideo.currentTime = segment.start;
      this.showMessage(`播放片段 ${this.currentSegment + 1}/${this.segments.length}: ${this.formatTime(segment.start)} - ${this.formatTime(segment.end)}`, 'info');
      
      // 开始播放
      const playPromise = this.currentVideo.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('❌ 播放失败:', error);
          this.showMessage('播放失败: 需要用户交互', 'error');
        });
      }
      
      // 设置结束检查
      this.setupEndCheck(segment);
      this.updateUI();
    }
    
    // 设置结束检查
    setupEndCheck(segment) {
      // 清除之前的检查
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      
      // 设置定时检查
      this.intervalId = setInterval(() => {
        if (!this.currentVideo || !this.isPlaying) {
          clearInterval(this.intervalId);
          return;
        }
        
        const currentTime = this.currentVideo.currentTime;
        
        if (this.debugMode) {
          console.log(`⏱️ 当前时间: ${this.formatTime(currentTime)} / 结束: ${this.formatTime(segment.end)}`);
        }
        
        // 检查是否到达片段结束
        if (currentTime >= segment.end - 0.1) { // 提前0.1秒切换到下一个片段
          clearInterval(this.intervalId);
          
          const autoPlayNext = this.uiElement && this.uiElement.querySelector('#autoPlayNext') ?
            this.uiElement.querySelector('#autoPlayNext').checked : true;
          
          if (autoPlayNext && this.currentSegment < this.segments.length - 1) {
            this.currentSegment++;
            setTimeout(() => this.playCurrentSegment(), 100);
          } else {
            this.showMessage('片段播放完成', 'success');
            this.isPlaying = false;
            this.currentVideo.pause();
            this.updateUI();
          }
        }
      }, 100); // 每100ms检查一次
    }
    
    // 播放下一个片段
    playNextSegment() {
      if (this.currentSegment < this.segments.length - 1) {
        this.currentSegment++;
        this.playCurrentSegment();
      } else {
        this.showMessage('已经是最后一个片段', 'info');
      }
    }
    
    // 播放上一个片段
    playPreviousSegment() {
      if (this.currentSegment > 0) {
        this.currentSegment--;
        this.playCurrentSegment();
      } else {
        this.showMessage('已经是第一个片段', 'info');
      }
    }
    
    // 停止播放
    stop() {
      this.isPlaying = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      if (this.currentVideo) {
        this.currentVideo.pause();
      }
      
      this.updateUI();
      this.showMessage('播放已停止', 'info');
    }
    
    // 选择视频
    setVideo(index) {
      if (index >= 0 && index < this.videos.length) {
        // 清理旧视频的事件监听器
        this.cleanupVideoListeners();

        this.currentVideo = this.videos[index];
        this.setupTimeUpdateListener();
        this.updateUI();
        this.showMessage(`已切换到视频 ${index}`, 'success');
      } else {
        this.showMessage(`无效的视频索引，有效范围: 0-${this.videos.length-1}`, 'error');
      }
    }

    // 清理视频相关的事件监听器
    cleanupVideoListeners() {
      this.eventListeners = this.eventListeners.filter(listener => {
        if (listener.type === 'videoTimeUpdate' && listener.target) {
          listener.target.removeEventListener('timeupdate', listener.handler);
          return false;
        }
        return true;
      });
    }
    
    // 导出YAML配置
    exportConfig() {
      let yaml = "# 视频片段配置\n";
      yaml += `# 当前片段: ${this.currentSegment}\n`;
      yaml += `# 自动播放: ${this.uiElement?.querySelector('#autoPlayNext')?.checked ? true : false}\n`;
      yaml += `# 调试模式: ${this.uiElement?.querySelector('#debugMode')?.checked ? true : false}\n\n`;

      if (this.segments.length > 0) {
        // 按分组整理片段
        const groups = {};

        this.segments.forEach((segment, index) => {
          let groupName = '默认分组';

          if (segment.label) {
            // 如果标签包含 " - "，提取分组名
            const parts = segment.label.split(' - ');
            if (parts.length > 1) {
              groupName = parts[0];
            }
          }

          if (!groups[groupName]) {
            groups[groupName] = [];
          }

          const timeRange = `${this.formatTime(segment.start)}-${this.formatTime(segment.end)}`;
          const itemLabel = segment.label.includes(' - ') ?
            segment.label.split(' - ').slice(1).join(' - ') :
            (segment.label || '');

          groups[groupName].push({
            timeRange,
            label: itemLabel
          });
        });

        // 生成YAML
        Object.entries(groups).forEach(([groupName, items]) => {
          yaml += `${groupName}:\n`;
          items.forEach(item => {
            if (item.label) {
              yaml += `  - ${item.timeRange} ${item.label}\n`;
            } else {
              yaml += `  - ${item.timeRange}\n`;
            }
          });
          yaml += '\n';
        });
      } else {
        yaml += "默认分组:\n  # 暂无片段\n";
      }

      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video-segments.yaml';
      a.click();
      URL.revokeObjectURL(url);

      this.showMessage('YAML配置已导出', 'success');
    }

    // 导入YAML配置
    importConfig() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const yamlText = e.target.result;
            const yamlData = this.parseSimpleYAML(yamlText);

            this.segments = [];

            Object.entries(yamlData).forEach(([sectionName, items]) => {
              items.forEach((item, index) => {
                const segment = this.parseTimeRange(item.timeRange);
                if (segment) {
                  const label = item.label ? `${sectionName} - ${item.label}` : sectionName;
                  segment.label = label;
                  this.segments.push(segment);
                }
              });
            });

            this.currentSegment = 0;
            this.updateUI();
            this.showMessage(`YAML配置导入成功，共导入 ${this.segments.length} 个片段`, 'success');
          } catch (err) {
            this.showMessage('YAML文件格式错误', 'error');
            console.error('导入YAML配置错误:', err);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
    
    // 清理
    cleanup() {
      this.stop();

      if (this.uiElement) {
        this.uiElement.remove();
      }

      // 清理所有事件监听器
      this.cleanupVideoListeners();

      this.eventListeners.forEach(listener => {
        if (listener.type === 'observer' && listener.value) {
          listener.value.disconnect();
        }
      });

      this.eventListeners = [];
      console.log('🧹 视频片段播放器已清理');
    }
  }
  
  // 创建全局函数（保持向后兼容）
  window.playSegments = function(rangeStrings) {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.playSegments(rangeStrings);
  };
  
  window.setVideo = function(index) {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.setVideo(index);
  };
  
  window.showVideos = function() {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.showVideos();
  };
  
  window.addSegment = function(rangeStr) {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.addSegment(rangeStr);
  };
  
  window.clearSegments = function() {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.clearSegments();
  };
  
  window.playNext = function() {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.playNextSegment();
  };
  
  window.stop = function() {
    if (!window._videoSegmentPlayer) {
      console.error('❌ 视频片段播放器未初始化');
      return;
    }
    
    window._videoSegmentPlayer.stop();
  };
  
  window.help = function() {
    console.log(`
🎬 视频片段播放器 - 帮助指南
=============================
控制台命令 (向后兼容):
  playSegments(["00:01-00:05", "00:10-00:15"])
  addSegment("00:20-00:30")
  clearSegments()
  playNext()
  stop()
  setVideo(0)
  showVideos()

或直接在界面中操作!
    `);
  };
  
  // 初始化播放器
  new VideoSegmentPlayer();
  
  console.log(`
🎬 视频片段播放器已就绪!
========================
浮动控制面板已添加到页面右下角。

功能特性:
1. 可视化界面操作，无需记忆命令
2. 支持时间格式: 00:01-00:05 或 00:01:10-00:01:20
3. 片段可编辑，支持标签
4. 批量添加和快速添加功能
5. 配置导入/导出
6. 自动播放下一个片段
7. 调试模式

使用说明:
1. 在"添加片段"区域输入开始和结束时间
2. 点击"添加"按钮或按回车键
3. 在片段列表中可编辑、删除或单独播放
4. 使用"批量操作"区域批量添加
5. 点击"播放全部"开始播放
  `);
  
})();
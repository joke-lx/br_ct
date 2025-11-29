(function () {
  // 防止重复注入
  if (document.getElementById("ai-dom-visualizer-root")) {
    alert("监听面板已存在！");
    return;
  }

  // ==========================================================
  // 核心样式 (模拟 DevTools 暗色主题)
  // ==========================================================
  const STYLES = `
    #ai-dom-visualizer-root {
      position: fixed; top: 20px; right: 20px; width: 450px; height: 600px;
      background: #242424; color: #e8eaed; z-index: 2147483647;
      border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: flex; flex-direction: column; font-family: Consolas, "Courier New", monospace;
      font-size: 12px; border: 1px solid #444; overflow: hidden;
    }
    .dv-header {
      padding: 10px; background: #333; border-bottom: 1px solid #444;
      display: flex; justify-content: space-between; align-items: center;
    }
    .dv-btn {
      background: #0d6efd; border: none; color: white; padding: 4px 10px;
      border-radius: 4px; cursor: pointer; font-size: 11px;
    }
    .dv-btn:hover { background: #0b5ed7; }
    .dv-btn.danger { background: #dc3545; }
    .dv-split-pane {
      display: flex; flex-direction: column; height: 100%; overflow: hidden;
    }
    /* DOM Tree 区域 */
    .dv-tree-view {
      flex: 1; overflow-y: auto; padding: 10px; background: #202124;
      border-bottom: 1px solid #444;
    }
    .dv-tree-node {
      padding: 2px 0; white-space: nowrap; cursor: pointer; border-radius: 2px;
    }
    .dv-tree-node:hover { background: rgba(255,255,255,0.05); }
    .dv-tree-node.selected { background: #3c4043; outline: 1px solid #5f6368; }
    .dv-indent { display: inline-block; width: 14px; }
    /* 语法高亮 */
    .syn-tag { color: #569cd6; }
    .syn-attr { color: #9cdcfe; }
    .syn-val { color: #ce9178; }
    .syn-txt { color: #d4d4d4; }
    .syn-comment { color: #6a9955; }
    
    /* 日志区域 */
    .dv-logs-header {
      padding: 5px 10px; background: #2d2d2d; border-bottom: 1px solid #333;
      font-weight: bold; display: flex; justify-content: space-between;
    }
    .dv-logs {
      flex: 1; overflow-y: auto; background: #1e1e1e; padding: 5px;
    }
    .dv-log-item {
      padding: 6px; border-bottom: 1px solid #333; margin-bottom: 2px;
      border-left: 3px solid transparent; animation: fadeIn 0.3s;
    }
    .dv-log-item.type-attr { border-left-color: #e67e22; background: rgba(230, 126, 34, 0.1); }
    .dv-log-item.type-add { border-left-color: #2ecc71; background: rgba(46, 204, 113, 0.1); }
    .dv-log-item.type-rem { border-left-color: #e74c3c; background: rgba(231, 76, 60, 0.1); }
    .dv-log-item.type-char { border-left-color: #3498db; background: rgba(52, 152, 219, 0.1); }
    
    .dv-log-time { color: #888; margin-right: 8px; }
    .dv-log-detail { margin-top: 4px; color: #bbb; word-break: break-all; }
    
    /* 动画 */
    @keyframes flash-bg { 0% { background: #444; } 100% { background: transparent; } }
    .node-changed { animation: flash-bg 1s ease-out; }
  `;

  // ==========================================================
  // 全局状态
  // ==========================================================
  let state = {
    target: null,         // 实际监听的 DOM 根节点
    observer: null,       // MutationObserver 实例
    nodeMap: new Map(),   // Real DOM Node -> UI DOM Element (WeakMap logic implemented manually)
    filterNode: null,     // 当前筛选的 Real DOM Node (为 null 时显示所有)
    isPicking: false,
    hoveredEl: null
  };

  // ==========================================================
  // 辅助：DOM 操作与语法高亮生成
  // ==========================================================
  function create(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  }

  // 生成类似 DevTools 的 HTML 字符串表示
  function renderNodeHTML(node) {
    const wrapper = create('div', 'dv-tree-node');
    
    // 1. 文本节点
    if (node.nodeType === 3) {
      const txt = node.textContent.trim();
      if (!txt) return null; // 忽略纯空文本
      const span = create('span', 'syn-txt', `"${txt}"`);
      wrapper.appendChild(span);
      return wrapper;
    }

    // 2. 元素节点
    if (node.nodeType === 1) {
      const tagOpen = create('span', 'syn-tag', `<${node.tagName.toLowerCase()}`);
      wrapper.appendChild(tagOpen);

      // 属性
      Array.from(node.attributes).forEach(attr => {
        wrapper.appendChild(document.createTextNode(' '));
        const attrName = create('span', 'syn-attr', attr.name);
        const eq = document.createTextNode('=');
        const val = create('span', 'syn-val', `"${attr.value}"`);
        wrapper.appendChild(attrName);
        wrapper.appendChild(eq);
        wrapper.appendChild(val);
      });

      const tagClose = create('span', 'syn-tag', `>`);
      wrapper.appendChild(tagClose);
      return wrapper;
    }
    
    return null;
  }

  // ==========================================================
  // 核心逻辑：可视化树构建器
  // ==========================================================
  function buildVisualTree(rootRealNode, container, depth = 0) {
    container.innerHTML = '';
    
    function traverse(realNode, parentUI, level) {
      const uiNode = renderNodeHTML(realNode);
      if (!uiNode) return;

      // 缩进
      uiNode.style.paddingLeft = `${level * 15}px`;
      
      // 绑定交互事件
      uiNode.onclick = (e) => {
        e.stopPropagation();
        setFilter(realNode, uiNode);
      };
      uiNode.onmouseover = (e) => {
        e.stopPropagation();
        highlightRealDOM(realNode);
      };
      uiNode.onmouseout = () => removeHighlight();

      // 存储映射关系：RealNode -> UI Element
      state.nodeMap.set(realNode, uiNode);
      parentUI.appendChild(uiNode);

      // 递归子节点
      if (realNode.childNodes && realNode.childNodes.length > 0) {
        // 如果子节点太多，或者是纯文本，就不换行缩进太多(简化版逻辑)
        realNode.childNodes.forEach(child => traverse(child, parentUI, level + 1));
        
        // 闭合标签 (仅对元素)
        if (realNode.nodeType === 1) {
           const closeTag = create('div', 'dv-tree-node');
           closeTag.style.paddingLeft = `${level * 15}px`;
           closeTag.innerHTML = `<span class="syn-tag">&lt;/${realNode.tagName.toLowerCase()}&gt;</span>`;
           parentUI.appendChild(closeTag);
        }
      }
    }

    traverse(rootRealNode, container, depth);
  }

  // 刷新整个可视化树（当结构发生大变化时调用）
  function refreshVisualTree() {
    if (!state.target) return;
    const container = document.getElementById('dv-tree-container');
    // 保持滚动位置
    const scrollTop = container.scrollTop;
    state.nodeMap.clear();
    buildVisualTree(state.target, container);
    container.scrollTop = scrollTop;
  }

  // ==========================================================
  // 逻辑：筛选与高亮
  // ==========================================================
  function setFilter(realNode, uiNode) {
    // 移除之前的选中状态
    document.querySelectorAll('.dv-tree-node.selected').forEach(el => el.classList.remove('selected'));
    
    if (state.filterNode === realNode) {
      // 取消筛选
      state.filterNode = null;
      document.getElementById('dv-filter-status').textContent = '全部日志';
      renderLogs(); // 重绘所有日志
    } else {
      // 设置筛选
      state.filterNode = realNode;
      uiNode.classList.add('selected');
      const tagName = realNode.nodeType === 1 ? realNode.tagName.toLowerCase() : '#text';
      document.getElementById('dv-filter-status').textContent = `🔍 仅追踪: <${tagName}>`;
      renderLogs(); // 仅重绘相关日志
    }
  }

  function highlightRealDOM(node) {
    if (node.nodeType === 1) {
      node.style.outline = "2px dashed #0d6efd";
      node.style.boxShadow = "0 0 10px rgba(13, 110, 253, 0.5)";
    }
  }

  function removeHighlight() {
    if (state.target) {
        // 粗暴清除所有 outline，实际生产中应记录原始 style
        // 这里为了演示简单，假设页面本身没有 outline
        const all = document.querySelectorAll('*');
        // 仅清除刚才高亮的（为了性能，这里简化处理，只依赖 mouseout）
        if(state.hoveredEl) {
             state.hoveredEl.style.outline = ""; 
             state.hoveredEl.style.boxShadow = "";
        }
    }
    // 强制清除当前所有选中框样式
    const nodes = document.querySelectorAll('*');
    for(let i=0; i<nodes.length; i++) {
        if(nodes[i].style.outline === "2px dashed rgb(13, 110, 253)") {
            nodes[i].style.outline = "";
            nodes[i].style.boxShadow = "";
        }
    }
  }

  // ==========================================================
  // 日志系统
  // ==========================================================
  const logs = []; // 存储结构: { time, type, node, desc, color }

  function addLog(type, node, desc) {
    const entry = {
      time: new Date().toLocaleTimeString().split(' ')[0],
      type: type, // 'attr', 'add', 'rem', 'char'
      node: node,
      desc: desc,
      id: Date.now() + Math.random()
    };
    logs.push(entry);
    
    // 如果日志太多，清理旧的
    if (logs.length > 500) logs.shift();

    // 如果当前没有筛选，或者筛选的目标是当前节点(或其父级/子级关系 - 这里简化为仅全等)
    // 为了更直观，如果筛选了某节点，我们只看该节点自身的变动
    if (!state.filterNode || state.filterNode === node) {
        appendLogToUI(entry);
    }

    // 视觉反馈：在树中闪烁该节点
    const uiNode = state.nodeMap.get(node);
    if (uiNode) {
        uiNode.classList.remove('node-changed');
        void uiNode.offsetWidth; // trigger reflow
        uiNode.classList.add('node-changed');
    }
  }

  function appendLogToUI(entry) {
    const container = document.getElementById('dv-logs-container');
    const el = create('div', `dv-log-item type-${entry.type}`);
    
    let typeName = '未知';
    if(entry.type === 'attr') typeName = '🔧 属性';
    if(entry.type === 'add') typeName = '🟢 新增';
    if(entry.type === 'rem') typeName = '🔴 移除';
    if(entry.type === 'char') typeName = '📝 文本';

    let nodeName = entry.node.nodeName.toLowerCase();
    if(entry.node.id) nodeName += `#${entry.node.id}`;
    else if(entry.node.className && typeof entry.node.className ==='string') nodeName += `.${entry.node.className.split(' ')[0]}`;

    el.innerHTML = `
      <div>
        <span class="dv-log-time">[${entry.time}]</span>
        <strong>${typeName}</strong> 
        <span style="opacity:0.7">&lt;${nodeName}&gt;</span>
      </div>
      <div class="dv-log-detail">${entry.desc}</div>
    `;
    
    container.prepend(el); // 最新的在最上面
  }

  function renderLogs() {
    const container = document.getElementById('dv-logs-container');
    container.innerHTML = '';
    // 重新渲染所有符合条件的日志
    logs.forEach(entry => {
      if (!state.filterNode || state.filterNode === entry.node) {
        appendLogToUI(entry);
      }
    });
  }

  // ==========================================================
  // 监听器逻辑
  // ==========================================================
  function startObserver(element) {
    if (state.observer) state.observer.disconnect();
    
    // 初始化可视化树
    refreshVisualTree();
    addLog('add', element, '开始监听目标元素...');

    state.observer = new MutationObserver((mutations) => {
      // 这里的逻辑需要防抖吗？为了实时性，暂时不做防抖，但要做结构刷新的节流
      let needsTreeRefresh = false;

      mutations.forEach((m) => {
        // 1. 属性变化
        if (m.type === 'attributes') {
           const oldVal = m.oldValue;
           const newVal = m.target.getAttribute(m.attributeName);
           if (oldVal !== newVal) {
             addLog('attr', m.target, `${m.attributeName}: "${oldVal}" ➔ "${newVal}"`);
             // 属性变化不需要重绘整个树，只需要更新节点显示（简单起见，这里触发树刷新可能太重，但为了保持 UI 一致性...）
             // 优化：仅更新对应 UI 节点的 class/style 有点复杂，为了演示效果，我们选择全部刷新
             // 更好的做法是精细更新，但这里为了代码体积，我们标记需要刷新
             needsTreeRefresh = true;
           }
        }
        
        // 2. 文本变化
        else if (m.type === 'characterData') {
            addLog('char', m.target, `内容变更为: "${m.target.textContent.trim().slice(0,20)}..."`);
            needsTreeRefresh = true;
        }

        // 3. 子节点变化
        else if (m.type === 'childList') {
            if (m.addedNodes.length > 0) {
                m.addedNodes.forEach(node => {
                    addLog('add', node, `被插入到 <${m.target.nodeName.toLowerCase()}>`);
                });
            }
            if (m.removedNodes.length > 0) {
                m.removedNodes.forEach(node => {
                    addLog('rem', node, `从 <${m.target.nodeName.toLowerCase()}> 被移除`);
                });
            }
            needsTreeRefresh = true;
        }
      });

      if (needsTreeRefresh) {
          // 稍微延迟一下以避免高频闪烁，或者直接刷新
          // 为了流畅度，这里直接刷新
          refreshVisualTree();
      }
    });

    state.observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeOldValue: true
    });
  }

  // ==========================================================
  // 交互：选取元素
  // ==========================================================
  function togglePicker() {
    if (state.isPicking) {
      stopPicking();
    } else {
      startPicking();
    }
  }

  function startPicking() {
    state.isPicking = true;
    document.body.style.cursor = 'crosshair';
    document.getElementById('dv-btn-pick').textContent = '取消选择';
    document.getElementById('dv-btn-pick').classList.add('danger');
    
    document.addEventListener('mouseover', pickerHover);
    document.addEventListener('click', pickerClick, true);
  }

  function stopPicking() {
    state.isPicking = false;
    document.body.style.cursor = '';
    document.getElementById('dv-btn-pick').textContent = '🎯 选取目标';
    document.getElementById('dv-btn-pick').classList.remove('danger');
    
    if (state.hoveredEl) state.hoveredEl.style.outline = '';
    document.removeEventListener('mouseover', pickerHover);
    document.removeEventListener('click', pickerClick, true);
  }

  function pickerHover(e) {
    if (document.getElementById('ai-dom-visualizer-root').contains(e.target)) return;
    if (state.hoveredEl) state.hoveredEl.style.outline = '';
    state.hoveredEl = e.target;
    state.hoveredEl.style.outline = '2px solid #0d6efd';
  }

  function pickerClick(e) {
    if (document.getElementById('ai-dom-visualizer-root').contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    
    state.target = e.target;
    stopPicking();
    
    // 更新状态栏
    const desc = `<${state.target.tagName.toLowerCase()}.${Array.from(state.target.classList).join('.')}>`;
    document.getElementById('dv-target-name').textContent = desc;
    
    // 启动监听
    startObserver(state.target);
  }

  // ==========================================================
  // 初始化 UI 面板
  // ==========================================================
  function init() {
    // 注入样式
    const styleTag = document.createElement('style');
    styleTag.textContent = STYLES;
    document.head.appendChild(styleTag);

    // 创建面板结构
    const root = create('div', '', '');
    root.id = 'ai-dom-visualizer-root';
    
    root.innerHTML = `
      <div class="dv-header">
        <span style="font-weight:bold; color:#fff;">👁️ DOM 深度透视镜</span>
        <button id="dv-close-btn" style="background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:10px; background:#2d2d2d; border-bottom:1px solid #444; display:flex; gap:10px; align-items:center;">
        <button id="dv-btn-pick" class="dv-btn">🎯 选取目标</button>
        <span id="dv-target-name" style="color:#888; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">未选择...</span>
      </div>
      
      <div class="dv-split-pane">
        <!-- 上半部分：DOM 树 -->
        <div class="dv-tree-view" id="dv-tree-container">
            <div style="color:#666; text-align:center; padding-top:20px;">请先选取页面上的元素</div>
        </div>
        
        <!-- 下半部分：日志 -->
        <div class="dv-logs-header">
            <span id="dv-filter-status">全部日志</span>
            <span style="font-weight:normal; font-size:10px; cursor:pointer; color:#569cd6;" onclick="document.getElementById('dv-logs-container').innerHTML='';">清空</span>
        </div>
        <div class="dv-logs" id="dv-logs-container">
            <!-- Logs go here -->
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // 绑定基础事件
    document.getElementById('dv-btn-pick').onclick = togglePicker;
    document.getElementById('dv-close-btn').onclick = () => {
      if (state.observer) state.observer.disconnect();
      stopPicking();
      root.remove();
      styleTag.remove();
    };

    console.log("%c DOM 深度透视镜已加载。", "color: #0d6efd; font-size: 14px; font-weight: bold;");
  }

  init();

})();
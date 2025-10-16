/**
 * 实时资源选择器 (Resource Picker) 类。
 * 将所有 UI 元素、状态和事件处理逻辑封装在一起，提高可维护性。
 */
class ResourcePicker {
    constructor() {
        this.isLocked = false;
        this.currentElement = null;
        this.htmlId = 'target-element-html-content';

        // 1. UI 元素初始化
        this.overlay = this._createOverlay();
        this.tooltip = this._createTooltip();
        this.container = this._createContainer();

        // 2. 启动事件监听
        this._startPicking();

        console.log("实时资源嗅探已启动 (零资源时显示 HTML 结构)");
        // 暴露清理方法，以便外部脚本可以停止工具
        window.__pickerCleanup = this.cleanup.bind(this);
    }

    // --- 辅助 UI 创建方法 ---

    _createOverlay() {
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "absolute",
            border: "2px solid red",
            background: "rgba(255,0,0,0.1)",
            pointerEvents: "none",
            zIndex: "999999"
        });
        document.body.appendChild(overlay);
        return overlay;
    }

    _createTooltip() {
        const tooltip = document.createElement("div");
        Object.assign(tooltip.style, {
            position: "fixed",
            background: "black",
            color: "white",
            fontSize: "12px",
            padding: "2px 6px",
            borderRadius: "3px",
            zIndex: "1000000",
            pointerEvents: "none"
        });
        document.body.appendChild(tooltip);
        return tooltip;
    }

    _createContainer() {
        const container = document.createElement("div");
        Object.assign(container.style, {
            position: "fixed",
            top: "10px",
            right: "10px",
            width: "300px",
            maxHeight: "90%",
            overflowY: "auto",
            background: "rgba(255, 255, 215, 0.95)",
            border: "1px solid #ccc",
            padding: "10px",
            zIndex: "1000001",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontFamily: "sans-serif",
            display: "block",
            userSelect: "text"
        });
        document.body.appendChild(container);
        return container;
    }

    // --- 核心工具方法 ---

    /**
     * 将 URL 转换为绝对 URL 或处理 Data URI
     */
    _addResource(set, url) {
        if (url && typeof url === 'string' && url.trim().length > 0) {
            if (url.startsWith('data:')) {
                const typeMatch = url.match(/^data:([^;,]+)/);
                const type = typeMatch ? typeMatch[1] : 'unknown';
                const sizeKB = Math.ceil((url.length * 0.75) / 1024);
                set.add(`[DATA URI] Type: ${type}, Size: ${sizeKB} KB`);
            } else {
                set.add(new URL(url, window.location.href).href);
            }
        }
    }

    /**
     * 嗅探当前元素及其子元素中的资源
     */
    _gatherResources(element) {
        const resources = {
            images: new Set(),
            links: new Set(),
            media: new Set(),
            other: new Set()
        };
        if (!element) return { images: [], links: [], media: [], other: [] };

        // 收集所有 IMG 元素 (包括自身)
        const elementsToCheck = element.tagName === 'IMG' ? [element] : Array.from(element.querySelectorAll('img'));

        elementsToCheck.forEach(img => {
            this._addResource(resources.images, img.src);
            if (img.srcset) {
                img.srcset.split(',').forEach(part => {
                    this._addResource(resources.images, part.trim().split(/\s+/)[0]);
                });
            }
            const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-srcset');
            if (lazySrc) {
                if (lazySrc.includes(',')) {
                    lazySrc.split(',').forEach(part => {
                        this._addResource(resources.images, part.trim().split(/\s+/)[0]);
                    });
                } else {
                    this._addResource(resources.images, lazySrc);
                }
            }
        });

        element.querySelectorAll('video, audio').forEach(media => {
            this._addResource(resources.media, media.src);
        });
        element.querySelectorAll('source').forEach(source => {
            if (source.type && source.type.startsWith('image/')) {
                this._addResource(resources.images, source.srcset || source.src);
            } else {
                this._addResource(resources.media, source.src);
            }
        });

        element.querySelectorAll('a[href]').forEach(a => {
            this._addResource(resources.links, a.href);
        });

        element.querySelectorAll('link[href]').forEach(link => {
            const rel = link.getAttribute('rel');
            if (rel && (rel.includes('icon') || rel.includes('apple-touch-icon'))) {
                this._addResource(resources.images, link.href);
            } else if (rel && rel !== 'stylesheet') {
                this._addResource(resources.other, `[LINK:${rel}] ${link.href}`);
            }
        });

        return {
            images: Array.from(resources.images),
            links: Array.from(resources.links),
            media: Array.from(resources.media),
            other: Array.from(resources.other)
        };
    }

    /**
     * 检查资源是否为空
     */
    _hasNoResources(resources) {
        return (
            resources.images.length === 0 &&
            resources.links.length === 0 &&
            resources.media.length === 0 &&
            resources.other.length === 0
        );
    }

    /**
     * 对 HTML 代码进行简单的格式化，以便于阅读
     * 保持与原代码中格式化逻辑的一致性，使用四个空格缩进
     */
    _formatHTML(html) {
        let result = '';
        let indent = 0;
        const INDENT_SPACES = '    '; 
        
        const tokens = html.match(/<(?:\w+|[^>]+)>/g) || [];
        let lastIndex = 0;

        tokens.forEach(token => {
            const textContent = html.substring(lastIndex, html.indexOf(token, lastIndex)).trim();
            if (textContent.length > 0) {
                if (result.length > 0 && result.slice(-1) !== '\n') {
                     result += '\n' + INDENT_SPACES.repeat(indent);
                }
                result += textContent;
            }

            if (token.startsWith('</')) { 
                indent--;
                result += '\n' + INDENT_SPACES.repeat(indent) + token;
            } else if (token.endsWith('/>') || token.endsWith('-->')) { 
                result += '\n' + INDENT_SPACES.repeat(indent) + token;
            } else if (token.startsWith('<')) { 
                if (result.length > 0 && !result.endsWith('\n')) {
                    result += '\n';
                }
                result += INDENT_SPACES.repeat(indent) + token;
                indent++;
            }
            lastIndex = html.indexOf(token, lastIndex) + token.length;
        });
        
        const remainingText = html.substring(lastIndex).trim();
        if (remainingText.length > 0) {
             if (result.length > 0 && !result.endsWith('\n')) {
                result += '\n' + INDENT_SPACES.repeat(indent);
            }
            result += remainingText;
        }

        return result.trim().replace(/\n\s*\n/g, '\n');
    }

    // --- UI 渲染方法 ---

    /**
     * 生成资源列表的 HTML 并更新容器 (预览模式)
     */
    _createResourceListHTML(resources) {
        let html = '<h2 style="font-size: 16px; margin: 0 0 10px 0;">资源嗅探结果</h2>';

        const buttonText = this.isLocked ? "✅ 已锁定 (点击解锁)" : "🖱️ 实时预览 (点击锁定)";
        const buttonStyle = this.isLocked ? "background: #4CAF50; color: white;" : "background: #f0f0f0;";
        html += `<button id="toggle-resource-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; ${buttonStyle}">${buttonText}</button>`;
        html += `<button id="close-all-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #dc3545; color: white;">完全关闭</button>`;


        if (this._hasNoResources(resources) && this.currentElement) {
            html += `<h3 style="font-size: 14px; margin: 10px 0; color: #cc3300;">未检测到可下载资源。</h3>`;
            html += `<p style="font-size: 12px; color: #666;">点击锁定后将显示该元素的**格式化原始 HTML 结构**。</p>`;
        } else {
            const generateList = (title, items, limit) => {
                let listHtml = `<h3 style="font-size: 14px; margin: 5px 0;">${title} (${items.length})</h3>`;
                listHtml += `<ul style="list-style: none; padding: 0; margin: 0;">`;
                if (items.length === 0) {
                    listHtml += '<li style="color: #666; font-size: 12px;">未找到资源。</li>';
                } else {
                    items.slice(0, limit).forEach(url => {
                        const displayUrl = url.startsWith('[') ? url : (url.substring(url.lastIndexOf('/') + 1) || new URL(url).hostname);
                        listHtml += `<li style="font-size: 12px; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"><a href="${url.startsWith('[') ? '#' : url}" target="_blank" title="${url}" style="color: #007bff; text-decoration: none;">${displayUrl}</a></li>`;
                    });
                    if (items.length > limit) {
                        listHtml += `<li style="font-size: 12px; color: #999;">... 还有 ${items.length - limit} 个未显示。</li>`;
                    }
                }
                listHtml += '</ul>';
                return listHtml;
            };

            html += generateList('图片/图标', resources.images, 5);
            html += generateList('媒体', resources.media, 3);
            html += generateList('链接', resources.links, 5);
            html += generateList('其他资源', resources.other, 2);
        }

        this.container.innerHTML = html;
        this._bindButtonEvents();
    }

    // === 在 ResourcePicker 类里新增方法 ===
_generateSelectors(element) {
    if (!element) return {};

    // 1. CSS 选择器 (带唯一性)
    const getCssSelector = (el) => {
        if (el.id) return `#${el.id}`;
        if (el.className) {
            const classSelector = "." + el.className.trim().split(/\s+/).join(".");
            return `${el.tagName.toLowerCase()}${classSelector}`;
        }
        return el.tagName.toLowerCase();
    };

    // 2. JS 路径 (querySelector)
    const getJsPath = (el) => {
        let path = "";
        while (el && el.nodeType === 1 && el !== document.body) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += "#" + el.id;
                path = selector + (path ? " > " + path : "");
                break;
            } else {
                let sib = el, nth = 1;
                while (sib.previousElementSibling) {
                    sib = sib.previousElementSibling;
                    if (sib.nodeName === el.nodeName) nth++;
                }
                selector += `:nth-of-type(${nth})`;
            }
            path = selector + (path ? " > " + path : "");
            el = el.parentElement;
        }
        return "document.querySelector(\"" + path + "\")";
    };

    // 3. 简单 XPath
    const getXPath = (el) => {
        if (el.id) return `//*[@id="${el.id}"]`;
        if (el === document.body) return "/html/body";
        let ix = 0;
        const siblings = el.parentNode ? el.parentNode.childNodes : [];
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === el) {
                return getXPath(el.parentNode) + "/" + el.tagName.toLowerCase() + "[" + (ix + 1) + "]";
            }
            if (sibling.nodeType === 1 && sibling.tagName === el.tagName) {
                ix++;
            }
        }
        return "";
    };

    // 4. 完整 XPath (从 html 开始)
    const getFullXPath = (el) => {
        const path = [];
        while (el && el.nodeType === 1) {
            let index = 0;
            let sibling = el.previousSibling;
            while (sibling) {
                if (sibling.nodeType === 1 && sibling.nodeName === el.nodeName) index++;
                sibling = sibling.previousSibling;
            }
            const tagName = el.nodeName.toLowerCase();
            const step = tagName + "[" + (index + 1) + "]";
            path.unshift(step);
            el = el.parentNode;
        }
        return "/" + path.join("/");
    };

    return {
        css: getCssSelector(element),
        jsPath: getJsPath(element),
        xpath: getXPath(element),
        fullXPath: getFullXPath(element)
    };
}

_bindPathButtonEvent(element) {
  // 首先创建并插入样式


  const pathBtn = document.getElementById('get-paths-btn');
  if (pathBtn) {
    pathBtn.onclick = () => {
      const paths = this._generateSelectors(element);
      // 使用样式类代替内联样式
      let html = "<h3 class='paths-title'>多种路径</h3>";
      html += "<ul class='paths-list'>";
      
      for (const [key, value] of Object.entries(paths)) {
        const escapedKey = this._escapeHtml(key);
        const escapedValue = this._escapeHtml(value);
        
        // 使用样式类并移除内联样式
        html += `<li>
                  <strong>${escapedKey}:</strong> 
                  <input type="text" class="path-input" value="${escapedValue}" readonly />
                  <button class="copy-path-btn" data-value="${escapedValue}">复制</button>
                 </li>`;
      }
      
      html += "</ul>";
      this.container.insertAdjacentHTML("beforeend", html);

      // 修改复制按钮的样式切换方式
      this.container.querySelectorAll(".copy-path-btn").forEach(btn => {
        btn.onclick = () => {
          const value = btn.getAttribute("data-value");
          navigator.clipboard.writeText(value).then(() => {
            btn.innerText = "已复制";
            btn.classList.add('copied'); // 使用类切换样式
            setTimeout(() => {
              btn.innerText = "复制";
              btn.classList.remove('copied');
            }, 1200);
          });
        };
      });
    };
  }
}

/**
 * HTML 转义函数：将特殊字符转换为文本实体，避免被解析为 HTML
 * @param {string} str - 需要转义的原始文本
 * @returns {string} 转义后的安全文本
 */
_escapeHtml(str) {
  if (typeof str !== 'string') return str; // 非字符串直接返回
  // 映射表：key 是原始特殊字符，value 是对应的 HTML 实体
  const escapeMap = {
    '&': '&amp;',  // 与符号：避免解析为 HTML 实体的开始
    '<': '&lt;',   // 小于号：避免解析为 HTML 标签的开始
    '>': '&gt;',   // 大于号：避免解析为 HTML 标签的结束
    '"': '&quot;', // 双引号：避免提前闭合 HTML 属性（如 value=""）
    "'": '&#39;'   // 单引号：避免提前闭合 HTML 属性（如 onclick=''）
  };
  // 替换所有特殊字符
  return str.replace(/[&<>"']/g, match => escapeMap[match]);
}
    /**
     * 生成完整的资源列表 (锁定状态下使用) 或 HTML 结构
     */
 _createFullResourceList(resources, tagName, element) {
    // 初始化 HTML 折叠状态（默认折叠）
    this.htmlCollapsed = true;
    let html = `<h2 style="font-size: 16px; margin: 0 0 10px 0;">已锁定元素 <${tagName}> 的资源</h2>`;

    // 锁定/关闭按钮
    html += `<button id="toggle-resource-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #4CAF50; color: white;">✅ 已锁定 (点击解锁)</button>`;
    html += `<button id="close-all-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #dc3545; color: white;">完全关闭</button>`;
    html += `<button id="get-paths-btn" style="width:100%;padding:5px;margin-bottom:10px;
              border:1px solid #ccc;cursor:pointer;background:#17a2b8;color:white;">
              获得多种可能路径</button>`;

    // 检查是否所有资源都为 0（显示 HTML 结构，新增可折叠按钮）
    if (this._hasNoResources(resources)) {
        const formattedHtml = this._formatHTML(element.outerHTML);
        // 新增可折叠按钮 + HTML 容器（默认隐藏内容）
        html += `
            <div class="html-collapse-container" style="margin-top: 10px;">
                <button id="toggle-html-collapse" style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; cursor: pointer; background: #e9ecef; color: #495057;">
                    🔽 展开 HTML 结构 (共 ${formattedHtml.split('\n').length} 行)
                </button>
                <pre id="${this.htmlId}" style="white-space: pre-wrap; word-wrap: break-word; font-size: 10px; padding: 5px; border: 1px solid #ddd; background: #fff; max-height: 400px; overflow: auto; text-align: left; display: none;"></pre>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // 插入 HTML 内容（纯文本避免渲染）
        const preElement = document.getElementById(this.htmlId);
        if (preElement) {
            preElement.textContent = formattedHtml;
        }

        // 绑定 HTML 折叠按钮事件
        this._bindHtmlCollapseEvent();
    } else {
        const generateFullList = (title, items) => {
            let listHtml = `<h3 style="font-size: 14px; margin: 15px 0 5px 0;">${title} (${items.length})</h3>`;
            listHtml += `<ul style="list-style: none; padding: 0; margin: 0;">`;
            if (items.length === 0) {
                listHtml += '<li style="color: #666; font-size: 12px;">未找到资源。</li>';
            } else {
                items.forEach(url => {
                    const displayUrl = url.startsWith('[') ? url : (url.substring(url.lastIndexOf('/') + 1) || new URL(url).hostname);
                    listHtml += `<li style="font-size: 12px; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden;"><a href="${url.startsWith('[') ? '#' : url}" target="_blank" title="${url}" style="color: #007bff; text-decoration: none; word-break: break-all;">${displayUrl}</a></li>`;
                });
                if (title.includes('图片')) {
                    listHtml += '<p style="font-size: 11px; margin-top: 5px;">(请右键点击链接 -> 另存为)</p>';
                }
            }
            listHtml += '</ul>';
            return listHtml;
        };

        html += generateFullList('图片/图标 (IMG, SVG, Background)', resources.images);
        html += generateFullList('媒体文件 (VIDEO, AUDIO)', resources.media);
        html += generateFullList('其他链接 (A HREF)', resources.links);
        html += generateFullList('其他可下载资源 (LINK)', resources.other);
        
        this.container.innerHTML = html;
    }

    this._bindButtonEvents();
    this._bindPathButtonEvent(element);
}

/**
 * 绑定 HTML 结构折叠/展开按钮事件
 */
_bindHtmlCollapseEvent() {
    const collapseBtn = document.getElementById('toggle-html-collapse');
    const htmlContainer = document.getElementById(this.htmlId);
    if (!collapseBtn || !htmlContainer) return;

    // 折叠/展开逻辑
    collapseBtn.onclick = () => {
        if (this.htmlCollapsed) {
            // 展开：显示 HTML 内容 + 切换按钮文本
            htmlContainer.style.display = 'block';
            collapseBtn.innerHTML = '🔼 折叠 HTML 结构 (共 ' + htmlContainer.textContent.split('\n').length + ' 行)';
            this.htmlCollapsed = false;
        } else {
            // 折叠：隐藏 HTML 内容 + 切换按钮文本
            htmlContainer.style.display = 'none';
            collapseBtn.innerHTML = '🔽 展开 HTML 结构 (共 ' + htmlContainer.textContent.split('\n').length + ' 行)';
            this.htmlCollapsed = true;
        }
    };
}


    _bindButtonEvents() {
        const toggleBtn = document.getElementById('toggle-resource-picker');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                if (this.isLocked) {
                    this.isLocked = false;
                    this._startPicking(); // 解锁，恢复预览
                } else {
                    // 在预览模式下，这个按钮实际触发的是锁定功能。
                    // 但由于 onClick 已经处理了锁定逻辑，这里主要处理解锁/关闭逻辑，
                    // 在预览模式下它会触发 startPicking 保持状态，或在初始状态下触发 onClick 锁定。
                    this.cleanup(); 
                }
            };
        }
        const closeBtn = document.getElementById('close-all-picker');
        if (closeBtn) {
            closeBtn.onclick = this.cleanup.bind(this);
        }
    }
    

    // --- 事件处理程序 (使用箭头函数确保 this 绑定) ---

    _onMove = (e) => {
        if (this.isLocked) return;

        let el = document.elementFromPoint(e.clientX, e.clientY);
        // 忽略工具本身元素
        if (!el || el === this.overlay || el === this.tooltip || this.container.contains(el)) {
            el = this.currentElement;
        }
        if (!el) return;
        this.currentElement = el;

        // 更新高亮和提示框
        const rect = el.getBoundingClientRect();
        this.overlay.style.top = rect.top + window.scrollY + "px";
        this.overlay.style.left = rect.left + window.scrollX + "px";
        this.overlay.style.width = rect.width + "px";
        this.overlay.style.height = rect.height + "px";
        this.overlay.style.border = "2px solid red";
        this.overlay.style.background = "rgba(255,0,0,0.1)";
        this.tooltip.style.top = rect.top - 24 + "px";
        this.tooltip.style.left = rect.left + "px";
        this.tooltip.innerText = `预览 <${el.tagName.toLowerCase()}>`;

        // 实时嗅探和更新列表
        const resources = this._gatherResources(el);
        this._createResourceListHTML(resources);
    }

    _onClick = (e) => {
        // 如果点击在工具箱内，且不是 HTML 复制按钮，则不进行锁定/解锁
        if (this.container.contains(e.target) && e.target.id !== 'copy-html-btn') return;

        e.preventDefault();
        e.stopPropagation();

        let el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el === this.overlay || el === this.tooltip || this.container.contains(el)) return;

        this.currentElement = el;

        if (!this.isLocked) {
            this.isLocked = true;
            document.removeEventListener("mousemove", this._onMove, true);

            // 切换到锁定样式
            this.overlay.style.border = "4px solid blue";
            this.overlay.style.background = "rgba(0,0,255,0.15)";
            this.tooltip.innerText = `已锁定 <${el.tagName.toLowerCase()}>`;

            // 锁定并生成完整列表/HTML
            const resources = this._gatherResources(el);
            this._createFullResourceList(resources, el.tagName.toLowerCase(), el);

            console.log(`资源嗅探已锁定在元素 <${el.tagName.toLowerCase()}>`);
        } else {
            this.isLocked = false;
            this._startPicking();
            console.log("资源嗅探已解锁，恢复实时预览");
        }
    }

    // --- 启动与清理 ---

    /**
     * 启动/重置拾取状态
     */
    _startPicking() {
        document.addEventListener("mousemove", this._onMove, true);
        document.addEventListener("click", this._onClick, true);

        this.overlay.style.border = "2px solid red";
        this.overlay.style.background = "rgba(255,0,0,0.1)";

        if (!this.currentElement) {
            // 初始启动界面
            this.container.innerHTML = '<h2>资源嗅探工具</h2><p>将鼠标移动到页面元素上开始实时预览。</p><button id="toggle-resource-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #f0f0f0;">🖱️ 实时预览 (点击锁定)</button><button id="close-all-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #dc3545; color: white;">完全关闭</button>';
            this._bindButtonEvents();
        } else {
            const resources = this._gatherResources(this.currentElement);
            this._createResourceListHTML(resources);
        }
    }

    /**
     * 清理所有 UI 和事件监听
     */
    cleanup() {
        document.removeEventListener("mousemove", this._onMove, true);
        document.removeEventListener("click", this._onClick, true);
        this.overlay.remove();
        this.tooltip.remove();
        this.container.remove();
        window.__pickerCleanup = undefined;
        console.log("资源嗅探工具已完全关闭");
    }
}

// -------------------------------------------------------------------
// --- 启动脚本 (保持原入口函数逻辑)
// -------------------------------------------------------------------

function realTimeResourcePicker() {
    // 确保只运行一次
    if (window.__pickerInstance) {
        window.__pickerInstance.cleanup();
    }
    window.__pickerInstance = new ResourcePicker();
}

function main() {
    // 调用主函数启动
    realTimeResourcePicker();
}

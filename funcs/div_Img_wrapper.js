function realTimeResourcePicker() {
  (() => {
    // -------------------------------------------------------------------
    // --- 1. UI 元素创建 (保持不变)
    // -------------------------------------------------------------------

    // 创建高亮框 (Overlay)
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.border = "2px solid red";
    overlay.style.background = "rgba(255,0,0,0.1)";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "999999";
    document.body.appendChild(overlay);

    // 创建提示框 (Tooltip)
    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed";
    tooltip.style.background = "black";
    tooltip.style.color = "white";
    tooltip.style.fontSize = "12px";
    tooltip.style.padding = "2px 6px";
    tooltip.style.borderRadius = "3px";
    tooltip.style.zIndex = "1000000";
    tooltip.style.pointerEvents = "none";
    document.body.appendChild(tooltip);

    // 创建资源列表容器 (Container)
    const resourceListContainer = document.createElement("div");
    resourceListContainer.style.position = "fixed";
    resourceListContainer.style.top = "10px";
    resourceListContainer.style.right = "10px";
    resourceListContainer.style.width = "300px";
    resourceListContainer.style.maxHeight = "90%";
    resourceListContainer.style.overflowY = "auto";
    resourceListContainer.style.background = "rgba(255, 255, 215, 0.95)";
    resourceListContainer.style.border = "1px solid #ccc";
    resourceListContainer.style.padding = "10px";
    resourceListContainer.style.zIndex = "1000001";
    resourceListContainer.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    resourceListContainer.style.fontFamily = "sans-serif";
    resourceListContainer.style.display = "block";
    resourceListContainer.style.userSelect = "text";
    document.body.appendChild(resourceListContainer);

    // 状态追踪
    let isLocked = false;
    let currentElement = null;

    // -------------------------------------------------------------------
    // --- 2. 核心嗅探函数 (最终优化)
    // -------------------------------------------------------------------

    /**
     * 递归遍历 DOM 元素，收集更广泛的资源类型
     */
    function gatherResources(element) {
        // 细分资源类型
        const resources = {
            images: new Set(),
            links: new Set(), // 纯粹的导航链接
            media: new Set(), // 视频/音频文件
            scripts: new Set(), // JS 文件
            styles: new Set(), // CSS 文件
            other: new Set() // 其他可下载资源 (如 Web Manifest)
        };

        if (!element) return { images: [], links: [], media: [], scripts: [], styles: [], other: [] };

        // 辅助函数：将 URL 转换为绝对 URL 并添加
        const addResource = (set, url) => {
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
        };

         element.querySelectorAll('img').forEach(img => {
            // 1. 检查标准属性：src
            addResource(resources.images, img.src);
            
            // 2. 检查响应式图片源：srcset
            if (img.srcset) {
                img.srcset.split(',').forEach(part => {
                    const url = part.trim().split(/\s+/)[0];
                    addResource(resources.images, url);
                });
            }
            
            // 3. 检查延迟加载/自定义数据属性 (最重要)
            const lazySrc = img.getAttribute('data-src') || 
                            img.getAttribute('data-original') ||
                            img.getAttribute('data-srcset');
            
            if (lazySrc) {
                // 如果是 data-srcset，可能包含多个 URL
                if (lazySrc.includes(',')) {
                     lazySrc.split(',').forEach(part => {
                        const url = part.trim().split(/\s+/)[0];
                        addResource(resources.images, url);
                     });
                } else {
                    addResource(resources.images, lazySrc);
                }
            }
        });

        // 查找 SVG 元素 (作为内容标识)
        element.querySelectorAll('svg').forEach(svg => {
            resources.images.add(`[SVG Element] Width: ${svg.getAttribute('width') || 'auto'}, Height: ${svg.getAttribute('height') || 'auto'}`);
        });

        // --- B. 查找 MEDIA 资源 (VIDEO, AUDIO, SOURCE) ---
        element.querySelectorAll('video, audio').forEach(media => {
            // 直接捕获 video/audio 的 src
            addResource(resources.media, media.src);
        });

        // 查找 SOURCE 标签 (在 picture, video, audio 内)
        element.querySelectorAll('source').forEach(source => {
            if (source.type && source.type.startsWith('image/')) {
                addResource(resources.images, source.srcset);
            } else {
                addResource(resources.media, source.src);
            }
        });

        // --- C. 查找 SCRIPT 资源 ---
        element.querySelectorAll('script[src]').forEach(script => {
            addResource(resources.scripts, script.src);
        });

        // --- D. 查找 LINKS, STYLES, and CSS Backgrounds ---

        element.querySelectorAll('a[href]').forEach(a => {
            addResource(resources.links, a.href);
        });
        
        element.querySelectorAll('link[href]').forEach(link => {
            const rel = link.getAttribute('rel');
            if (rel === 'stylesheet') {
                addResource(resources.styles, link.href);
            } else if (rel && (rel.includes('icon') || rel.includes('apple-touch-icon'))) {
                addResource(resources.images, link.href); // 图标视为图片
            } else if (rel) {
                // 其他 link rels (preload, manifest, etc.)
                addResource(resources.other, `[LINK:${rel}] ${link.href}`);
            }
        });

        // CSS background-image
        element.querySelectorAll('*').forEach(el => {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage.startsWith('url(')) {
                const urlMatch = bgImage.match(/url\(['"]?(.+?)['"]?\)/);
                if (urlMatch && urlMatch[1]) {
                    addResource(resources.images, urlMatch[1].trim());
                }
            }
        });

        return {
            images: Array.from(resources.images),
            links: Array.from(resources.links),
            media: Array.from(resources.media),
            scripts: Array.from(resources.scripts),
            styles: Array.from(resources.styles),
            other: Array.from(resources.other)
        };
    }

    /**
     * 生成资源列表的 HTML 并更新容器 (预览模式)
     */
    function createResourceListHTML(resources) {
        let html = '<h2 style="font-size: 16px; margin: 0 0 10px 0;">资源嗅探结果</h2>';
        
        const buttonText = isLocked ? "✅ 已锁定 (点击解锁)" : "🖱️ 实时预览 (点击锁定)";
        const buttonStyle = isLocked ? "background: #4CAF50; color: white;" : "background: #f0f0f0;";
        html += `<button id="toggle-resource-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; ${buttonStyle}">${buttonText}</button>`;

        // 辅助函数：生成列表HTML
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
                if(items.length > limit) {
                    listHtml += `<li style="font-size: 12px; color: #999;">... 还有 ${items.length - limit} 个未显示。</li>`;
                }
            }
            listHtml += '</ul>';
            return listHtml;
        };
        
        // 生成列表内容 (预览模式下限制数量)
        html += generateList('图片/图标', resources.images, 5);
        html += generateList('脚本 (JS)', resources.scripts, 3);
        html += generateList('样式表 (CSS)', resources.styles, 3);
        html += generateList('媒体 (Video/Audio)', resources.media, 3);
        html += generateList('其他链接', resources.links, 5);
        html += generateList('其他资源 (Manifest, etc.)', resources.other, 2);


        resourceListContainer.innerHTML = html;

        // 重新绑定关闭/解锁按钮事件
        document.getElementById('toggle-resource-picker').onclick = () => {
            if (isLocked) {
                isLocked = false;
                startPicking();
            } else {
                cleanup();
            }
        };
    }
    
    /**
     * 生成完整的资源列表 (锁定状态下使用)
     */
    function createFullResourceList(resources, tagName) {
        let html = `<h2 style="font-size: 16px; margin: 0 0 10px 0;">已锁定元素 <${tagName}> 的资源</h2>`;
        
        // 锁定/关闭按钮
        html += `<button id="toggle-resource-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #4CAF50; color: white;">✅ 已锁定 (点击解锁)</button>`;
        html += `<button id="close-all-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #dc3545; color: white;">完全关闭</button>`;

        // 辅助函数：生成完整列表HTML
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
        
        // 生成完整的列表内容
        html += generateFullList('图片/图标 (IMG, SVG, Background)', resources.images);
        html += generateFullList('脚本 (SCRIPT)', resources.scripts);
        html += generateFullList('样式表 (CSS)', resources.styles);
        html += generateFullList('媒体文件 (VIDEO, AUDIO)', resources.media);
        html += generateFullList('其他链接 (A HREF)', resources.links);
        html += generateFullList('其他可下载资源 (LINK)', resources.other);
        
        resourceListContainer.innerHTML = html;
        
        // 重新绑定事件
        document.getElementById('toggle-resource-picker').onclick = () => {
            isLocked = false;
            startPicking();
        };
        document.getElementById('close-all-picker').onclick = cleanup;
    }


    // -------------------------------------------------------------------
    // --- 3. 事件处理和锁定逻辑 (保持不变)
    // -------------------------------------------------------------------

    function onMove(e) {
      if (isLocked) return;

      let el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === overlay || el === tooltip || el === resourceListContainer || resourceListContainer.contains(el)) {
         el = currentElement;
      }
      if (!el) return;

      currentElement = el;

      const rect = el.getBoundingClientRect();
      overlay.style.top = rect.top + window.scrollY + "px";
      overlay.style.left = rect.left + window.scrollX + "px";
      overlay.style.width = rect.width + "px";
      overlay.style.height = rect.height + "px";
      overlay.style.border = "2px solid red";
      overlay.style.background = "rgba(255,0,0,0.1)";

      tooltip.style.top = rect.top - 24 + "px";
      tooltip.style.left = rect.left + "px";
      tooltip.innerText = `预览 <${el.tagName.toLowerCase()}>`;
      
      const resources = gatherResources(el);
      createResourceListHTML(resources);
    }

    function onClick(e) {
      if (resourceListContainer.contains(e.target)) return;
        
      e.preventDefault();
      e.stopPropagation();
      
      let el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === overlay || el === tooltip || resourceListContainer.contains(el)) return;
      
      currentElement = el;

      if (!isLocked) {
          isLocked = true;
          document.removeEventListener("mousemove", onMove, true);
          
          overlay.style.border = "4px solid blue";
          overlay.style.background = "rgba(0,0,255,0.15)";
          tooltip.innerText = `已锁定 <${el.tagName.toLowerCase()}>`;
          
          const resources = gatherResources(el);
          createFullResourceList(resources, el.tagName.toLowerCase());
          
          console.log(`资源嗅探已锁定在元素 <${el.tagName.toLowerCase()}>`);

      } else {
          isLocked = false;
          startPicking();
          console.log("资源嗅探已解锁，恢复实时预览");
      }
    }
    

    /**
     * 清理所有 UI 和事件监听
     */
    function cleanup() {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      overlay.remove();
      tooltip.remove();
      resourceListContainer.remove();
      window.__pickerCleanup = undefined;
      console.log("资源嗅探工具已完全关闭");
    }
    
    /**
     * 启动/重置拾取状态
     */
    function startPicking() {
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("click", onClick, true);
        
        overlay.style.border = "2px solid red";
        overlay.style.background = "rgba(255,0,0,0.1)";
        
        if (!currentElement) {
             // 初始启动界面
             resourceListContainer.innerHTML = '<h2>资源嗅探工具</h2><p>将鼠标移动到页面元素上开始实时预览。</p><button id="toggle-resource-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #f0f0f0;">🖱️ 实时预览 (点击锁定)</button><button id="close-all-picker" style="width: 100%; padding: 5px; margin-bottom: 10px; border: 1px solid #ccc; cursor: pointer; background: #dc3545; color: white;">完全关闭</button>';
             document.getElementById('toggle-resource-picker').onclick = onClick;
             document.getElementById('close-all-picker').onclick = cleanup;
        } else {
            const resources = gatherResources(currentElement);
            createResourceListHTML(resources);
        }
    }


    // -------------------------------------------------------------------
    // --- 4. 启动
    // -------------------------------------------------------------------
    
    startPicking();
    
    window.__pickerCleanup = cleanup;
    
    console.log("实时资源嗅探已启动 (已增强对所有可下载资源的识别)");
  })();
}

function main() {
    // 调用主函数启动
    realTimeResourcePicker();
}


/**
 * Bilibili 视频页面清理器
 * 自动隐藏 B站视频页面的干扰元素，专注观看体验
 * 使用 XPath + CSS 选择器双重定位，持续强制隐藏
 */

// 防止重复注入
if (window.bilibiliCleanerInjected) {
    console.log('[BilibiliCleaner] 已注入，跳过重复执行');
    window.bilibiliCleanerInjected = true;
}

class BilibiliCleaner {
    constructor() {
        // 需要隐藏的元素配置（从配置文件提取）
        this.hiddenElementsConfig = [
            {
                identifier: "div.video-info-detail-list.video-info-detail-content",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[1]/div[1]/div[2]/div[1]",
                name: "视频信息详情"
            },
            {
                identifier: "div.bili-header__bar.mini-header",
                xpath: "/html[1]/body[1]/div[2]/div[1]/div[1]/div[1]",
                name: "顶部导航栏"
            },
            {
                identifier: "bili-comments",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[1]/div[6]/bili-comments[1]",
                name: "评论区"
            },
            {
                identifier: "img.b-img__inner",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[2]/div[1]/div[6]/div[3]/a[1]/div[1]/img[1]",
                name: "推荐图片"
            },
            {
                identifier: "div.rcmd-tab",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[2]/div[1]/div[6]",
                name: "推荐标签"
            },
            {
                identifier: "div.vcd",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[2]/div[1]/div[5]/div[1]/div[1]/a[1]/div[1]",
                name: "广告层"
            },
            {
                identifier: "div.tag-panel",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[1]/div[5]/div[1]",
                name: "标签面板"
            },
            {
                identifier: "div.up-info-container",
                xpath: "/html[1]/body[1]/div[2]/div[2]/div[2]/div[1]/div[1]/div[1]",
                name: "UP主信息"
            }
        ];

        this.processedElements = new WeakSet(); // 使用 WeakSet 记录已处理的元素
        this.observer = null;
        this.forceHideInterval = null;
    }

    /**
     * 通过 XPath 查找元素
     */
    getElementByXPath(xpath) {
        try {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        } catch (error) {
            return null;
        }
    }

    /**
     * 通过 CSS 选择器查找元素
     */
    getElementBySelector(identifier) {
        try {
            return document.querySelector(identifier);
        } catch (error) {
            return null;
        }
    }

    /**
     * 强制隐藏元素（使用 !important）
     */
    forceHideElement(element, name, source) {
        if (!element) return false;

        // 检查是否已处理
        if (this.processedElements.has(element)) return false;

        // 使用 setProperty 强制设置，!important
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('position', 'absolute', 'important');
        element.style.setProperty('left', '-9999px', 'important');
        element.style.setProperty('width', '1px', 'important');
        element.style.setProperty('height', '1px', 'important');

        // 添加自定义标记
        element.setAttribute('data-bilibili-cleaner-hidden', 'true');

        this.processedElements.add(element);
        console.log(`[BilibiliCleaner] 已隐藏: ${name} (${source})`);
        return true;
    }

    /**
     * 通过多种方式查找并隐藏元素
     */
    hideElementByMultipleMethods(config) {
        let hidden = false;
        const name = config.name || config.identifier;

        // 方法1: 尝试 XPath
        const xpathElement = this.getElementByXPath(config.xpath);
        if (xpathElement) {
            hidden = this.forceHideElement(xpathElement, name, 'XPath') || hidden;
        }

        // 方法2: 尝试 CSS 选择器
        const selectorElement = this.getElementBySelector(config.identifier);
        if (selectorElement) {
            hidden = this.forceHideElement(selectorElement, name, 'CSS') || hidden;
        }

        // 方法3: 如果 identifier 包含类名，尝试通过类名查找所有匹配元素
        if (config.identifier.includes('.')) {
            const classes = config.identifier.split('.').filter(c => c && !c.includes('['));
            if (classes.length > 1) {
                const classSelector = '.' + classes.slice(1).join('.');
                try {
                    const elements = document.querySelectorAll(classSelector);
                    elements.forEach(el => {
                        hidden = this.forceHideElement(el, name, 'Class') || hidden;
                    });
                } catch (e) {
                    // 忽略选择器错误
                }
            }
        }

        return hidden;
    }

    /**
     * 应用配置，隐藏所有指定元素
     */
    applyConfig() {
        let hiddenCount = 0;
        this.hiddenElementsConfig.forEach(config => {
            if (this.hideElementByMultipleMethods(config)) {
                hiddenCount++;
            }
        });
        if (hiddenCount > 0) {
            console.log(`[BilibiliCleaner] 本次隐藏 ${hiddenCount} 个元素`);
        }
        return hiddenCount;
    }

    /**
     * 持续强制隐藏（定时器方式，作为 MutationObserver 的补充）
     */
    startForceHide() {
        // 每500ms强制检查一次，确保元素不会重新出现
        this.forceHideInterval = setInterval(() => {
            this.applyConfig();
        }, 500);
    }

    /**
     * 停止强制隐藏
     */
    stopForceHide() {
        if (this.forceHideInterval) {
            clearInterval(this.forceHideInterval);
            this.forceHideInterval = null;
        }
    }

    /**
     * 启动清理器
     */
    start() {
        // 立即执行一次
        this.applyConfig();

        // 延迟执行多次，确保捕获动态加载的元素
        const delays = [100, 500, 1000, 2000, 3000, 5000];
        delays.forEach(delay => {
            setTimeout(() => {
                console.log(`[BilibiliCleaner] ${delay}ms 定时检查`);
                this.applyConfig();
            }, delay);
        });

        // 启动持续强制隐藏
        this.startForceHide();

        // 监听 DOM 变化
        this.setupMutationObserver();

        // 监听页面显示事件（如从后台切换回来）
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('[BilibiliCleaner] 页面可见，重新应用隐藏');
                this.applyConfig();
            }
        });

        // 暴露到全局，方便调试
        window.bilibiliCleanerInstance = this;

        console.log('[BilibiliCleaner] 已启动 - 持续强制隐藏模式');
    }

    /**
     * 设置 DOM 变化监听器
     */
    setupMutationObserver() {
        this.observer = new MutationObserver(() => {
            // 节流：每次 DOM 变化时检查
            this.applyConfig();
        });

        this.observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    /**
     * 停止清理器
     */
    stop() {
        this.stopForceHide();
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        window.bilibiliCleanerInstance = null;
        console.log('[BilibiliCleaner] 已停止');
    }
}

// 自动启动
const cleaner = new BilibiliCleaner();
cleaner.start();

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BilibiliCleaner;
}

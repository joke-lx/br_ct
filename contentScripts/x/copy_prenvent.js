
(function() {
    'use strict';
    
    let capturedText = null;
    
    // 1. Hook Clipboard API - 拦截并阻止
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = async function(text) {
        capturedText = text;
        console.log('%c[✓ Hook 拦截] 被复制的文本:', 'color: #00ff00; font-size: 14px; font-weight: bold;', text);
        console.log('%c[✓ 已阻止写入剪贴板]', 'color: #ff6600;');
        
        // 不进原始剪贴板，直接返回 resolved promise 模拟成功
        return Promise.resolve();
    };
    
    // 2. Hook execCommand('copy') - 兼容老代码
    const originalExecCommand = document.execCommand;
    document.execCommand = function(command) {
        if (command === 'copy') {
            const selection = window.getSelection().toString();
            capturedText = selection;
            console.log('%c[✓ Hook 拦截 execCommand] 内容:', 'color: #00ff00;', selection);
            console.log('%c[✓ 已阻止]', 'color: #ff6600;');
            return true; // 模拟执行成功
        }
        return originalExecCommand.call(this, command);
    };
    
    // 3. Hook copy 事件 - 兜底
    document.addEventListener('copy', function(e) {
        const text = window.getSelection().toString();
        if (text) {
            capturedText = text;
            console.log('%c[✓ Hook 拦截 copy 事件] 内容:', 'color: #00ff00;', text);
        }
        e.preventDefault(); // 阻止默认复制行为
    }, true);
    
    // 4. 暴露获取方法到全局
    window.getCapturedText = function() {
        return capturedText;
    };
    
    console.log('%c[剪贴板 Hook 已启动] 点击复制按钮即可拦截内容', 'color: #00ff00; font-size: 16px;');
    console.log('%c拦截后调用 getCapturedText() 获取内容', 'color: #888;');
    
})();
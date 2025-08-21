
// popup/add.js

// 假设我们有一个预定义的脚本列表，或者从后端获取
// 在实际应用中，您可能需要更复杂的机制来动态发现文件
const scriptFiles = [
  { name: '示例脚本 1', file: 'example_func1.js' },
  { name: '示例脚本 2', file: 'example_func2.js' }
];

document.addEventListener('DOMContentLoaded', () => {
  const scriptList = document.getElementById('script-list');

  // 动态创建脚本列表
  scriptFiles.forEach(script => {
    const scriptItem = document.createElement('div');
    scriptItem.className = 'script-item';
    scriptItem.innerHTML = `
      <span>${script.name}</span>
      <button class="execute-button" data-file="${script.file}">执行</button>
    `;
    scriptList.appendChild(scriptItem);
  });

  // 为每个“执行”按钮添加事件监听器
  scriptList.addEventListener('click', (event) => {
    if (event.target.classList.contains('execute-button')) {
      const scriptFile = event.target.dataset.file;
      
      // 禁用按钮以防重复点击
      const originalText = event.target.textContent;
      event.target.textContent = '执行中...';
      event.target.disabled = true;

      // 向 background.js 发送执行脚本的请求
      chrome.runtime.sendMessage({
        action: 'executeFunctionScript',
        file: scriptFile
      }, (response) => {
        if (response && response.status === 'success') {
          alert(`脚本 ${scriptFile} 执行成功！`);
        } else {
          alert(`脚本 ${scriptFile} 执行失败: ${response?.message || '未知错误'}`);
        }

        // 恢复按钮状态
        event.target.textContent = originalText;
        event.target.disabled = false;
        
        // 成功后关闭 popup
        window.close();
      });
    }
  });
});
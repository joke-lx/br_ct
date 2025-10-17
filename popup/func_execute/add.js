// 预定义脚本列表
const scriptFiles = [
  { name: 'div Copy', file: '元素dom/div_copy_wrapper.js' },
  { name: 'img Copy', file: '元素dom/div_Img_wrapper.js' },
  { name: 'boss_job', file: '平台专属/boss直聘/boss_job.js' },
  { name: 'InputHistory', file: '元素dom/input.js' },
  { name: 'oneRaw', file: '元素dom/oneRaw.js' },
  { name: 'color', file: '元素dom/color_show.js' }
];

document.addEventListener('DOMContentLoaded', () => {
  const scriptList = document.getElementById('script-list');

  // 动态生成脚本项
  scriptFiles.forEach(script => {
    const scriptItem = document.createElement('div');
    scriptItem.className = 'script-item';
    scriptItem.innerHTML = `
      <span>${script.name}</span>
      <button class="execute-button" data-file="${script.file}">执行</button>
    `;
    scriptList.appendChild(scriptItem);
  });

  // 按钮事件监听
  scriptList.addEventListener('click', (event) => {
    if (event.target.classList.contains('execute-button')) {
      const scriptFile = event.target.dataset.file;
      const button = event.target;
      const originalText = button.textContent;

      button.textContent = '执行中...';
      button.disabled = true;

      chrome.runtime.sendMessage(
        { action: 'executeFunctionScript', file: scriptFile },
        (response) => {
          if (response && response.status === 'success') {
            console.log(`脚本 ${scriptFile} 执行成功`);
          } else {
            alert(`脚本 ${scriptFile} 执行失败: ${response?.message || '未知错误'}`);
          }

          button.textContent = originalText;
          button.disabled = false;

          // 成功后关闭 popup
          window.close();
        }
      );
    }
  });
});

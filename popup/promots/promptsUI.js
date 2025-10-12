/**
 * 填充优化器下拉框
 */
function populateOptimizer(promptOptimizerSelect) {
  const optionsContainer = promptOptimizerSelect.querySelector('.custom-select-options');
  const selectedValue = promptOptimizerSelect.querySelector('.selected-value');
  
  // 清空现有选项
  optionsContainer.innerHTML = '';
  
  // 获取所有分组
  const groups = {};
  for (const key in PROMPT_TEMPLATES) {
    const group = PROMPT_TEMPLATES[key].group;
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push({
      key,
      ...PROMPT_TEMPLATES[key]
    });
  }

  // 按分组添加选项
  for (const groupName in groups) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'select-group';

    // 创建分组标题
    const groupHeader = document.createElement('div');
    groupHeader.className = 'select-group-header';
    groupHeader.textContent = groupName;
    
    // 添加分组点击事件
    groupHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭其他所有分组
      optionsContainer.querySelectorAll('.select-group').forEach(group => {
        if (group !== groupDiv) {
          group.classList.remove('active');
        }
      });
      // 切换当前分组
      groupDiv.classList.toggle('active');
    });

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'select-options';

    groups[groupName].forEach(template => {
      const option = document.createElement('div');
      option.className = 'select-option';
      option.textContent = template.label;
      option.dataset.value = template.key;
      option.dataset.template = template.template;
      
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedValue.textContent = template.label;
        selectedValue.dataset.value = template.key;
        promptOptimizerSelect.classList.remove('active');
        // 触发change事件
        const event = new CustomEvent('change', { 
          detail: { value: template.key, template: template.template }
        });
        promptOptimizerSelect.dispatchEvent(event);
      });
      
      optionsDiv.appendChild(option);
    });

    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(optionsDiv);
    optionsContainer.appendChild(groupDiv);
  }

  // 添加点击事件切换下拉框显示状态
  promptOptimizerSelect.addEventListener('click', () => {
    promptOptimizerSelect.classList.toggle('active');
  });

  // 点击外部关闭下拉框
  document.addEventListener('click', (e) => {
    if (!promptOptimizerSelect.contains(e.target)) {
      promptOptimizerSelect.classList.remove('active');
      // 关闭所有分组
      optionsContainer.querySelectorAll('.select-group').forEach(group => {
        group.classList.remove('active');
      });
    }
  });
}

export { populateOptimizer };
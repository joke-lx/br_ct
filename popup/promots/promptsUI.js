/**
 * 填充优化器下拉框
 */
function populateOptimizer(promptOptimizerSelect) {
  const optionsContainer = promptOptimizerSelect.querySelector('.custom-select-options');
  const selectedValue = promptOptimizerSelect.querySelector('.selected-value');
  
  // 清空现有选项
  optionsContainer.innerHTML = '';

  // 创建两栏布局容器
  const twoColumnContainer = document.createElement('div');
  twoColumnContainer.className = 'two-column-container';
  
  // 创建左侧分组列表
  const groupList = document.createElement('div');
  groupList.className = 'group-list';
  
  // 创建右侧选项列表
  const optionsList = document.createElement('div');
  optionsList.className = 'options-list';

  // 修改恢复逻辑，同时获取lastPromptTemplate和对应的模板内容
  chrome.storage.sync.get(['lastPromptTemplate'], (result) => {
    if (result.lastPromptTemplate) {
      const template = PROMPT_TEMPLATES[result.lastPromptTemplate];
      if (template) {
        selectedValue.textContent = template.label;
        selectedValue.dataset.value = result.lastPromptTemplate;
        selectedValue.dataset.template = template.template;
      }
    }
  });
  
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

  // 显示指定分组的选项
  function showGroupOptions(groupName) {
    const allOptions = document.querySelectorAll('.group-options');
    allOptions.forEach(container => {
      if(container.dataset.group === groupName) {
        container.style.display = 'block';
        container.classList.add('active');
      } else {
        container.style.display = 'none';
        container.classList.remove('active');
      }
    });
  }

  // 按分组添加选项
  let firstGroup = null;
  for (const groupName in groups) {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.textContent = groupName;
    if (!firstGroup) firstGroup = groupName;
    
    // 使用事件委托来处理hover
    let hoverTimer = null;
    
    groupItem.addEventListener('mouseenter', () => {
      // 清除之前的定时器
      if (hoverTimer) clearTimeout(hoverTimer);
      
      // 立即移除其他active状态
      document.querySelectorAll('.group-item').forEach(item => {
        item.classList.remove('active');
      });
      
      // 立即添加当前active状态
      groupItem.classList.add('active');
      
      // 立即显示对应选项
      showGroupOptions(groupName);
    });
    
    groupList.appendChild(groupItem);
    
    // 为每个分组创建选项容器
    const groupOptions = document.createElement('div');
    groupOptions.className = 'group-options';
    groupOptions.dataset.group = groupName;
    
    groups[groupName].forEach(template => {
      const option = document.createElement('div');
      option.className = 'select-option';
      option.textContent = template.label;
      option.dataset.value = template.key;
      option.dataset.template = template.template;
      
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        // 更新选中值的所有数据属性
        selectedValue.textContent = template.label;
        selectedValue.dataset.value = template.key;
        selectedValue.dataset.template = template.template;
        promptOptimizerSelect.classList.remove('active');

        // 只保存模板的key，恢复时从PROMPT_TEMPLATES中获取完整信息
        chrome.storage.sync.set({ 
          lastPromptTemplate: template.key
        });

        // 触发change事件
        const event = new CustomEvent('change', { 
          detail: { 
            value: template.key,
            template: template.template,
            label: template.label
          }
        });
        promptOptimizerSelect.dispatchEvent(event);
      });
      
      groupOptions.appendChild(option);
    });
    
    optionsList.appendChild(groupOptions);
  }

  // 装载两栏布局
  twoColumnContainer.appendChild(groupList);
  twoColumnContainer.appendChild(optionsList);
  optionsContainer.appendChild(twoColumnContainer);

  // 初始化显示第一个分组的选项
  if (firstGroup) {
    const firstGroupItem = groupList.querySelector('.group-item');
    firstGroupItem.classList.add('active');
    showGroupOptions(firstGroup);
  }

  // 添加点击事件切换下拉框显示状态
  promptOptimizerSelect.addEventListener('click', () => {
    promptOptimizerSelect.classList.toggle('active');
  });

  // 点击外部关闭下拉框
  document.addEventListener('click', (e) => {
    if (!promptOptimizerSelect.contains(e.target)) {
      promptOptimizerSelect.classList.remove('active');
    }
  });
}

export { populateOptimizer };
/**
 * 填充优化器下拉框
 */
function populateOptimizer(promptOptimizerSelect) {
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '不使用优化';
  promptOptimizerSelect.appendChild(emptyOption);

  for (const key in PROMPT_TEMPLATES) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = PROMPT_TEMPLATES[key].label;
    promptOptimizerSelect.appendChild(option);
  }
}

export { populateOptimizer };
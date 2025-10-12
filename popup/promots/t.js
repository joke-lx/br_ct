class PromptOptimizerSelector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // HTML 结构
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
      <style>
        .prompt-optimizer-selector {
          position: relative;
          width: 300px;
          font-family: inherit;
        }
        .selected {
          padding: 10px 15px;
          border: 1px solid #dcdcdc;
          border-radius: 6px;
          cursor: pointer;
          background: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #333;
          transition: all 0.3s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .selected:hover {
          border-color: #007bff;
          box-shadow: 0 1px 5px rgba(0,123,255,0.1);
        }
        .selected::after {
          content: '\\f0dc';
          font-family: 'Font Awesome 6 Free';
          font-weight: 900;
          margin-left: 10px;
          transition: transform 0.3s ease;
        }
        .prompt-optimizer-selector.open .selected::after {
          transform: rotate(180deg);
        }
        .dropdown {
          position: absolute;
          top: calc(100% + 5px);
          left: 0;
          width: 100%;
          border: 1px solid #dcdcdc;
          border-radius: 6px;
          background: #fff;
          display: none;
          max-height: 350px;
          overflow-y: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          padding: 5px 0;
          z-index: 100;
        }
        .dropdown::-webkit-scrollbar { width: 8px; }
        .dropdown::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 4px; }
        .dropdown::-webkit-scrollbar-track { background: #f1f1f1; }

        .group {
          padding: 8px 15px;
          cursor: pointer;
          background: #f9f9f9;
          font-weight: 600;
          color: #555;
          border-bottom: 1px solid #eee;
          position: relative;
          font-size: 13px;
          transition: background-color 0.2s;
        }
        .group:hover { background-color: #f0f0f0; }
        .group::after {
          content: '\\f0da';
          font-family: 'Font Awesome 6 Free';
          font-weight: 900;
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 10px;
          color: #aaa;
        }
        .labels { display: none; padding: 0; }
        .group:hover .labels { display: block; }
        .label {
          padding: 8px 30px;
          cursor: pointer;
          font-size: 14px;
          color: #333;
          transition: background-color 0.2s, color 0.2s;
        }
        .label:hover { background: #e6f2ff; color: #007bff; }
      </style>

      <div class="prompt-optimizer-selector">
        <div class="selected">选择提示模板</div>
        <div class="dropdown"></div>
      </div>
    `;

    this.PROMPT_TEMPLATES = {
      '1': { group: '代码生成与输出', label: '完整代码输出' },
      '2': { group: '概念与原理分析', label: '完整概念分析' },
      '3': { group: '优化与提升', label: '优化思路' },
      '4': { group: '内容处理', label: '翻译' },
      '6': { group: '代码生成与输出', label: 'vue模板' },
      '7': { group: '代码调试与修复', label: '帮助我修复bug' },
      '8': { group: '任务规划', label: '步骤规划' },
      '9': { group: '命令与操作', label: '指令序列' },
      '10': { group: '项目分析', label: '目录读取' },
      '11': { group: '代码分析', label: '代码变量名的含义' },
      '12': { group: '脚本生成', label: '生成bat文件' },
      '13': { group: '脚本生成', label: '大python文件' },
      '14': { group: '设计思想', label: '设计思想哲学' }
    };
  }

  connectedCallback() {
    const container = this.shadowRoot.querySelector('.prompt-optimizer-selector');
    const selectedDiv = container.querySelector('.selected');
    const dropdown = container.querySelector('.dropdown');

    const groups = {};
    for (const key in this.PROMPT_TEMPLATES) {
      const item = this.PROMPT_TEMPLATES[key];
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push({ key, label: item.label });
    }

    for (const groupName in groups) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'group';
      const groupNameSpan = document.createElement('span');
      groupNameSpan.textContent = groupName;
      groupDiv.appendChild(groupNameSpan);

      const labelsDiv = document.createElement('div');
      labelsDiv.className = 'labels';

      groups[groupName].forEach(item => {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label';
        labelDiv.textContent = item.label;
        labelDiv.dataset.key = item.key;
        labelDiv.onclick = (e) => {
          e.stopPropagation();
          selectedDiv.textContent = item.label;
          dropdown.style.display = 'none';
          container.classList.remove('open');
          console.log('选择模板ID:', item.key);
        };
        labelsDiv.appendChild(labelDiv);
      });

      groupDiv.appendChild(labelsDiv);
      dropdown.appendChild(groupDiv);
    }

    selectedDiv.onclick = (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      container.classList.toggle('open', !isVisible);
    };

    document.addEventListener('click', e => {
      if (!container.contains(e.target)) {
        dropdown.style.display = 'none';
        container.classList.remove('open');
      }
    });
  }
}

customElements.define('prompt-optimizer-selector1', PromptOptimizerSelector);


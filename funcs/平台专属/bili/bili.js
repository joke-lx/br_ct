// funcs/example_func1.js

function main() {
 // 获取父容器节点 - 使用类选择器代替长XPath
const parentContainer = document.querySelector('.video-pod__list.section');
if (!parentContainer) {
  console.error("未找到视频列表容器，请检查选择器");
} else {
  // 收集所有视频项目（使用querySelectorAll替代XPath）
  const videoItems = parentContainer.querySelectorAll('.pod-item.video-pod__item');
  const items = [];
  
  videoItems.forEach(item => {
    try {
      // 获取data-key并构造完整URL
      const dataKey = item.getAttribute("data-key");
      const titleElement = item.querySelector(".title-txt");
      
      if (!dataKey || !titleElement) return;
      
      items.push({
        title: titleElement.textContent.trim(),
        link: `https://www.bilibili.com/video/${dataKey}`
      });
    } catch (e) {
      console.error(`处理视频项时出错:`, e);
    }
  });

  // 构建输出字符串
  let markdownOutput = `\n发现 ${items.length} 个视频：\n\n`;
  let clipboardOutput = "";
  
  items.forEach((item, index) => {
    const line = `${index + 1}. [${item.title}](${item.link})`;
    markdownOutput += line + "\n";
    clipboardOutput += line + "\n";
  });
  
  // 添加完整可复制内容
  markdownOutput += "\n--- 可一次性复制的完整Markdown代码 ---\n" + clipboardOutput;
  
  // 输出到控制台
  console.log(markdownOutput);
  
  // 创建自动复制机制
  const textArea = document.createElement("textarea");
  textArea.value = clipboardOutput;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    document.execCommand("copy");
    console.log("内容已自动复制到剪贴板");
  } catch (err) {
    console.log("自动复制失败，请手动复制控制台输出");
  }
  
  setTimeout(() => {
    if (document.body.contains(textArea)) {
      document.body.removeChild(textArea);
    }
  }, 2000);
}

}


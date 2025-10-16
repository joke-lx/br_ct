// 获取父容器节点
const parentXPath = "/html/body/div[2]/div[2]/div[2]/div/div[5]/div[1]/div[2]/div";
const parentNode = document.evaluate(
  parentXPath,
  document,
  null,
  XPathResult.FIRST_ORDERED_NODE_TYPE,
  null
).singleNodeValue;

if (!parentNode) {
  console.error("未找到父节点，请检查XPath路径");
} else {
  // 收集所有视频项目
  const items = [];
  const maxItems = 1000; // 安全限制，避免无限循环
  
  for (let i = 1; i <= maxItems; i++) {
    try {
      // 获取每个视频项的节点
      const itemXPath = `${parentXPath}/div[${i}]`;
      const node = document.evaluate(
        itemXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      
      if (!node || !node.getAttribute || !node.querySelector) break;
      
      // 获取data-key并构造完整URL
      const dataKey = node.getAttribute("data-key");
      const titleElement = node.querySelector(".title-txt");
      
      if (!dataKey || !titleElement) continue;
      
      items.push({
        title: titleElement.textContent.trim(),
        link: `https://www.bilibili.com/video/${dataKey}`
      });
      
    } catch (e) {
      console.error(`处理第${i}项时出错:`, e);
      break;
    }
  }

  // 构建输出字符串
  let markdownOutput = `\n发现 ${items.length} 个视频专栏项目：\n\n`;
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





function main() {
  // 提示用户输入多行文本
  const input = prompt("请输入要转换的多行文本：\n(支持粘贴多行内容)");

  // 如果用户取消或为空则不执行
  if (input) {
    // 将换行符替换成 \n，并去除首尾空格
    const result = input.trim().replace(/\r?\n/g, "\\n");

    // 输出结果到控制台
    console.log("✅ 转换结果：");
    console.log(result);

    // --- 使用 textarea 复制 ---
    const textarea = document.createElement("textarea");
    textarea.value = result;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    console.log("📋 已复制到剪贴板！");
  }
}


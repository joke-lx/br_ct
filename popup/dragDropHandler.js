/**
 * 设置输入框的拖放事件处理
 */
export function setupDragDropEvents() {
  const messageInput = document.getElementById("message-input");

  if (!messageInput) {
    console.error("未找到消息输入框");
    return;
  }

  // 阻止默认拖放行为
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    messageInput.addEventListener(eventName, preventDefaults, false);
  });

  // 添加拖放视觉反馈
  ["dragenter", "dragover"].forEach((eventName) => {
    messageInput.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    messageInput.addEventListener(eventName, unhighlight, false);
  });

  // 处理拖放文件
  messageInput.addEventListener("drop", handleDrop, false);
}

/**
 * 阻止默认拖放行为
 */
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * 添加高亮效果
 */
function highlight() {
  const messageInput = document.getElementById("message-input");
  messageInput.classList.add("dragover");
}

/**
 * 移除高亮效果
 */
function unhighlight() {
  const messageInput = document.getElementById("message-input");
  messageInput.classList.remove("dragover", "drop-error");
}

/**
 * 处理拖放事件
 */
function handleDrop(e) {
  const messageInput = document.getElementById("message-input");
  const dt = e.dataTransfer;

  // 获取所有拖放的项目
  const items = dt.items;

  if (!items || items.length === 0) {
    messageInput.classList.add("drop-error");
    return;
  }

  const fileContents = [];
  let totalFiles = 0;
  let processedFiles = 0;

  // 处理每个拖放的项目
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 尝试获取文件系统条目 (使用Chrome支持的webkitGetAsEntry)
    let entry;
    if (item.webkitGetAsEntry) {
      entry = item.webkitGetAsEntry();
    } else if (typeof item.getAsEntry === "function") {
      entry = item.getAsEntry();
    }

    // 如果是文件夹，递归处理
    if (entry && entry.isDirectory) {
      totalFiles++;
      handleDirectoryEntry(entry, "", fileContents, () => {
        processedFiles++;
        if (processedFiles === totalFiles) {
          appendFileContentsToInput(messageInput, fileContents);
        }
      });
    } else {
      // 如果是文件，直接获取文件并读取内容
      totalFiles++;
      const file = item.getAsFile();
      if (file) {
        readFileContent(file, "", fileContents, () => {
          processedFiles++;
          if (processedFiles === totalFiles) {
            appendFileContentsToInput(messageInput, fileContents);
          }
        });
      } else {
        processedFiles++;
        if (processedFiles === totalFiles) {
          appendFileContentsToInput(messageInput, fileContents);
        }
      }
    }
  }
}

/**
 * 递归处理目录条目
 */
function handleDirectoryEntry(entry, path, fileContents, callback) {
  const reader = entry.createReader();
  const newPath = path ? `${path}/${entry.name}` : entry.name;
  let entriesProcessed = 0;
  let totalEntries = 0;
  let isProcessing = false;

  function processEntries() {
    reader.readEntries(
      (entries) => {
        if (entries.length === 0) {
          // 所有条目处理完毕
          if (callback) callback();
          return;
        }

        totalEntries += entries.length;
        entries.forEach((entry) => {
          if (entry.isDirectory) {
            // 如果是子目录，递归处理
            handleDirectoryEntry(entry, newPath, fileContents, () => {
              entriesProcessed++;
              if (entriesProcessed === totalEntries) {
                // 确保回调只被调用一次
                if (!isProcessing) {
                  isProcessing = true;
                  if (callback) callback();
                }
              }
            });
          } else {
            // 如果是文件，读取内容
            entry.file((file) => {
              readFileContent(file, newPath, fileContents, () => {
                entriesProcessed++;
                if (entriesProcessed === totalEntries) {
                  // 确保回调只被调用一次
                  if (!isProcessing) {
                    isProcessing = true;
                    if (callback) callback();
                  }
                }
              });
            });
          }
        });

        // 继续读取剩余条目
        processEntries();
      },
      (error) => {
        console.error("读取目录失败:", error);
        if (callback) callback();
      }
    );
  }

  processEntries();
}

/**
 * 读取文件内容
 */
function readFileContent(file, path, fileContents, callback) {
  const reader = new FileReader();
  const fullPath = path ? `${path}/${file.name}` : file.name;

  // 根据文件大小限制读取策略
  if (file.size > 10 * 1024 * 1024) {
    // 大于10MB的文件
    // 对于大文件，只读取前100KB内容和文件信息
    const blob = file.slice(0, 100 * 1024);
    reader.onload = function (e) {
      const content = e.target.result;
      fileContents.push({
        path: fullPath,
        content: `${content}\n\n[文件过大，仅显示前100KB内容]`,
        size: file.size,
      });
      if (callback) callback();
    };
    reader.readAsText(blob, "utf-8");
  } else {
    // 对于小文件，读取全部内容
    reader.onload = function (e) {
      const content = e.target.result;
      fileContents.push({
        path: fullPath,
        content: content,
        size: file.size,
      });
      if (callback) callback();
    };
    reader.onerror = function () {
      fileContents.push({
        path: fullPath,
        content: "[无法读取文件内容]",
      });
      if (callback) callback();
    };
    reader.readAsText(file, "utf-8");
  }
}

/**
 * 将文件内容追加到输入框
 */
function appendFileContentsToInput(inputElement, fileContents) {
  if (fileContents.length === 0) {
    inputElement.value += "\n\n[未找到可读取的文件内容]";
    return;
  }

  let contentText = "\n\n=== 拖放文件内容 ===\n";

  fileContents.forEach((item) => {
    contentText += `\n[文件: ${item.path}]\n`;
    contentText += "-------------------\n";
    contentText += item.content + "\n";
    contentText += "===================\n";
  });

  inputElement.value += contentText;
  inputElement.focus();
}

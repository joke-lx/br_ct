// 定义函数
function downloadImagesFromElement(el) {
  if (!el) {
    console.error("请传入一个元素节点！");
    return;
  }

  // 收集图片 URL
  const urls = new Set();

  // 1. <img> 标签
  el.querySelectorAll("img").forEach(img => {
    if (img.src) urls.add(img.src);
    if (img.srcset) {
      img.srcset.split(",").forEach(src => {
        urls.add(src.trim().split(" ")[0]);
      });
    }
  });

  // 2. <source>
  el.querySelectorAll("source").forEach(source => {
    if (source.src) urls.add(source.src);
    if (source.srcset) {
      source.srcset.split(",").forEach(src => {
        urls.add(src.trim().split(" ")[0]);
      });
    }
  });

  // 3. video poster
  el.querySelectorAll("video").forEach(v => {
    if (v.poster) urls.add(v.poster);
  });

  // 4. CSS 背景图
  el.querySelectorAll("*").forEach(node => {
    const style = window.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== "none") {
      const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1]) urls.add(match[1]);
    }
  });

  console.log("发现图片数量:", urls.size, urls);

  // 下载函数
  function download(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop().split("?")[0] || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 执行下载
  urls.forEach(url => download(url));
}

function main() {
  (() => {
    // 创建高亮框
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.border = "2px solid red";
    overlay.style.background = "rgba(255,0,0,0.1)";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "999999";
    document.body.appendChild(overlay);

    // 创建提示框
    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed";
    tooltip.style.background = "black";
    tooltip.style.color = "white";
    tooltip.style.fontSize = "12px";
    tooltip.style.padding = "2px 6px";
    tooltip.style.borderRadius = "3px";
    tooltip.style.zIndex = "1000000";
    tooltip.style.pointerEvents = "none";
    document.body.appendChild(tooltip);

    function onMove(e) {
      let el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === overlay || el === tooltip) return;

      const rect = el.getBoundingClientRect();
      overlay.style.top = rect.top + window.scrollY + "px";
      overlay.style.left = rect.left + window.scrollX + "px";
      overlay.style.width = rect.width + "px";
      overlay.style.height = rect.height + "px";

      tooltip.style.top = rect.top + window.scrollY - 24 + "px";
      tooltip.style.left = rect.left + window.scrollX + "px";
      tooltip.innerText = `<${el.tagName.toLowerCase()}>`;
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();

      let el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;

      // 调用下载函数
      downloadImagesFromElement(el);

      tooltip.innerText = "已开始下载图片！";

      // 点击一次后立即清理
      cleanup();
      console.log("元素拾取完成，已触发图片下载");
    }

    function cleanup() {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      overlay.remove();
      tooltip.remove();
    }

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);

    // 给全局留一个清理接口
    window.__pickerCleanup = cleanup;

    console.log("元素拾取已开启（点击元素后将下载其中的图片）");
  })();
}


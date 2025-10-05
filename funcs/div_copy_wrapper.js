
function main(){

(() => {
  // 如果已经启用过，先清理
  if (window.__pickerCleanup) {
    window.__pickerCleanup();
    delete window.__pickerCleanup;
    console.log("元素拾取已关闭");
    return;
  }

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

    const html = el.outerHTML;
    navigator.clipboard.writeText(html).then(() => {
      tooltip.innerText = "已复制到剪贴板！";
    });

    // 点击一次后立即清理
    cleanup();
    console.log("元素拾取已完成并关闭");
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

  console.log("元素拾取已开启（点击一次后自动关闭）");
})();


}


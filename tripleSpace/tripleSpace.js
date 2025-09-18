let spaceCount = 0;
let lastSpaceTime = 0;
console.log("tripleSpace.js loaded");

document.addEventListener("keydown", function(e) {
    const now = Date.now();

    if (e.code === "Space") {
        if (now - lastSpaceTime < 500) { // 0.5 秒内连续
            spaceCount++;
        } else {
            spaceCount = 1;
        }
        lastSpaceTime = now;

        if (spaceCount === 3) {
            createPopupInput();
            spaceCount = 0;
            e.preventDefault(); // 阻止第三个空格输入
        }
    } else {
        spaceCount = 0;
    }
});

function createPopupInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const popup = document.createElement("div");
    popup.className = "triple-space-popup";
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "输入内容...";
    popup.appendChild(input);

    document.body.appendChild(popup);

    popup.style.left = rect.left + window.scrollX + "px";
    popup.style.top = rect.bottom + window.scrollY + "px";

    input.focus();

    const clickHandler = (ev) => {
        if (!popup.contains(ev.target)) {
            popup.remove();
            document.removeEventListener("click", clickHandler);
        }
    };
    document.addEventListener("click", clickHandler);
}

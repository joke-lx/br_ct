const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const intervalInput = document.getElementById("interval");

startBtn.addEventListener("click", () => {
    const interval = parseInt(intervalInput.value) * 1000;
    chrome.runtime.sendMessage({action: "startCarousel", interval}, response => {
        console.log(response.status);
    });
});

stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({action: "stopCarousel"}, response => {
        console.log(response.status);
    });
});

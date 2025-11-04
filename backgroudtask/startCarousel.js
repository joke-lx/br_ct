export function startCarousel() {
let carouselInterval = null;
let intervalTime = 5000; // 默认轮播时间 5 秒

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startCarousel") {
        startCarousel(message.interval);
        sendResponse({status: "started"});
    } else if (message.action === "stopCarousel") {
        stopCarousel();
        sendResponse({status: "stopped"});
    }
});

function startCarousel(time) {
    if (carouselInterval) clearInterval(carouselInterval);
    intervalTime = time || intervalTime;

    carouselInterval = setInterval(async () => {
        const tabs = await chrome.tabs.query({currentWindow: true});
        if (tabs.length === 0) return;

        // 找到当前活动标签
        const activeTab = tabs.find(tab => tab.active);
        let currentIndex = activeTab ? tabs.indexOf(activeTab) : 0;
        let nextIndex = (currentIndex + 1) % tabs.length;

        // 激活下一个标签
        chrome.tabs.update(tabs[nextIndex].id, {active: true});
    }, intervalTime);
}

function stopCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = null;
}
}
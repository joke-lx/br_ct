class QueueStorage {
    constructor(key) {
        this.key = key;
    }

    async init() {
        // 初始化时确保队列存在
        const queue = await this.getQueue();
        if (!queue) {
            await this.setQueue([]);
        }
    }

    async setQueue(queue) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.key]: queue }, resolve);
        });
    }

    async getQueue() {
        return new Promise(resolve => {
            chrome.storage.local.get(this.key, (result) => {
                resolve(result[this.key]);
            });
        });
    }

    async push(content) {
        const queue = await this.getQueue();
        queue.push({ content: content, status: false });
        await this.setQueue(queue);
    }

    async pop() {
        const queue = await this.getQueue();
        if (queue.length === 0) return null;

        const node = queue.shift();
        await this.setQueue(queue);
        return node;
    }

    async markAsConsumed(index) {
        const queue = await this.getQueue();
        if (index >= 0 && index < queue.length) {
            queue[index].status = true;
            await this.setQueue(queue);
        }
    }
}

// 使用示例
const myQueue = new QueueStorage('myQueueKey');
myQueue.init().then(() => {
    console.log("Queue initialized");
});
明白，你希望我给出一个 **完整的 JavaScript 文件**，展示 JS 中的 **异步关键字 (`async` / `await`)** 和 **关键对象 (`Promise`)** 的使用，包括文件结构和完整代码示例。下面是一个示例：

---

### 文件结构

```
async-demo/
├── index.html
└── main.js
```

---

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Async JS Demo</title>
</head>
<body>
    <h1>JavaScript 异步关键字与对象示例</h1>
    <button id="fetchDataBtn">获取数据</button>
    <pre id="output"></pre>

    <script src="main.js"></script>
</body>
</html>
```

---

### `main.js`

```javascript
// ============================
// 异步函数与 Promise 示例
// ============================

// 模拟异步请求函数，返回 Promise
function fetchData(url) {
    return new Promise((resolve, reject) => {
        console.log(`开始请求: ${url}`);
        setTimeout(() => {
            // 随机模拟成功或失败
            if (Math.random() > 0.2) {
                resolve({ data: `数据来自 ${url}` });
            } else {
                reject(new Error(`请求失败: ${url}`));
            }
        }, 1000);
    });
}

// ============================
// 使用 async / await 处理异步
// ============================

async function loadData() {
    const output = document.getElementById('output');
    output.textContent = '加载中...';

    try {
        const result1 = await fetchData('https://api.example.com/data1');
        const result2 = await fetchData('https://api.example.com/data2');
        output.textContent = `请求结果:\n${JSON.stringify([result1, result2], null, 2)}`;
    } catch (error) {
        output.textContent = `发生错误: ${error.message}`;
    }
}

// ============================
// 使用 Promise 链式调用
// ============================

function loadDataWithPromises() {
    const output = document.getElementById('output');
    output.textContent = '加载中...';

    fetchData('https://api.example.com/data1')
        .then(result1 => {
            return fetchData('https://api.example.com/data2')
                .then(result2 => [result1, result2]);
        })
        .then(results => {
            output.textContent = `请求结果 (Promise 链式):\n${JSON.stringify(results, null, 2)}`;
        })
        .catch(error => {
            output.textContent = `发生错误 (Promise 链式): ${error.message}`;
        });
}

// ============================
// 绑定按钮事件
// ============================

document.getElementById('fetchDataBtn').addEventListener('click', () => {
    // 使用 async/await
    loadData();

    // 使用 Promise 链
    // loadDataWithPromises();
});
```

---

✅ 说明：

1. **关键对象**：`Promise`，用于表示异步操作结果。
2. **关键字**：

   * `async`：声明一个异步函数，内部可以使用 `await`。
   * `await`：等待 Promise 完成，并返回其结果。
3. **示例功能**：

   * 点击按钮触发异步请求。
   * 使用 `async/await` 和 `Promise` 两种方式处理异步。
   * 模拟请求成功或失败，展示错误处理。


// funcs/example_func2.js

function main() {
  const heading = document.createElement('h1');
  heading.textContent = '脚本 2 注入成功！';
  heading.style.color = 'red';
  document.body.prepend(heading);
  console.log('脚本 2 执行完毕。');
}
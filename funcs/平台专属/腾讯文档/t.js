

function input(value){
const inputElement = document.querySelector("#mainContainer > div.formula-bar > input");

// 确保找到了元素
if (inputElement) {
  // 1. 设置输入框的值为 "D1"
  inputElement.value = value;

  // 2. 创建并分派一个键盘事件，模拟 Enter 键按下
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true, // 事件能冒泡到父元素
    cancelable: true // 事件可被取消
  });

  inputElement.dispatchEvent(enterEvent);
}

}

input("D3");

function getRe(){

  return   document.querySelector("#alloy-simple-text-editor > p").textContent;
}


getRe()
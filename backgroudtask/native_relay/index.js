/**
 * Native Host 中继模块
 *
 * Background 维护唯一的 connectNative 连接，
 * 所有页面通过 chrome.runtime.sendMessage({ action: 'nativeMessage', ... }) 中转。
 */

const NATIVE_HOST = 'com.brochat.prompts_editor';
let nativePort = null;
let pendingRequests = [];

function connect() {
  if (nativePort) return;

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    console.log('[NativeRelay] 已连接');

    nativePort.onMessage.addListener((msg) => {
      if (pendingRequests.length > 0) {
        const { sendResponse } = pendingRequests.shift();
        sendResponse(msg);
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('[NativeRelay] 连接断开:', chrome.runtime.lastError?.message);
      nativePort = null;
      // 释放等待中的请求
      while (pendingRequests.length > 0) {
        const { sendResponse } = pendingRequests.shift();
        sendResponse({ status: 'error', message: 'Native host 连接断开' });
      }
    });
  } catch (err) {
    console.error('[NativeRelay] 连接失败:', err);
    nativePort = null;
  }
}

function disconnect() {
  if (nativePort) {
    nativePort.disconnect();
    nativePort = null;
  }
}

export function setupNativeRelay() {
  // 预连接
  connect();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'nativeMessage') return false;

    // 如果未连接则尝试连接
    if (!nativePort) {
      connect();
      if (!nativePort) {
        sendResponse({ status: 'error', message: 'Native host 不可用' });
        return false;
      }
    }

    pendingRequests.push({ sendResponse });

    try {
      nativePort.postMessage(message.payload);
    } catch (err) {
      pendingRequests.pop();
      sendResponse({ status: 'error', message: '发送失败: ' + err.message });
      return false;
    }

    // 保持 sendResponse 有效（异步）
    return true;
  });

  console.log('[NativeRelay] 中继监听已就绪');
}

export function getPlatformScriptFiles(platform) {
  if (platform === "chatgpt") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/chatgpt.js",
      "contentScripts/chatgpt.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/chatgptResponseListener.js",
    ];
  }

  if (platform === "doubao") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/doubao.js",
      "contentScripts/doubao.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/doubaoResponseListener.js",
    ];
  }

  return [`contentScripts/${platform}.js`];
}

export function getPlatformScriptFiles(platform) {
  if (platform === "chatgpt") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/chatgpt.js",
      "contentScripts/chatgpt.js",
      "contentScripts/chatResponse/chatgptResponseListener.js",
    ];
  }

  return [`contentScripts/${platform}.js`];
}

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

  if (platform === "claude") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/claude.js",
      "contentScripts/claude.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/claudeResponseListener.js",
    ];
  }

  if (platform === "gemini") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/gemini.js",
      "contentScripts/gemini.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/geminiResponseListener.js",
    ];
  }

  return [`contentScripts/${platform}.js`];
}

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

  if (platform === "deepseek") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/deepseek.js",
      "contentScripts/deepseek.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/deepseekResponseListener.js",
    ];
  }

  if (platform === "grok") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/grok.js",
      "contentScripts/grok.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/grokResponseListener.js",
    ];
  }

  if (platform === "glm") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/glm.js",
      "contentScripts/glm.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/glmResponseListener.js",
    ];
  }

  if (platform === "kimi") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/kimi.js",
      "contentScripts/kimi.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/kimiResponseListener.js",
    ];
  }

  if (platform === "yuanbao") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/yuanbao.js",
      "contentScripts/yuanbao.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/yuanbaoResponseListener.js",
    ];
  }

  if (platform === "tongyi") {
    return [
      "contentScripts/clipboardCapture/core.js",
      "contentScripts/clipboardCapture/configs/tongyi.js",
      "contentScripts/tongyi.js",
      "contentScripts/chatResponse/responseListenerCore.js",
      "contentScripts/chatResponse/tongyiResponseListener.js",
    ];
  }

  return [`contentScripts/${platform}.js`];
}

export function getPlatformScriptFiles(platform) {
  if (platform === "chatgpt") {
    return [
      "contentScripts/chatgpt.js",
      "contentScripts/chatResponse/chatgptResponseListener.js",
    ];
  }

  return [`contentScripts/${platform}.js`];
}

export async function main() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'chatgptCdpCopyLatest' }, (resp) => {
      resolve({
        success: !chrome.runtime.lastError && resp?.status !== 'error',
        resp,
        lastError: chrome.runtime.lastError?.message || null
      });
    });
  });
}

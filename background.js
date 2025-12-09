// Background script for message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVideoData") {
    // Handle video data requests
    chrome.storage.local.get(['videoQueue'], (result) => {
      sendResponse({ videoQueue: result.videoQueue || [] });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "saveVideoData") {
    chrome.storage.local.set({
      videoQueue: request.videoQueue,
      currentIndex: request.currentIndex || 0
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
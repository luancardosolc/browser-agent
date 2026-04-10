import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  // Listen for messages from content scripts and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_TAB_ID') {
      sendResponse({ tabId: sender.tab?.id });
      return true;
    }

    if (message.type === 'RELAY_TO_CONTENT') {
      const { tabId, payload } = message;
      chrome.tabs.sendMessage(tabId, payload, response => {
        sendResponse(response);
      });
      return true; // Keep channel open for async response
    }
  });

  // Context menu: "Extract Job Data"
  chrome.contextMenus?.create({
    id: 'extract_job',
    title: 'Extract Job Data',
    contexts: ['page'],
    documentUrlPatterns: ['https://www.linkedin.com/*'],
  });

  chrome.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'extract_job' && tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_COMMAND', command: {
        id: crypto.randomUUID(),
        intent: 'extract_data',
        data: {},
      }});
    }
  });
});

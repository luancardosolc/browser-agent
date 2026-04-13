import { defineContentScript } from 'wxt/sandbox';
import { engine } from '@/core/engine';
import { formAutofillPlugin } from '@/plugins/form-autofill';
import { jobApplyHelperPlugin } from '@/plugins/job-apply-helper';
import { scraperBasicPlugin } from '@/plugins/scraper-basic';
import { applySessionPlugin } from '@/plugins/apply-session';
import type { ExtensionMessage } from '@/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    // Register all plugins
    engine.registry.register(formAutofillPlugin);
    engine.registry.register(jobApplyHelperPlugin);
    engine.registry.register(scraperBasicPlugin);
    engine.registry.register(applySessionPlugin);

    // Listen for commands from background / popup
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, sendResponse) => {
        handleMessage(message).then(sendResponse).catch(err => {
          sendResponse({ error: err instanceof Error ? err.message : String(err) });
        });
        return true; // Keep channel open for async response
      },
    );

    console.log('[JobTracker Extension] Content script loaded', window.location.href);
  },
});

async function handleMessage(message: ExtensionMessage) {
  switch (message.type) {
    case 'GET_CONTEXT':
      return engine.refreshContext();

    case 'EXECUTE_COMMAND': {
      const result = await engine.dispatch(message.command);
      return result;
    }

    default:
      return { error: 'Unknown message type' };
  }
}

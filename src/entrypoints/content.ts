import { defineContentScript } from 'wxt/sandbox';
import { engine } from '@/core/engine';
import { formAutofillPlugin } from '@/plugins/form-autofill';
import { jobApplyHelperPlugin } from '@/plugins/job-apply-helper';
import { scraperBasicPlugin } from '@/plugins/scraper-basic';
import { applySessionPlugin } from '@/plugins/apply-session';
import type { ApplyQueueItem, ExtensionMessage } from '@/types';

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

    window.addEventListener('message', event => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'JOB_TRACKER_START_APPLY_SESSION') {
        const { jobId, sessionToken, url } = event.data as {
          jobId?: string;
          sessionToken?: string;
          url?: string;
        };

        if (!jobId || !sessionToken || !url) return;

        void chrome.runtime.sendMessage({
          type: 'START_APPLY_SESSION',
          jobId,
          sessionToken,
          url,
        } satisfies ExtensionMessage);
        return;
      }

      if (event.data.type === 'JOB_TRACKER_START_APPLY_QUEUE') {
        const sessions = (event.data.sessions ?? []) as ApplyQueueItem[];
        if (!Array.isArray(sessions) || sessions.length === 0) return;

        void chrome.runtime.sendMessage({
          type: 'START_APPLY_QUEUE',
          sessions,
        } satisfies ExtensionMessage);
      }
    });

    void chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' } satisfies ExtensionMessage);

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

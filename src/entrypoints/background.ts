import { defineBackground } from 'wxt/sandbox';
import type { ApplyQueueItem, ExtensionMessage } from '@/types';

export default defineBackground(() => {
  const pendingApplySessions = new Map<number, { jobId: string; sessionToken: string }>();
  const sessionQueue: ApplyQueueItem[] = [];
  let activeSession: ApplyQueueItem | null = null;
  let automationTabId: number | null = null;

  const setBadge = (text: string, color = '#2563eb') => {
    void chrome.action.setBadgeBackgroundColor({ color });
    void chrome.action.setBadgeText({ text });
  };

  const refreshQueueBadge = () => {
    if (activeSession) {
      setBadge('ACT', '#16a34a');
      return;
    }

    if (sessionQueue.length > 0) {
      setBadge(String(Math.min(sessionQueue.length, 99)), '#2563eb');
      return;
    }

    setBadge('');
  };

  const deliverStartSession = async (
    tabId: number,
    pending: { jobId: string; sessionToken: string },
    attempt = 1,
  ): Promise<void> => {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_COMMAND',
        command: {
          id: crypto.randomUUID(),
          intent: 'resume_apply',
          data: { action: 'start_session', jobId: pending.jobId, sessionToken: pending.sessionToken },
        },
      });

      pendingApplySessions.delete(tabId);
      setBadge('ACT', '#16a34a');
      console.log(`[background] Apply session delivered to tab ${tabId} on attempt ${attempt}`);
    } catch (error) {
      if (attempt >= 8) {
        setBadge('ERR', '#dc2626');
        console.error(`[background] Failed to deliver apply session to tab ${tabId}:`, error);
        return;
      }

      setBadge('WAIT', '#ca8a04');
      setTimeout(() => {
        const latest = pendingApplySessions.get(tabId);
        if (latest) {
          void deliverStartSession(tabId, latest, attempt + 1);
        }
      }, 500);
    }
  };

  const ensureTabReady = async (url: string): Promise<chrome.tabs.Tab> => {
    if (automationTabId) {
      try {
        const updated = await chrome.tabs.update(automationTabId, { active: true, url });
        return await waitForTabComplete(updated.id!);
      } catch {
        automationTabId = null;
      }
    }

    const existingTabs = await chrome.tabs.query({ url });
    const target = existingTabs[0]
      ? await chrome.tabs.update(existingTabs[0].id!, { active: true, url })
      : await chrome.tabs.create({ url, active: true });

    automationTabId = target.id ?? null;
    return waitForTabComplete(target.id!);
  };

  const waitForTabComplete = async (tabId: number): Promise<chrome.tabs.Tab> => {
    const current = await chrome.tabs.get(tabId);
    if (current.status === 'complete') return current;

    return new Promise((resolve) => {
      const onUpdated = (updatedTabId: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve(tab);
        }
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  };

  const startQueuedSession = async (session: ApplyQueueItem): Promise<void> => {
    activeSession = session;
    const tab = await ensureTabReady(session.url);
    if (!tab.id) throw new Error('No tab id available for apply session');
    automationTabId = tab.id;
    void chrome.tabs.sendMessage(tab.id, {
      type: 'QUEUE_PROGRESS',
      status: 'next_job',
      detail: `Abrindo a vaga ${session.jobId}...`,
    });
    pendingApplySessions.set(tab.id, { jobId: session.jobId, sessionToken: session.sessionToken });
    setBadge('GO', '#2563eb');
    await deliverStartSession(tab.id, { jobId: session.jobId, sessionToken: session.sessionToken });
  };

  const drainQueue = async (): Promise<void> => {
    if (activeSession || sessionQueue.length === 0) {
      refreshQueueBadge();
      return;
    }

    const next = sessionQueue.shift();
    if (!next) {
      refreshQueueBadge();
      return;
    }

    try {
      await startQueuedSession(next);
    } catch (error) {
      console.error('[background] Failed to start queued session:', error);
      activeSession = null;
      refreshQueueBadge();
      void drainQueue();
    }
  };

  const finishActiveSession = (reason: string) => {
    const finishedTabId = automationTabId;
    if (activeSession) {
      console.log(`[background] Session finished for job ${activeSession.jobId}: ${reason}`);
    }
    activeSession = null;
    if (sessionQueue.length === 0) {
      if (finishedTabId) {
        void chrome.tabs.sendMessage(finishedTabId, {
          type: 'QUEUE_PROGRESS',
          status: 'queue_finished',
          detail: 'Nao ha mais vagas na fila.',
        });
      }
      refreshQueueBadge();
      return;
    }

    refreshQueueBadge();
    void drainQueue();
  };

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    if ((message as { type?: string }).type === 'GET_TAB_ID') {
      sendResponse({ tabId: sender.tab?.id });
      return true;
    }

    if ((message as { type?: string }).type === 'RELAY_TO_CONTENT') {
      const relay = message as ExtensionMessage & { tabId: number; payload: unknown };
      chrome.tabs.sendMessage(relay.tabId, relay.payload, (response) => {
        sendResponse(response);
      });
      return true;
    }

    if (message.type === 'CONTENT_SCRIPT_READY' && sender.tab?.id) {
      const pending = pendingApplySessions.get(sender.tab.id);
      if (!pending) {
        return false;
      }

      setBadge('RDY', '#7c3aed');
      void deliverStartSession(sender.tab.id, pending);
      return false;
    }

    if (message.type === 'START_APPLY_SESSION') {
      const { jobId, sessionToken, url } = message;
      sessionQueue.length = 0;
      activeSession = null;
      sessionQueue.push({ jobId, sessionToken, url });
      void drainQueue()
        .then(() => sendResponse({ ok: true, queued: 1 }))
        .catch((error: unknown) => {
          sendResponse({ error: error instanceof Error ? error.message : String(error) });
        });
      return true;
    }

    if (message.type === 'START_APPLY_QUEUE') {
      sessionQueue.length = 0;
      activeSession = null;
      sessionQueue.push(...message.sessions);
      void drainQueue()
        .then(() => sendResponse({ ok: true, queued: message.sessions.length }))
        .catch((error: unknown) => {
          sendResponse({ error: error instanceof Error ? error.message : String(error) });
        });
      return true;
    }

    if (message.type === 'STATUS_UPDATE') {
      const reason = message.detail ?? message.status;
      if (message.status === 'closed' || message.status === 'completed' || message.status === 'error') {
        finishActiveSession(reason);
      }
      return false;
    }

    return false;
  });

  // Intercept new tabs opened from the automation tab during active session.
  // This handles LinkedIn non-Easy Apply: clicking "Apply" opens an external form.
  chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    if (!activeSession || details.sourceTabId !== automationTabId) return;

    const inherited = { jobId: activeSession.jobId, sessionToken: activeSession.sessionToken };
    automationTabId = details.tabId;
    pendingApplySessions.set(details.tabId, inherited);
    setBadge('GO', '#7c3aed');
    console.log(
      `[background] New tab ${details.tabId} opened from apply click. Inheriting session for job ${inherited.jobId}`,
    );

    // Wait for the new tab to fully load before delivering the session
    waitForTabComplete(details.tabId).then((tab) => {
      if (!tab.id) return;
      void deliverStartSession(tab.id, inherited);
    }).catch((err) => {
      console.error('[background] Failed to wait for new apply tab:', err);
    });
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (automationTabId === tabId) {
      automationTabId = null;
    }
    pendingApplySessions.delete(tabId);
  });

  chrome.contextMenus?.create({
    id: 'extract_job',
    title: 'Extract Job Data',
    contexts: ['page'],
    documentUrlPatterns: ['https://www.linkedin.com/*'],
  });

  chrome.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'extract_job' && tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_COMMAND',
        command: {
          id: crypto.randomUUID(),
          intent: 'extract_data',
          data: {},
        },
      });
    }
  });
});

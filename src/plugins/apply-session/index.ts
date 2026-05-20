import type { ApplySession, CommandResult, ExtensionMessage, PageContext, Plugin, PluginResult } from '@/types';
import { EXTERNAL_FORM_PAGE_TYPES } from '@/types';
import { buildSnapshot } from '@/extractors/snapshot-builder';
import { backendClient } from '@/communication/client';
import { engine } from '@/core/engine';

let currentSession: ApplySession | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let overlayEl: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

  overlayEl = document.createElement('div');
  overlayEl.id = 'browser-agent-apply-overlay';
  overlayEl.style.position = 'fixed';
  overlayEl.style.top = '16px';
  overlayEl.style.right = '16px';
  overlayEl.style.zIndex = '2147483647';
  overlayEl.style.maxWidth = '340px';
  overlayEl.style.padding = '10px 12px';
  overlayEl.style.borderRadius = '12px';
  overlayEl.style.background = 'rgba(17, 24, 39, 0.92)';
  overlayEl.style.color = '#fff';
  overlayEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  overlayEl.style.fontSize = '12px';
  overlayEl.style.lineHeight = '1.4';
  overlayEl.style.boxShadow = '0 12px 24px rgba(0,0,0,.24)';
  overlayEl.style.pointerEvents = 'none';
  document.body.appendChild(overlayEl);
  return overlayEl;
}

function updateOverlay(title: string, detail: string, tone: 'info' | 'success' | 'error' = 'info'): void {
  const el = ensureOverlay();
  const accent = tone === 'success' ? '#22c55e' : tone === 'error' ? '#ef4444' : '#60a5fa';
  el.style.border = `1px solid ${accent}`;
  el.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">${title}</div><div style="opacity:.9;">${detail}</div>`;
}

function removeOverlay(): void {
  overlayEl?.remove();
  overlayEl = null;
}

export const applySessionPlugin: Plugin = {
  name: 'apply_session',

  canHandle(ctx: PageContext): boolean {
    return (
      ctx.pageType === 'linkedin' ||
      ctx.pageType === 'linkedin_easy_apply' ||
      EXTERNAL_FORM_PAGE_TYPES.includes(ctx.pageType)
    );
  },

  async execute(_ctx: PageContext, data: Record<string, unknown>): Promise<PluginResult> {
    const action = data.action as string;

    if (action === 'start_session') {
      const jobId = data.jobId as string;
      const sessionToken = data.sessionToken as string;

      if (!jobId || !sessionToken) {
        return { status: 'error', error: 'start_session requires jobId and sessionToken' };
      }

      stopPolling();
      currentSession = { jobId, sessionToken, status: 'running' };
      updateOverlay('Auto Apply', 'Sessao iniciada. Sincronizando com o backend...');
      startPolling(sessionToken);

      console.log(`[apply-session] Session started. jobId=${jobId} token=${sessionToken}`);
      return { status: 'success', data: { sessionToken } };
    }

    if (action === 'stop_session') {
      stopPolling();
      removeOverlay();
      void chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'completed' });
      console.log('[apply-session] Session stopped.');
      return { status: 'success' };
    }

    return { status: 'error', error: `Unknown action: ${action}` };
  },
};

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type !== 'QUEUE_PROGRESS') return false;

  if (message.status === 'next_job') {
    updateOverlay('Auto Apply', message.detail ?? 'Abrindo a proxima vaga...');
    return false;
  }

  if (message.status === 'queue_finished') {
    updateOverlay('Auto Apply', message.detail ?? 'Fila concluida.', 'success');
    setTimeout(() => removeOverlay(), 2500);
    return false;
  }

  return false;
});

function startPolling(sessionToken: string): void {
  pollingInterval = setInterval(async () => {
    if (!currentSession) {
      stopPolling();
      return;
    }

    try {
      const command = await backendClient.pollCommand(sessionToken);
      if (!command) return;

      console.log(`[apply-session] Received command: ${command.intent}`);
      updateOverlay('Auto Apply', `Executando passo: ${command.intent}`);

      if (command.intent === 'send_snapshot') {
        const snapshot = buildSnapshot(currentSession.jobId, sessionToken);
        updateOverlay('Auto Apply', formatSnapshotSummary(snapshot));
        const nextCommands = await backendClient.submitSnapshot(snapshot);

        if (snapshot.metadata.jobClosed === true) {
          updateOverlay('Auto Apply', 'Vaga fechada detectada. Atualizando o backend e seguindo para a proxima.', 'success');
          void chrome.runtime.sendMessage({
            type: 'STATUS_UPDATE',
            status: 'closed',
            jobId: currentSession.jobId,
            sessionToken,
            detail: typeof snapshot.metadata.closedReason === 'string' ? snapshot.metadata.closedReason : 'closed_job',
          });
          stopPolling();
          return;
        }

        if (snapshot.metadata.applicationSubmitted === true || snapshot.metadata.alreadyApplied === true) {
          const detail =
            typeof snapshot.metadata.applicationSubmittedReason === 'string'
              ? snapshot.metadata.applicationSubmittedReason
              : typeof snapshot.metadata.alreadyAppliedReason === 'string'
                ? snapshot.metadata.alreadyAppliedReason
                : 'application_submitted';
          updateOverlay('Auto Apply', 'Candidatura concluida. Atualizando o backend e seguindo para a proxima.', 'success');
          void chrome.runtime.sendMessage({
            type: 'STATUS_UPDATE',
            status: 'completed',
            jobId: currentSession.jobId,
            sessionToken,
            detail,
          });
          stopPolling();
          return;
        }

        for (const nextCommand of nextCommands) {
          if (nextCommand.intent === 'send_snapshot') continue;
          updateOverlay('Auto Apply', `Comando retornado: ${nextCommand.intent}`);
          const result = await engine.dispatch(nextCommand);
          await handleCommandResult(nextCommand, result);
        }
        return;
      }

      const result = await engine.dispatch(command);
      await handleCommandResult(command, result);
    } catch (err) {
      updateOverlay('Auto Apply', err instanceof Error ? err.message : String(err), 'error');
      console.error('[apply-session] Polling error:', err);
    }
  }, 2000);
}

function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  currentSession = null;
}

function formatSnapshotSummary(snapshot: {
  pageType: string;
  fields: { label: string }[];
  buttons: { label: string }[];
  errors: string[];
  metadata: Record<string, unknown>;
}): string {
  const parts = [
    String(snapshot.metadata.pageState ?? snapshot.pageType),
    snapshot.pageType,
    `${snapshot.fields.length} campo(s)`,
    `${snapshot.buttons.length} botao(oes)`,
  ];

  const stepIndicator = snapshot.metadata.stepIndicator;
  if (typeof stepIndicator === 'string' && stepIndicator) {
    parts.push(`step: ${stepIndicator}`);
  }

  if (snapshot.errors.length > 0) {
    parts.push(`${snapshot.errors.length} erro(s)`);
  }

  const primaryAction = snapshot.metadata.primaryActionLabel;
  if (typeof primaryAction === 'string' && primaryAction) {
    parts.push(`acao: ${primaryAction}`);
  }

  const closedReason = snapshot.metadata.closedReason;
  if (typeof closedReason === 'string' && closedReason) {
    parts.push(`status: ${closedReason}`);
  }

  const submittedReason = snapshot.metadata.applicationSubmittedReason ?? snapshot.metadata.alreadyAppliedReason;
  if (typeof submittedReason === 'string' && submittedReason) {
    parts.push(`resultado: ${submittedReason}`);
  }

  return `Snapshot enviado: ${parts.join(' | ')}`;
}

async function handleCommandResult(command: { intent: string; data?: Record<string, unknown> }, result: CommandResult): Promise<void> {
  const { intent } = command;
  if (result.status === 'error') {
    const tried = Array.isArray(result.data?.tried) ? result.data.tried.join(' | ') : '';
    updateOverlay(
      'Auto Apply',
      `${intent} falhou: ${result.error ?? 'erro desconhecido'}${tried ? ` | tentativas: ${tried}` : ''}`,
      'error',
    );
    console.error(`[apply-session] Command failed: ${intent}`, result);
    return;
  }

  if (intent === 'click') {
    updateOverlay('Auto Apply', 'Clique executado. Aguardando proximo passo...');
    return;
  }

  if (intent === 'navigate') {
    updateOverlay('Auto Apply', 'Navegando para a vaga...');
    return;
  }

  if (intent === 'autofill_form') {
    const pluginResults = Array.isArray(result.data?.pluginResults) ? result.data.pluginResults : [];
    const autofillResult = pluginResults.find(
      (pluginResult) => pluginResult && typeof pluginResult === 'object' && 'data' in pluginResult,
    ) as { data?: Record<string, unknown>; pendingQuestions?: unknown[] } | undefined;

    const filledCount = Number(autofillResult?.data?.filledCount ?? 0);
    const detectedFields = Number(autofillResult?.data?.detectedFields ?? 0);
    const pendingCount = Array.isArray(autofillResult?.pendingQuestions) ? autofillResult.pendingQuestions.length : 0;
    const suffix = pendingCount > 0 ? ` | ${pendingCount} pendencia(s)` : '';
    updateOverlay('Auto Apply', `Autofill: ${filledCount}/${detectedFields} campo(s)${suffix}`);

    if (pendingCount > 0 && currentSession) {
      const pendingQuestions = autofillResult?.pendingQuestions as Array<{
        label: string;
        required: boolean;
        fieldType?: string;
        options?: string[];
      }>;
      const answers = await collectAnswersFromUser(currentSession.jobId, pendingQuestions);
      if (Object.keys(answers).length > 0) {
        const retryResult = await engine.dispatch({
          id: crypto.randomUUID(),
          intent: 'autofill_form',
          data: { ...(command.data ?? {}), answers: { ...(command.data?.answers ?? {}), ...answers } },
        });
        const retryPluginResults = Array.isArray(retryResult.data?.pluginResults) ? retryResult.data.pluginResults : [];
        const retryAutofill = retryPluginResults.find(
          (pluginResult) => pluginResult && typeof pluginResult === 'object' && 'data' in pluginResult,
        ) as { data?: Record<string, unknown>; pendingQuestions?: unknown[] } | undefined;
        const retryFilled = Number(retryAutofill?.data?.filledCount ?? 0);
        const retryDetected = Number(retryAutofill?.data?.detectedFields ?? detectedFields);
        const retryPending = Array.isArray(retryAutofill?.pendingQuestions) ? retryAutofill.pendingQuestions.length : 0;
        updateOverlay(
          'Auto Apply',
          retryPending > 0
            ? `Autofill: ${retryFilled}/${retryDetected} campo(s) | ${retryPending} pendencia(s)`
            : `Autofill: ${retryFilled}/${retryDetected} campo(s)`,
          retryPending > 0 ? 'info' : 'success',
        );

        if (retryPending === 0) {
          updateOverlay('Auto Apply', 'Respostas aplicadas. Reavaliando o passo atual...');
          await continueFromFreshSnapshot();
        }
      }
    }
  }
}

async function collectAnswersFromUser(
  jobId: string,
  pendingQuestions: Array<{ label: string; required: boolean; fieldType?: string; options?: string[] }>,
): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};

  for (const question of pendingQuestions) {
    await backendClient.sendPendingQuestion(jobId, {
      label: question.label,
      required: question.required,
      fieldType: (question.fieldType as 'text' | 'number' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'file' | undefined) ?? 'text',
      options: question.options,
    });

    const optionsHint = question.options?.length ? `\nOpcoes: ${question.options.join(' | ')}` : '';
    const rawAnswer = window.prompt(`${question.label}${optionsHint}`, '');
    if (!rawAnswer || !rawAnswer.trim()) continue;

    const normalizedPattern = question.label.toLowerCase().trim().replace(/\s+/g, ' ');
    const answer = rawAnswer.trim();
    answers[question.label] = answer;
    await backendClient.saveAnswer(normalizedPattern, answer);
  }

  return answers;
}

async function continueFromFreshSnapshot(): Promise<void> {
  if (!currentSession) return;

  const snapshot = buildSnapshot(currentSession.jobId, currentSession.sessionToken);
  updateOverlay('Auto Apply', formatSnapshotSummary(snapshot));
  const nextCommands = await backendClient.submitSnapshot(snapshot);

  for (const nextCommand of nextCommands) {
    if (nextCommand.intent === 'send_snapshot') continue;
    updateOverlay('Auto Apply', `Comando retornado: ${nextCommand.intent}`);
    const result = await engine.dispatch(nextCommand);
    await handleCommandResult(nextCommand, result);
  }
}

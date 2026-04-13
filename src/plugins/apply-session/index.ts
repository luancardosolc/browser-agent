import type { Plugin, PageContext, PluginResult, ApplySession } from '@/types';
import { buildSnapshot } from '@/extractors/snapshot-builder';
import { backendClient } from '@/communication/client';
import { engine } from '@/core/engine';

// Estado da sessão em memória — singleton do plugin
let currentSession: ApplySession | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * apply_session — orquestra o ciclo de auto-apply via extensão.
 *
 * Ações:
 *   start_session: inicia polling, envia snapshots para a API
 *   stop_session:  para o polling e limpa o estado
 *
 * Fluxo de polling (a cada 2s):
 *   GET /automation/poll/:sessionToken → Command | null
 *   Se send_snapshot: buildSnapshot() → POST /automation/snapshot → executa Command[] retornados
 *   Caso contrário: engine.dispatch(command)
 */
export const applySessionPlugin: Plugin = {
  name: 'apply_session',

  canHandle(ctx: PageContext): boolean {
    return ctx.pageType === 'linkedin' || ctx.pageType === 'linkedin_easy_apply';
  },

  async execute(_ctx: PageContext, data: Record<string, unknown>): Promise<PluginResult> {
    const action = data.action as string;

    if (action === 'start_session') {
      const jobId = data.jobId as string;
      const sessionToken = data.sessionToken as string;

      if (!jobId || !sessionToken) {
        return { status: 'error', error: 'start_session requires jobId and sessionToken' };
      }

      // Para polling anterior se existir
      stopPolling();

      currentSession = { jobId, sessionToken, status: 'running' };
      startPolling(sessionToken);

      console.log(`[apply-session] Session started. jobId=${jobId} token=${sessionToken}`);
      return { status: 'success', data: { sessionToken } };
    }

    if (action === 'stop_session') {
      stopPolling();
      console.log('[apply-session] Session stopped.');
      return { status: 'success' };
    }

    return { status: 'error', error: `Unknown action: ${action}` };
  },
};

// ─── Polling loop ─────────────────────────────────────────────────────────────

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

      if (command.intent === 'send_snapshot') {
        // Constrói snapshot do DOM atual e envia para a API
        const snapshot = buildSnapshot(currentSession.jobId, sessionToken);
        const nextCommands = await backendClient.submitSnapshot(snapshot);

        // Executa cada comando retornado pela API em sequência
        for (const cmd of nextCommands) {
          if (cmd.intent !== 'send_snapshot') {
            await engine.dispatch(cmd);
          }
          // send_snapshot na resposta será capturado no próximo poll
        }
      } else {
        await engine.dispatch(command);
      }
    } catch (err) {
      console.error('[apply-session] Polling error:', err);
      // Não para o polling em erros isolados — pode ser flakiness de rede
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

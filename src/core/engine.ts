import type { Command, CommandResult, PageContext } from '@/types';
import { PluginRegistry } from './plugin-registry';
import { detectContext } from '@/context/detector';
import { backendClient } from '@/communication/client';
import { extractPage } from '@/extractors/dom-extractor';
import { clickElement, navigate } from '@/actions/executor';

// ─── Core Engine ─────────────────────────────────────────────────────────────
// Central orchestrator: receives commands and dispatches to plugins or actions.

export class CoreEngine {
  public readonly registry = new PluginRegistry();
  private context: PageContext | null = null;

  /** Refreshes the current page context. */
  refreshContext(): PageContext {
    this.context = detectContext();
    return this.context;
  }

  /** Dispatches an incoming command to the appropriate handler. */
  async dispatch(command: Command): Promise<CommandResult> {
    const ctx = this.refreshContext();

    try {
      switch (command.intent) {
        case 'get_context':
          return { commandId: command.id, status: 'success', data: { context: ctx } };

        case 'extract_data':
          return {
            commandId: command.id,
            status: 'success',
            data: { extracted: extractPage() },
          };

        case 'click': {
          const selector = command.data.selector as string;
          const ok = await clickElement(selector);
          return {
            commandId: command.id,
            status: ok ? 'success' : 'error',
            error: ok ? undefined : `Element not found: ${selector}`,
          };
        }

        case 'navigate': {
          await navigate(command.data.url as string);
          return { commandId: command.id, status: 'success' };
        }

        case 'autofill_form':
        case 'resume_apply': {
          const results = await this.registry.executeAll(ctx, command.data);
          const hasError = results.some(r => r.status === 'error');
          const hasPending = results.some(r => r.status === 'pending');
          return {
            commandId: command.id,
            status: hasPending ? 'pending' : hasError ? 'error' : 'success',
            data: { pluginResults: results },
          };
        }

        default:
          return {
            commandId: command.id,
            status: 'error',
            error: `Unknown intent: ${command.intent}`,
          };
      }
    } catch (err) {
      return {
        commandId: command.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Sends a command result back to the backend. */
  async reportResult(result: CommandResult): Promise<void> {
    await backendClient.executeCommand({
      id: result.commandId,
      intent: 'autofill_form',
      data: result as unknown as Record<string, unknown>,
    });
  }
}

export const engine = new CoreEngine();

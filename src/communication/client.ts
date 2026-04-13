import type { Command, CommandResult, DomSnapshot, KnowledgeEntry, PendingQuestion } from '@/types';
import { getConfig } from './config';

class BackendClient {
  private async baseUrl(): Promise<string> {
    const cfg = await getConfig();
    return cfg.backendUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const base = await this.baseUrl();
    const cfg = await getConfig();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const res = await fetch(`${base}${path}`, { headers, ...options });
    if (!res.ok) throw new Error(`Backend ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async getKnowledge(): Promise<KnowledgeEntry[]> {
    return this.request<KnowledgeEntry[]>('/automation/knowledge');
  }

  async sendPendingQuestion(jobId: string, question: PendingQuestion): Promise<void> {
    await this.request('/automation/pending-question', {
      method: 'POST',
      body: JSON.stringify({ jobId, question }),
    });
  }

  async executeCommand(command: Command): Promise<CommandResult> {
    return this.request<CommandResult>('/automation/execute', {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  async saveAnswer(pattern: string, answer: string): Promise<void> {
    await this.request('/automation/knowledge', {
      method: 'POST',
      body: JSON.stringify({ pattern, answer }),
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Polling: verifica se a API tem um próximo comando para esta sessão.
   * Retorna null quando não há comando pendente ou em caso de erro de rede.
   */
  async pollCommand(sessionToken: string): Promise<Command | null> {
    try {
      return await this.request<Command | null>(`/automation/poll/${sessionToken}`);
    } catch {
      return null;
    }
  }

  /**
   * Envia um snapshot do DOM para a API processar com LLM.
   * Retorna a lista de comandos que a extensão deve executar.
   */
  async submitSnapshot(snapshot: DomSnapshot): Promise<Command[]> {
    try {
      return await this.request<Command[]>('/automation/snapshot', {
        method: 'POST',
        body: JSON.stringify(snapshot),
      });
    } catch {
      return [];
    }
  }
}

export const backendClient = new BackendClient();

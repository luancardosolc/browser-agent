import type { Command, CommandResult, KnowledgeEntry, PendingQuestion } from '@/types';

const BASE_URL = 'http://localhost:3001';

class BackendClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`Backend ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  /** Pull all knowledge entries from the backend knowledge base. */
  async getKnowledge(): Promise<KnowledgeEntry[]> {
    return this.request<KnowledgeEntry[]>('/automation/knowledge');
  }

  /** Send a pending question to be answered by the user in the Job Tracker UI. */
  async sendPendingQuestion(
    jobId: string,
    question: PendingQuestion,
  ): Promise<void> {
    await this.request('/automation/pending-question', {
      method: 'POST',
      body: JSON.stringify({ jobId, question }),
    });
  }

  /** Execute a command on the backend (e.g. trigger apply flow). */
  async executeCommand(command: Command): Promise<CommandResult> {
    return this.request<CommandResult>('/automation/execute', {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  /** Save a user-provided answer to the knowledge base. */
  async saveAnswer(pattern: string, answer: string): Promise<void> {
    await this.request('/automation/knowledge', {
      method: 'POST',
      body: JSON.stringify({ pattern, answer }),
    });
  }

  /** Health check — returns true when backend is reachable. */
  async ping(): Promise<boolean> {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const backendClient = new BackendClient();

const STORAGE_KEY = 'agent_config';

export interface AgentConfig {
  backendUrl: string;
  apiKey?: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  backendUrl: 'http://localhost:3001',
};

export async function getConfig(): Promise<AgentConfig> {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    return { ...DEFAULT_CONFIG, ...(stored[STORAGE_KEY] ?? {}) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(config: Partial<AgentConfig>): Promise<void> {
  const current = await getConfig();
  await chrome.storage.sync.set({ [STORAGE_KEY]: { ...current, ...config } });
}

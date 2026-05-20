import type { Plugin, PageContext, PluginResult } from '@/types';

export class PluginRegistry {
  private plugins: Plugin[] = [];

  register(plugin: Plugin): void {
    if (this.plugins.some(p => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    this.plugins.push(plugin);
  }

  getHandlers(context: PageContext): Plugin[] {
    return this.plugins.filter(p => p.canHandle(context));
  }

  getByName(name: string): Plugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  async executeAll(
    context: PageContext,
    data: Record<string, unknown>,
  ): Promise<PluginResult[]> {
    const handlers = this.getHandlers(context);
    const results = await Promise.allSettled(
      handlers.map(p => p.execute(context, data)),
    );
    return results.map(r =>
      r.status === 'fulfilled'
        ? r.value
        : {
            status: 'error' as const,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          },
    );
  }

  async executeByName(
    name: string,
    context: PageContext,
    data: Record<string, unknown>,
  ): Promise<PluginResult[]> {
    const plugin = this.getByName(name);
    if (!plugin) {
      return [{ status: 'error', error: `Plugin "${name}" not found` }];
    }

    if (!plugin.canHandle(context)) {
      return [{ status: 'error', error: `Plugin "${name}" cannot handle page type "${context.pageType}"` }];
    }

    try {
      return [await plugin.execute(context, data)];
    } catch (error) {
      return [{
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }];
    }
  }
}

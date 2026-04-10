import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../src/core/plugin-registry';
import type { Plugin, PageContext, PluginResult } from '../src/types';

const mockContext: PageContext = {
  url: 'https://example.com/apply',
  pageType: 'form',
  title: 'Apply',
  metadata: {},
};

const makePlugin = (name: string, handles: boolean, result: PluginResult): Plugin => ({
  name,
  canHandle: () => handles,
  execute: async () => result,
});

describe('PluginRegistry', () => {
  it('registers plugins without duplicates', () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin('p1', true, { status: 'success' }));
    expect(() => reg.register(makePlugin('p1', true, { status: 'success' }))).toThrow();
  });

  it('returns only matching handlers', () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin('match', true, { status: 'success' }));
    reg.register(makePlugin('skip', false, { status: 'success' }));
    expect(reg.getHandlers(mockContext)).toHaveLength(1);
    expect(reg.getHandlers(mockContext)[0].name).toBe('match');
  });

  it('executes all matching plugins and returns results', async () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin('p1', true, { status: 'success', data: { x: 1 } }));
    reg.register(makePlugin('p2', true, { status: 'error', error: 'oops' }));
    const results = await reg.executeAll(mockContext, {});
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('error');
  });
});

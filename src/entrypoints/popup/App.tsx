import React, { useEffect, useState } from 'react';
import type { PageContext, CommandResult } from '@/types';
import { getConfig, setConfig } from '@/communication/config';

type Tab = 'agent' | 'settings';
type Status = 'idle' | 'loading' | 'success' | 'error' | 'pending';

export function PopupApp() {
  const [tab, setTab] = useState<Tab>('agent');
  const [context, setContext] = useState<PageContext | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadContext();
    loadConfig();
  }, []);

  useEffect(() => {
    if (tab === 'agent') checkBackend();
  }, [tab, backendUrl]);

  async function loadConfig() {
    const cfg = await getConfig();
    setBackendUrl(cfg.backendUrl);
    setApiKey(cfg.apiKey ?? '');
  }

  async function saveConfig() {
    await setConfig({ backendUrl, apiKey: apiKey || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    checkBackend();
  }

  async function sendToContent<T>(message: unknown): Promise<T> {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) throw new Error('No active tab');
    return chrome.tabs.sendMessage(activeTab.id, message) as Promise<T>;
  }

  async function loadContext() {
    try {
      const ctx = await sendToContent<PageContext>({ type: 'GET_CONTEXT' });
      setContext(ctx);
    } catch { /* content script not loaded on this page */ }
  }

  async function checkBackend() {
    try {
      const cfg = await getConfig();
      const res = await fetch(`${cfg.backendUrl}/health`);
      setBackendOnline(res.ok);
    } catch {
      setBackendOnline(false);
    }
  }

  async function runCommand(intent: string, data: Record<string, unknown> = {}) {
    setStatus('loading');
    try {
      const result = await sendToContent<CommandResult>({
        type: 'EXECUTE_COMMAND',
        command: { id: crypto.randomUUID(), intent, data },
      });
      setLastResult(result);
      setStatus(result.status as Status);
    } catch (err) {
      setStatus('error');
      setLastResult({ commandId: '', status: 'error', error: String(err) });
    }
  }

  return (
    <div style={{ width: 320, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 13, background: '#f9fafb', color: '#111' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <strong style={{ fontSize: 14 }}>Browser Agent</strong>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          background: backendOnline === null ? '#9ca3af' : backendOnline ? '#22c55e' : '#ef4444',
        }} title={backendOnline ? 'Backend online' : 'Backend offline'} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        {(['agent', 'settings'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab === t ? 600 : 400,
            borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
            color: tab === t ? '#2563eb' : '#6b7280',
          }}>
            {t === 'agent' ? 'Agent' : 'Settings'}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {tab === 'agent' && (
          <>
            {context && (
              <div style={{ marginBottom: 12, padding: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>Current page</div>
                <div style={{ fontWeight: 500 }}>{context.pageType}</div>
                <div style={{ color: '#6b7280', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{context.title}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <button onClick={() => runCommand('autofill_form')} disabled={status === 'loading'} style={btnStyle}>Autofill Form</button>
              <button onClick={() => runCommand('extract_data')} disabled={status === 'loading'} style={btnStyle}>Extract Data</button>
              <button onClick={loadContext} style={{ ...btnStyle, color: '#6b7280', fontSize: 12 }}>Refresh Context</button>
            </div>
            {status !== 'idle' && (
              <div style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 12,
                background: status === 'success' ? '#dcfce7' : status === 'error' ? '#fee2e2' : status === 'pending' ? '#fef9c3' : '#f3f4f6',
                color: status === 'success' ? '#166534' : status === 'error' ? '#991b1b' : status === 'pending' ? '#854d0e' : '#374151',
              }}>
                {status === 'loading' && 'Running...'}
                {lastResult?.error && `Error: ${lastResult.error}`}
                {lastResult?.status === 'success' && 'Done'}
                {lastResult?.status === 'pending' && 'Waiting for user input...'}
              </div>
            )}
          </>
        )}

        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Backend URL</label>
              <input
                value={backendUrl}
                onChange={e => setBackendUrl(e.target.value)}
                placeholder="http://localhost:3001"
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>API Key (optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Bearer token"
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={saveConfig} style={{ ...btnStyle, background: '#2563eb', color: '#fff', border: 'none', textAlign: 'center' }}>
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6,
  background: '#fff', cursor: 'pointer', fontSize: 13, textAlign: 'left',
};

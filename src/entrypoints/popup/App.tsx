import React, { useEffect, useState } from 'react';
import type { PageContext, CommandResult } from '@/types';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'pending';

export function PopupApp() {
  const [context, setContext] = useState<PageContext | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    loadContext();
    checkBackend();
  }, []);

  async function sendToContent<T>(message: unknown): Promise<T> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    return chrome.tabs.sendMessage(tab.id, message) as Promise<T>;
  }

  async function loadContext() {
    try {
      const ctx = await sendToContent<PageContext>({ type: 'GET_CONTEXT' });
      setContext(ctx);
    } catch {
      // Content script not loaded on this page
    }
  }

  async function checkBackend() {
    try {
      const res = await fetch('http://localhost:3001/health');
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
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>Job Tracker Agent</strong>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: backendOnline === null ? '#9ca3af' : backendOnline ? '#22c55e' : '#ef4444',
        }} title={backendOnline ? 'Backend online' : 'Backend offline'} />
      </div>

      {/* Page context */}
      {context && (
        <div style={{ marginBottom: 12, padding: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>Current page</div>
          <div style={{ fontWeight: 500 }}>{context.pageType}</div>
          <div style={{ color: '#6b7280', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {context.title}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <button onClick={() => runCommand('get_context')} disabled={status === 'loading'} style={btnStyle}>
          Refresh Context
        </button>
        <button onClick={() => runCommand('autofill_form')} disabled={status === 'loading'} style={btnStyle}>
          Autofill Form
        </button>
        <button onClick={() => runCommand('extract_data')} disabled={status === 'loading'} style={btnStyle}>
          Extract Data
        </button>
      </div>

      {/* Status */}
      {status !== 'idle' && (
        <div style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 12,
          background: status === 'success' ? '#dcfce7' : status === 'error' ? '#fee2e2' : status === 'pending' ? '#fef9c3' : '#f3f4f6',
          color: status === 'success' ? '#166534' : status === 'error' ? '#991b1b' : status === 'pending' ? '#854d0e' : '#374151',
        }}>
          {status === 'loading' ? 'Running...' : null}
          {lastResult?.error ? `Error: ${lastResult.error}` : null}
          {lastResult?.status === 'success' ? 'Done' : null}
          {lastResult?.status === 'pending' ? 'Waiting for user input...' : null}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '7px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  textAlign: 'left',
};

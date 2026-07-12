/**
 * Workbench request channels over the wire — the forwarding seam's
 * laws: frames leave stamped with the TAB's active workspace (and, for
 * a Send, its active environment) unless the caller already scoped
 * them; a Send that the daemon refuses or a dead wire resolves as an
 * error SNAPSHOT (`success: true` + `snapshot.error` — the response
 * panel's honest degrade), while jar-channel rejections rethrow so the
 * row hides itself; a successful round-trip passes the daemon's
 * payload through untouched.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: null as string | null,
  activeEnvironmentId: null as string | null,
}));

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => h.activeEnvironmentId,
}));

import { forwardRequestsRpc, isForwardedRequestsChannel } from '@/host/wire-requests-rpc';
import { handleWireRpcResponseFrame, setWireRpcSender } from '@/host/wire-rpc';

describe('wire-requests-rpc', () => {
  let sent: Record<string, unknown>[];

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    sent = [];
    h.activeWorkspaceId = 'ws-tab';
    h.activeEnvironmentId = null;
    setWireRpcSender((frame) => {
      sent.push(frame);
      return true;
    });
  });

  it('owns exactly the three forwarded channels', () => {
    expect(isForwardedRequestsChannel('executeRequest')).toBe(true);
    expect(isForwardedRequestsChannel('getCookieJarSummary')).toBe(true);
    expect(isForwardedRequestsChannel('clearCookieJar')).toBe(true);
    expect(isForwardedRequestsChannel('getStatusSnapshot')).toBe(false);
    expect(isForwardedRequestsChannel(undefined)).toBe(false);
  });

  it('stamps a Send with the tab active workspace and environment', async () => {
    h.activeEnvironmentId = 'env-tab';
    const call = forwardRequestsRpc({ type: 'executeRequest', draft: { url: 'https://api.openheaders.io/x' } });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: 'executeRequest', workspaceId: 'ws-tab', environmentId: 'env-tab' });
    handleWireRpcResponseFrame({ type: 'executeRequest:response', payload: { success: true, snapshot: { id: 's' } } });
    await expect(call).resolves.toEqual({ success: true, snapshot: { id: 's' } });
  });

  it('never overrides a caller-scoped workspace or environment', async () => {
    h.activeEnvironmentId = 'env-tab';
    const call = forwardRequestsRpc({
      type: 'executeRequest',
      draft: {},
      workspaceId: 'ws-pin',
      environmentId: 'env-pin',
    });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ workspaceId: 'ws-pin', environmentId: 'env-pin' });
    handleWireRpcResponseFrame({ type: 'executeRequest:response', payload: { success: true } });
    await call;
  });

  it('omits the stamps when the tab has no active workspace or environment', async () => {
    h.activeWorkspaceId = null;
    const call = forwardRequestsRpc({ type: 'executeRequest', draft: {} });
    await Promise.resolve();
    expect(sent[0]).not.toHaveProperty('workspaceId');
    expect(sent[0]).not.toHaveProperty('environmentId');
    handleWireRpcResponseFrame({ type: 'executeRequest:response', payload: { success: true } });
    await call;
  });

  it('maps a daemon refusal to an error snapshot, never a rejection', async () => {
    const call = forwardRequestsRpc({ type: 'executeRequest', draft: {} });
    await Promise.resolve();
    handleWireRpcResponseFrame({
      type: 'executeRequest:response',
      __error: 'Sending requests from connected devices is disabled on this host. Enable it in Settings → Backend.',
    });
    const result = (await call) as { success: boolean; snapshot?: { error: string | null } };
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toMatch(/disabled on this host/);
  });

  it('maps a dead wire to an error snapshot for a Send', async () => {
    setWireRpcSender(() => false);
    const result = (await forwardRequestsRpc({ type: 'executeRequest', draft: {} })) as {
      success: boolean;
      snapshot?: { error: string | null };
    };
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toBe('daemon wire is not connected');
  });

  it('stamps jar channels with the tab workspace and passes the payload through', async () => {
    const call = forwardRequestsRpc({ type: 'getCookieJarSummary' });
    await Promise.resolve();
    expect(sent[0]).toEqual({ type: 'getCookieJarSummary', workspaceId: 'ws-tab' });
    handleWireRpcResponseFrame({ type: 'getCookieJarSummary:response', payload: { cookies: [] } });
    await expect(call).resolves.toEqual({ cookies: [] });
  });

  it('rethrows jar-channel rejections so the row hides itself', async () => {
    const call = forwardRequestsRpc({ type: 'clearCookieJar' });
    await Promise.resolve();
    handleWireRpcResponseFrame({
      type: 'clearCookieJar:response',
      __error: 'permission denied: workspace.write on ws-tab (no-grant)',
    });
    await expect(call).rejects.toThrow('permission denied');
  });
});

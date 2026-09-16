/**
 * Workbench gRPC channels over the wire — the forwarding seam's laws
 * after Phase W (the HTTP send answers in the tab — see
 * `tab-requests-rpc.test.ts`): an Invoke leaves stamped with the TAB's
 * active workspace and its active environment — verbatim tri-state,
 * so a null pointer rides as an explicit "No environment" — unless
 * the caller already scoped them; an Invoke the daemon refuses or a
 * dead wire resolves as an error SNAPSHOT (`success: true` +
 * `snapshot.error` — the response pane's honest degrade); the riders
 * pass the daemon's payload through untouched.
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

  it('owns exactly the gRPC channels — the HTTP send, its Stop and the jar trio answer in the tab', () => {
    expect(isForwardedRequestsChannel('executeGrpcRequest')).toBe(true);
    expect(isForwardedRequestsChannel('sendGrpcStreamMessage')).toBe(true);
    expect(isForwardedRequestsChannel('endGrpcClientStream')).toBe(true);
    expect(isForwardedRequestsChannel('executeRequest')).toBe(false);
    expect(isForwardedRequestsChannel('executeGraphqlRequest')).toBe(false);
    expect(isForwardedRequestsChannel('abortRequestSend')).toBe(false);
    expect(isForwardedRequestsChannel('getCookieJarSummary')).toBe(false);
    expect(isForwardedRequestsChannel('clearCookieJar')).toBe(false);
    expect(isForwardedRequestsChannel('getStatusSnapshot')).toBe(false);
    expect(isForwardedRequestsChannel(undefined)).toBe(false);
  });

  it('stamps an Invoke with the tab active workspace and environment', async () => {
    h.activeEnvironmentId = 'env-tab';
    const call = forwardRequestsRpc({ type: 'executeGrpcRequest', draft: { url: 'grpc.openheaders.io:443' } });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: 'executeGrpcRequest', workspaceId: 'ws-tab', environmentId: 'env-tab' });
    handleWireRpcResponseFrame({
      type: 'executeGrpcRequest:response',
      payload: { success: true, snapshot: { httpStatus: 200 } },
    });
    await expect(call).resolves.toEqual({ success: true, snapshot: { httpStatus: 200 } });
  });

  it('stamps a No-environment tab as an explicit null — never a silent omission', async () => {
    h.activeEnvironmentId = null;
    const call = forwardRequestsRpc({ type: 'executeGrpcRequest', draft: { url: 'grpc.openheaders.io:443' } });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: 'executeGrpcRequest', workspaceId: 'ws-tab', environmentId: null });
    handleWireRpcResponseFrame({ type: 'executeGrpcRequest:response', payload: { success: true } });
    await call;
  });

  it('never overrides a caller-scoped workspace or environment', async () => {
    h.activeEnvironmentId = 'env-tab';
    const call = forwardRequestsRpc({
      type: 'executeGrpcRequest',
      draft: {},
      workspaceId: 'ws-caller',
      environmentId: 'env-caller',
    });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ workspaceId: 'ws-caller', environmentId: 'env-caller' });
    handleWireRpcResponseFrame({ type: 'executeGrpcRequest:response', payload: { success: true } });
    await call;
  });

  it('omits the stamps when the tab has no active workspace', async () => {
    h.activeWorkspaceId = null;
    h.activeEnvironmentId = 'env-tab';
    const call = forwardRequestsRpc({ type: 'executeGrpcRequest', draft: {} });
    await Promise.resolve();
    expect(sent[0]).toEqual({ type: 'executeGrpcRequest', draft: {} });
    handleWireRpcResponseFrame({ type: 'executeGrpcRequest:response', payload: { success: true } });
    await call;
  });

  it('maps a daemon refusal of an Invoke to an error snapshot, never a rejection', async () => {
    const call = forwardRequestsRpc({ type: 'executeGrpcRequest', draft: {} });
    await Promise.resolve();
    handleWireRpcResponseFrame({
      type: 'executeGrpcRequest:response',
      __error:
        "Sending requests from this device's browsers is disabled on this host. Enable it in Settings → Backend.",
    });
    const result = (await call) as { success: boolean; snapshot?: { error: string | null } };
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toMatch(/disabled on this host/);
  });

  it('maps a dead wire to an error snapshot for an Invoke', async () => {
    setWireRpcSender(() => false);
    const result = (await forwardRequestsRpc({ type: 'executeGrpcRequest', draft: {} })) as {
      success: boolean;
      snapshot?: { error: string | null };
    };
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toBe('daemon wire is not connected');
  });

  it('forwards the gRPC upstream riders by sendId and relays their answers', async () => {
    const call = forwardRequestsRpc({ type: 'sendGrpcStreamMessage', sendId: 's-1', messageText: '{"x":1}' });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: 'sendGrpcStreamMessage', sendId: 's-1', messageText: '{"x":1}' });
    handleWireRpcResponseFrame({ type: 'sendGrpcStreamMessage:response', payload: { success: true } });
    await expect(call).resolves.toEqual({ success: true });
  });
});

/**
 * Wire-RPC correlation — the client half of the daemon's peer RPC
 * planes. Pinned laws: by-channel response matching, per-channel
 * serialization (one in-flight request per channel, order preserved),
 * `__error` frames reject with the daemon's message, a dead sender
 * rejects immediately, an unanswered call times out (per-call
 * overridable), a late response after the timeout is claimed silently
 * (never routed onward as an unhandled frame), and claiming stays
 * restricted to the admin prefix + explicitly registered channels —
 * sync RPC responses pass through untouched.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWireRpc, handleWireRpcResponseFrame, registerWireRpcChannels, setWireRpcSender } from '@/host/wire-rpc';

describe('wire-rpc', () => {
  let sent: Record<string, unknown>[];

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    setWireRpcSender((frame) => {
      sent.push(frame);
      return true;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves a call with the matching :response payload', async () => {
    const call = callWireRpc({ type: 'oh.daemon.users.list' });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual([{ type: 'oh.daemon.users.list' }]);
    expect(handleWireRpcResponseFrame({ type: 'oh.daemon.users.list:response', payload: { users: [] } })).toBe(true);
    await expect(call).resolves.toEqual({ users: [] });
  });

  it('rejects on an in-band __error frame (the daemon denies ride here)', async () => {
    const call = callWireRpc({ type: 'oh.daemon.users.list' });
    await vi.advanceTimersByTimeAsync(0);
    expect(
      handleWireRpcResponseFrame({
        type: 'oh.daemon.users.list:response',
        __error: 'daemon-admin: permission denied',
      }),
    ).toBe(true);
    await expect(call).rejects.toThrow('daemon-admin: permission denied');
  });

  it('serializes same-channel calls — the second request is sent only after the first settles', async () => {
    const first = callWireRpc({ type: 'oh.daemon.users.list', seq: 1 });
    const second = callWireRpc({ type: 'oh.daemon.users.list', seq: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    handleWireRpcResponseFrame({ type: 'oh.daemon.users.list:response', payload: { seq: 1 } });
    await expect(first).resolves.toEqual({ seq: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ seq: 2 });
    handleWireRpcResponseFrame({ type: 'oh.daemon.users.list:response', payload: { seq: 2 } });
    await expect(second).resolves.toEqual({ seq: 2 });
  });

  it('a rejected call does not wedge its channel', async () => {
    const first = callWireRpc({ type: 'oh.daemon.users.create' });
    await vi.advanceTimersByTimeAsync(0);
    handleWireRpcResponseFrame({ type: 'oh.daemon.users.create:response', __error: 'nope' });
    await expect(first).rejects.toThrow('nope');
    const second = callWireRpc({ type: 'oh.daemon.users.create' });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(2);
    handleWireRpcResponseFrame({ type: 'oh.daemon.users.create:response', payload: { ok: true } });
    await expect(second).resolves.toEqual({ ok: true });
  });

  it('cross-channel calls stay concurrent', async () => {
    const list = callWireRpc({ type: 'oh.daemon.users.list' });
    const probe = callWireRpc({ type: 'oh.daemon.admin.status' });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((f) => f.type)).toEqual(['oh.daemon.users.list', 'oh.daemon.admin.status']);
    handleWireRpcResponseFrame({ type: 'oh.daemon.admin.status:response', payload: { admin: true } });
    await expect(probe).resolves.toEqual({ admin: true });
    handleWireRpcResponseFrame({ type: 'oh.daemon.users.list:response', payload: { users: [] } });
    await expect(list).resolves.toEqual({ users: [] });
  });

  it('rejects immediately when the transport refuses the frame', async () => {
    setWireRpcSender(() => false);
    await expect(callWireRpc({ type: 'oh.daemon.users.list' })).rejects.toThrow('daemon wire is not connected');
  });

  it('times out an unanswered call; the late response is claimed silently', async () => {
    const call = callWireRpc({ type: 'oh.daemon.tokens.mint' });
    await vi.advanceTimersByTimeAsync(0);
    const rejection = expect(call).rejects.toThrow('daemon did not answer oh.daemon.tokens.mint');
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    // The stale answer is still CLAIMED (true) so the wire router never
    // logs it as an unhandled frame — but nothing settles twice.
    expect(handleWireRpcResponseFrame({ type: 'oh.daemon.tokens.mint:response', payload: { ok: true } })).toBe(true);
  });

  it('honors a per-call timeout override', async () => {
    registerWireRpcChannels(['slowChannel']);
    const call = callWireRpc({ type: 'slowChannel' }, { timeoutMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    handleWireRpcResponseFrame({ type: 'slowChannel:response', payload: { ok: true } });
    await expect(call).resolves.toEqual({ ok: true });
  });

  it('claims registered non-admin channels, resolving their calls', async () => {
    registerWireRpcChannels(['executeRequest']);
    const call = callWireRpc({ type: 'executeRequest' });
    await vi.advanceTimersByTimeAsync(0);
    expect(handleWireRpcResponseFrame({ type: 'executeRequest:response', payload: { success: true } })).toBe(true);
    await expect(call).resolves.toEqual({ success: true });
  });

  it('ignores frames outside the admin prefix and the registered set', () => {
    expect(handleWireRpcResponseFrame({ type: 'oh.sync.mutation' })).toBe(false);
    expect(handleWireRpcResponseFrame({ type: 'pong' })).toBe(false);
    expect(handleWireRpcResponseFrame({ type: 'oh.sync.snapshotFiles:response' })).toBe(false);
    expect(handleWireRpcResponseFrame({ type: 'unregisteredChannel:response' })).toBe(false);
    expect(handleWireRpcResponseFrame(null)).toBe(false);
  });
});

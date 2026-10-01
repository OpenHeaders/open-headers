/**
 * The one-shot backend probe — the HELLO → WELCOME handshake over an
 * injected socket, settled exactly once into its result union: an
 * accepted WELCOME names the Org and the person, a refused one carries
 * the server's reason, a socket error, a pre-WELCOME close, a malformed
 * frame and the deadline each read as their own failure; the HELLO
 * carries the credential only when one is given.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ProbeOptions, probeBackendConnection } from '../../src/identity';
import { HANDSHAKE_ROLES, PROTOCOL_VERSION, SYNC_HELLO_TYPE, SYNC_WELCOME_TYPE } from '../../src/protocol';

class FakeSocket extends EventTarget {
  readonly sent: string[] = [];
  readonly closes: Array<{ code?: number; reason?: string }> = [];
  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number, reason?: string): void {
    this.closes.push({ code, reason });
  }
  open(): void {
    this.dispatchEvent(new Event('open'));
  }
  message(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) }));
  }
  fail(): void {
    this.dispatchEvent(new Event('error'));
  }
  drop(code: number, reason = ''): void {
    this.dispatchEvent(Object.assign(new Event('close'), { code, reason }));
  }
}

const OPTS: ProbeOptions = { agent: 'test-probe', nodeId: 'probe-1', workspaceId: 'probe-ws', role: 'desktop' };

const ACCEPT = {
  type: SYNC_WELCOME_TYPE,
  accepted: true,
  protocolVersion: PROTOCOL_VERSION,
  role: HANDSHAKE_ROLES.DAEMON,
  nodeId: 'daemon-1',
  workspaceId: 'probe-ws',
  agent: '@openheaders/daemon@2026.9.3',
  user: { displayName: 'John Doe', email: 'john@openheaders.io' },
};

function dial(url = 'ws://127.0.0.1:19337', opts: ProbeOptions = OPTS) {
  const socket = new FakeSocket();
  const result = probeBackendConnection(url, opts, () => socket as unknown as WebSocket);
  return { socket, result };
}

describe('probeBackendConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses a non-WebSocket URL without dialing', async () => {
    const createSocket = vi.fn();
    const result = await probeBackendConnection('http://127.0.0.1:19337', OPTS, createSocket);
    expect(result).toMatchObject({ ok: false, reason: 'invalid-url' });
    expect(createSocket).not.toHaveBeenCalled();
  });

  it('sends the HELLO on open — with the credential only when given — and reads an accepted WELCOME', async () => {
    const { socket, result } = dial('ws://127.0.0.1:19337', { ...OPTS, authToken: 'oh_s' });
    socket.open();
    expect(JSON.parse(socket.sent[0] ?? '')).toEqual({
      type: SYNC_HELLO_TYPE,
      protocolVersion: PROTOCOL_VERSION,
      role: 'desktop',
      nodeId: 'probe-1',
      workspaceId: 'probe-ws',
      agent: 'test-probe',
      authToken: 'oh_s',
    });
    socket.message(ACCEPT);
    expect(await result).toMatchObject({
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
      role: 'daemon',
      agent: '@openheaders/daemon@2026.9.3',
      orgName: null,
      user: { displayName: 'John Doe', email: 'john@openheaders.io' },
    });
    expect(socket.closes).toEqual([{ code: 1000, reason: 'probe-complete' }]);

    const bare = dial();
    bare.socket.open();
    expect(JSON.parse(bare.socket.sent[0] ?? '')).not.toHaveProperty('authToken');
  });

  it("reads a refused WELCOME as the server's reason", async () => {
    const { socket, result } = dial();
    socket.open();
    socket.message({ type: SYNC_WELCOME_TYPE, accepted: false, reason: 'auth-required', protocolVersion: 1 });
    expect(await result).toEqual({
      ok: false,
      reason: 'handshake-rejected',
      rejectReason: 'auth-required',
      detail: undefined,
    });
  });

  it('ignores noise before the WELCOME and refuses a malformed one', async () => {
    const { socket, result } = dial();
    socket.open();
    socket.message('not json');
    socket.message({ type: 'oh.sync.ping' });
    socket.message({ type: SYNC_WELCOME_TYPE, accepted: true });
    expect(await result).toMatchObject({ ok: false, reason: 'malformed-welcome' });
  });

  it('reads a socket error as open-failed and a pre-WELCOME close as closed-before-welcome', async () => {
    const errored = dial();
    errored.socket.fail();
    expect(await errored.result).toEqual({
      ok: false,
      reason: 'open-failed',
      detail: 'WebSocket error before handshake completed',
    });

    const dropped = dial();
    dropped.socket.open();
    dropped.socket.drop(1006);
    expect(await dropped.result).toEqual({
      ok: false,
      reason: 'closed-before-welcome',
      detail: 'WebSocket closed with code 1006',
    });
  });

  it('settles once at the deadline when nothing answers, and a late WELCOME is never read', async () => {
    const { socket, result } = dial('ws://127.0.0.1:19337', { ...OPTS, timeoutMs: 250 });
    socket.open();
    vi.advanceTimersByTime(250);
    expect(await result).toEqual({ ok: false, reason: 'timeout', detail: 'No WELCOME within 250ms' });
    socket.message(ACCEPT);
    expect(socket.closes).toHaveLength(1);
  });
});

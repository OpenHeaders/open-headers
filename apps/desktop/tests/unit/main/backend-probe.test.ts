/**
 * The desktop's main-process `backendProbe` plane — the one
 * `oh.backendProbe` channel relayed onto the core probe with the plain
 * options verbatim, so the renderer (whose CSP forbids the dial) gets
 * the probe's own result union back. The handshake itself is pinned in
 * core; Node's socket is the live default.
 */

import type { ProbeConnectionResult, ProbeOptions } from '@openheaders/core/identity';
import { describe, expect, it, vi } from 'vitest';
import { createBackendProbeRpc } from '../../../src/main/backend-probe';

const ACCEPTED: ProbeConnectionResult = {
  ok: true,
  latencyMs: 4,
  protocolVersion: 1,
  role: 'daemon',
  agent: '@openheaders/daemon@2026.9.3',
  orgName: 'Access Rig',
  user: { displayName: 'John Doe', email: 'john@openheaders.io' },
};

describe('desktop backendProbe rpc', () => {
  it('answers only its own channel', () => {
    const plane = createBackendProbeRpc({ probe: vi.fn(async () => ACCEPTED) });
    expect(plane.dispatch('oh.serverSignIn.start', {})).toBeUndefined();
    expect(plane.dispatch('oh.updates.getState', {})).toBeUndefined();
  });

  it('relays the url and the plain options to the probe and answers its result', async () => {
    const probe = vi.fn<(url: string, opts: ProbeOptions) => Promise<ProbeConnectionResult>>(async () => ACCEPTED);
    const plane = createBackendProbeRpc({ probe });
    const opts: ProbeOptions = {
      agent: 'desktop-wizard-probe',
      nodeId: 'probe-1',
      workspaceId: 'probe-ws',
      role: 'desktop',
      authToken: 'oh_s',
    };
    expect(await plane.dispatch('oh.backendProbe', { url: 'ws://127.0.0.1:19337', opts })).toEqual(ACCEPTED);
    expect(probe).toHaveBeenCalledWith('ws://127.0.0.1:19337', opts);
  });

  it('answers the probe failure union as it is', async () => {
    const refused: ProbeConnectionResult = { ok: false, reason: 'handshake-rejected', rejectReason: 'auth-required' };
    const plane = createBackendProbeRpc({ probe: vi.fn(async () => refused) });
    expect(await plane.dispatch('oh.backendProbe', { url: 'ws://127.0.0.1:19337', opts: {} })).toEqual(refused);
  });
});

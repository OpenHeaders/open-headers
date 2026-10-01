/**
 * The shared probe resolver (`@openheaders/ui/shared/backend`): the
 * host's `backendProbe` capability runs the probe when one is
 * registered (the desktop renderer's relay to MAIN), else the core
 * probe dials over this surface's own socket (the extension's pages,
 * the served tab). The callers never learn which.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { ProbeConnectionResult, ProbeOptions } from '@openheaders/core/identity';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ownSocketProbe = vi.fn<(url: string, opts: ProbeOptions) => Promise<ProbeConnectionResult>>();
vi.mock('@openheaders/core/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/identity')>()),
  probeBackendConnection: (url: string, opts: ProbeOptions) => ownSocketProbe(url, opts),
}));

import { probeBackendConnection } from '@openheaders/ui/shared/backend';

const OPTS: ProbeOptions = { agent: 'extension-wizard-probe', nodeId: 'probe-1', workspaceId: 'probe-ws' };
const ACCEPTED: ProbeConnectionResult = {
  ok: true,
  latencyMs: 2,
  protocolVersion: 1,
  role: 'daemon',
  agent: 'test',
  orgName: 'Access Rig',
  user: null,
};
const TIMED_OUT: ProbeConnectionResult = { ok: false, reason: 'timeout' };

afterEach(() => {
  unregisterCapability('backendProbe');
  ownSocketProbe.mockReset();
});

describe('probeBackendConnection (shared resolver)', () => {
  it("dials over this surface's own socket when no host probe is registered", async () => {
    ownSocketProbe.mockResolvedValueOnce(TIMED_OUT);
    expect(await probeBackendConnection('ws://127.0.0.1:19337', OPTS)).toEqual(TIMED_OUT);
    expect(ownSocketProbe).toHaveBeenCalledWith('ws://127.0.0.1:19337', OPTS);
  });

  it("runs the host's registered probe instead, with the same url and options", async () => {
    const hostProbe = vi.fn(async () => ACCEPTED);
    registerCapability('backendProbe', hostProbe);
    expect(await probeBackendConnection('ws://127.0.0.1:19337', OPTS)).toEqual(ACCEPTED);
    expect(hostProbe).toHaveBeenCalledWith('ws://127.0.0.1:19337', OPTS);
    expect(ownSocketProbe).not.toHaveBeenCalled();
  });
});

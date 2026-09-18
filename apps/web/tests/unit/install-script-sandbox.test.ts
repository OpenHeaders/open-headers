/**
 * The web host's script runtime — the composition root: a signed tab
 * registers Safe alone into the host-neutral capability registry,
 * over the oracle broker mounting the served sandbox page through the
 * shared iframe transport, with the shared `oh.*` servicing over the
 * tab's seam (an ad-hoc `oh.sendRequest` draft through the tab's own
 * Send route; the refresh leg through the tab's delegating transport,
 * keyed by the active workspace and honest without one); the runs and
 * the session ends reach the broker; the public viewer registers
 * nothing.
 */

import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  publicView: false,
  activeWorkspaceId: 'ws-tab' as string | null,
  brokerDeps: [] as Record<string, unknown>[],
  runs: [] as unknown[],
  ended: [] as string[],
  transportSrcs: [] as string[],
  routed: [] as { message: unknown; host: unknown }[],
  transports: [] as { workspaceId: string }[],
  sent: [] as unknown[],
  handlerSeams: [] as Record<string, unknown>[],
}));

vi.mock('@/host/public-view', () => ({ isPublicView: () => h.publicView }));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('virtual:openheaders-script-sandbox', () => ({ default: '<!DOCTYPE html><script>/* realm */</script>' }));
vi.mock('@openheaders/oracle-host-browser/live/iframe-sandbox-transport', () => ({
  createIframeSandboxTransport: (options: { src?: string; srcdoc?: string }) => {
    h.transportSrcs.push(options.srcdoc ?? options.src ?? '');
    return () => ({ ensureReady: async () => {}, post: () => {}, close: () => {} });
  },
}));
vi.mock('@openheaders/oracle/live/script-host/broker', () => ({
  createScriptBroker: (deps: Record<string, unknown>) => {
    h.brokerDeps.push(deps);
    return {
      runScript: async (opts: unknown) => {
        h.runs.push(opts);
        return { executionId: 'e1', succeeded: true, assertions: [], consoleLog: [], durationMs: 1 };
      },
      endSession: (sessionId: string) => {
        h.ended.push(sessionId);
      },
      dispose: () => {},
    };
  },
}));
vi.mock('@openheaders/oracle/live/script-host/host-rpc', () => ({
  createScriptHostRequestHandler: (seam: Record<string, unknown>) => {
    h.handlerSeams.push(seam);
    return async () => ({ executionId: 'e1', rpcId: 'r1', ok: true, value: null });
  },
}));
vi.mock('@openheaders/oracle/live/request-route/route', () => ({
  executeRequestRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ message, host });
    return { success: true };
  },
  executeGraphqlRequestRoute: async () => ({ success: true }),
}));
vi.mock('@openheaders/oracle/live/request-exec/delegating-transport', () => ({
  createDelegatingRequestTransport: (options: { workspaceId: string }) => {
    h.transports.push(options);
    return {
      send: async (request: unknown) => {
        h.sent.push(request);
        return { status: 204, statusText: '', url: '', headers: [], body: '', bodyTruncated: false, bodyBytes: 0 };
      },
    };
  },
}));

// The registry is read through the SAME module instance the install
// module registered into — a fresh one after every `resetModules`.
async function registry() {
  return import('@openheaders/oracle/live/script-host/capability');
}

const DRAFT: Request = {
  schemaVersion: 5,
  uid: 'script-1',
  path: 'scripts/ad-hoc',
  name: 'script ad-hoc',
  method: 'GET',
  url: 'https://api.openheaders.io/ping',
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: { type: 'none' },
};

const WIRE_REQUEST = { method: 'POST', url: 'https://auth.openheaders.io/token', headers: [], body: '' };

type Seam = {
  refreshTransport: { send: (request: unknown) => Promise<unknown> };
  sendRequest: (draft: Request) => Promise<unknown>;
};

describe('install-script-sandbox', () => {
  beforeEach(() => {
    vi.resetModules();
    h.publicView = false;
    h.activeWorkspaceId = 'ws-tab';
    h.brokerDeps = [];
    h.runs = [];
    h.ended = [];
    h.transportSrcs = [];
    h.routed = [];
    h.transports = [];
    h.sent = [];
    h.handlerSeams = [];
  });

  it('registers Safe alone over the oracle broker mounting the bundled sandbox document inline', async () => {
    await import('@/host/install-script-sandbox');
    const { getHostScriptCapability } = await registry();
    expect(h.transportSrcs).toEqual(['<!DOCTYPE html><script>/* realm */</script>']);
    expect(h.brokerDeps).toHaveLength(1);
    const safe = getHostScriptCapability('safe');
    expect(safe?.mode).toBe('safe');
    expect(getHostScriptCapability('developer')).toBeNull();
    const opts = {
      kind: 'pre-request' as const,
      source: 'oh.setHeader("X", "1")',
      request: { method: 'GET' as const, url: DRAFT.url, headers: [], params: [], body: { type: 'none' as const } },
    };
    await safe?.runScript(opts);
    safe?.endSession('s-1');
    expect(h.runs).toEqual([opts]);
    expect(h.ended).toEqual(['s-1']);
  });

  it('services oh.* over the tab seam — an ad-hoc send through the tab Send route, the refresh leg through the delegating transport', async () => {
    await import('@/host/install-script-sandbox');
    const { webRequestRouteHost } = await import('@/host/tab-requests-rpc');
    const seam = h.handlerSeams[0] as Seam;
    expect(h.brokerDeps[0].handleHostRequest).toBeTypeOf('function');
    await seam.sendRequest(DRAFT);
    expect(h.routed).toEqual([{ message: { draft: DRAFT }, host: webRequestRouteHost }]);
    await seam.refreshTransport.send(WIRE_REQUEST);
    expect(h.transports.map((t) => t.workspaceId)).toEqual(['ws-tab']);
    expect(h.sent).toEqual([WIRE_REQUEST]);
    h.activeWorkspaceId = null;
    await expect(seam.refreshTransport.send(WIRE_REQUEST)).rejects.toThrow('No active workspace');
  });

  it('the public viewer registers nothing', async () => {
    h.publicView = true;
    await import('@/host/install-script-sandbox');
    const { getHostScriptCapability } = await registry();
    expect(h.brokerDeps).toEqual([]);
    expect(getHostScriptCapability('safe')).toBeNull();
  });
});

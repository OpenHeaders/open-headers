/**
 * `createCdpControlReplay` — fans a tab's derived standing CDP control state
 * across its root page target AND every kept child session (workers /
 * OOPIFs), so Fetch interception reaches all of a tab's traffic. Plus the
 * per-child apply/forget the debugger source's child-session observers drive.
 */

import type { CdpTabControlState } from '@openheaders/oracle/correlator-cdp';
import { createInMemoryTabControlPort, EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { describe, expect, it, vi } from 'vitest';

import { createCdpControlReplay } from '@/background/correlator-host/cdp-control-replay';
import { ChromeCdpTabControlPort } from '@/background/correlator-host/chrome-cdp-tab-control-port';
import { ChromeDebuggerEventSource } from '@/background/correlator-host/chrome-debugger-source';
import { chrome as chromeMock } from '../../../__mocks__/chrome';

/** Drain the fire-and-forget `apply` promises the fan kicks off (it returns void). */
const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function withPatterns(urlPattern: string): CdpTabControlState {
  return { ...EMPTY_TAB_CONTROL_STATE, fetchPatterns: [{ urlPattern }] };
}

describe('createCdpControlReplay', () => {
  it('replays the derived state onto the root and every kept child session', () => {
    const port = createInMemoryTabControlPort();
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => withPatterns('*://api.openheaders.io/*'),
      childSessionsOf: () => [
        { sessionId: 'c1', kind: 'iframe' },
        { sessionId: 'c2', kind: 'iframe' },
      ],
    });

    replay.replay(5);

    expect(port.applied.map((a) => a.target)).toEqual([
      { tabId: 5, sessionId: 'page' },
      { tabId: 5, sessionId: 'c1' },
      { tabId: 5, sessionId: 'c2' },
    ]);
    expect(port.applied.every((a) => a.state.fetchPatterns.length === 1)).toBe(true);
  });

  it('releases the root and every kept child session', () => {
    const port = createInMemoryTabControlPort();
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => EMPTY_TAB_CONTROL_STATE,
      childSessionsOf: () => [
        { sessionId: 'c1', kind: 'iframe' },
        { sessionId: 'c2', kind: 'worker' },
      ],
    });

    replay.release(5);

    expect(port.forgotten).toEqual([
      { tabId: 5, sessionId: 'page' },
      { tabId: 5, sessionId: 'c1' },
      { tabId: 5, sessionId: 'c2' },
    ]);
  });

  it('applyChild applies the derived state to one OOPIF child session', () => {
    const port = createInMemoryTabControlPort();
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => withPatterns('*://api.openheaders.io/*'),
      childSessionsOf: () => [],
    });

    replay.applyChild(5, 'iframe-1', 'iframe');

    expect(port.applied).toHaveLength(1);
    expect(port.applied[0]?.target).toEqual({ tabId: 5, sessionId: 'iframe-1' });
    expect(port.applied[0]?.state.fetchPatterns).toHaveLength(1);
  });

  it('forgetChild forgets one child session', () => {
    const port = createInMemoryTabControlPort();
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => EMPTY_TAB_CONTROL_STATE,
      childSessionsOf: () => [],
    });

    replay.forgetChild(5, 'worker-1');

    expect(port.forgotten).toEqual([{ tabId: 5, sessionId: 'worker-1' }]);
  });

  it('projects a worker child onto its Network/Fetch subset — Fetch.enable survives, no page-only command reaches it (PF1)', () => {
    const port = createInMemoryTabControlPort();
    // A state mixing page-only planes (bypassCSP + a locale override) with the
    // worker-relevant interception patterns — exactly the combination that,
    // fanned whole to a worker, rejects the page-only command and (under the
    // adapter's fail-fast apply) aborts the worker's own Fetch.enable.
    const armed: CdpTabControlState = {
      ...EMPTY_TAB_CONTROL_STATE,
      bypassCsp: true,
      overrides: { locale: 'fr-FR' },
      fetchPatterns: [{ urlPattern: '*://api.openheaders.io/*' }],
    };
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => armed,
      childSessionsOf: () => [{ sessionId: 'worker-1', kind: 'worker' }],
    });

    replay.replay(5);

    const workerKinds = port.applied.find((a) => a.target.sessionId === 'worker-1')?.commands.map((c) => c.kind) ?? [];
    expect(workerKinds).toContain('enable-fetch');
    expect(workerKinds).not.toContain('set-bypass-csp');
    expect(workerKinds).not.toContain('set-locale-override');
    // The root page target still gets the full state, page-only planes included.
    const rootKinds = port.applied.find((a) => a.target.sessionId === 'page')?.commands.map((c) => c.kind) ?? [];
    expect(rootKinds).toEqual(expect.arrayContaining(['set-bypass-csp', 'set-locale-override', 'enable-fetch']));
  });

  it('keeps worker Fetch interception alive end-to-end: a page-only command never aborts the worker batch (PF1)', async () => {
    vi.clearAllMocks();
    // A worker CDP target has no Page/Emulation domain — model the reject the
    // backend returns for those methods on a worker session. (The root session
    // is the bare `{tabId}` debuggee, so it has no `sessionId`.)
    chromeMock.debugger.sendCommand.mockImplementation((session, method) => {
      const onWorker = session.sessionId === 'worker-1';
      if (onWorker && (method.startsWith('Page.') || method.startsWith('Emulation.'))) {
        return Promise.reject(new Error(`'${method}' wasn't found`));
      }
      return Promise.resolve(undefined);
    });
    const source = new ChromeDebuggerEventSource();
    const port = new ChromeCdpTabControlPort(source);
    const armed: CdpTabControlState = {
      ...EMPTY_TAB_CONTROL_STATE,
      bypassCsp: true,
      overrides: { locale: 'fr-FR' },
      fetchPatterns: [{ urlPattern: '*://api.openheaders.io/*' }],
    };
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => armed,
      childSessionsOf: () => [{ sessionId: 'worker-1', kind: 'worker' }],
    });

    replay.replay(9);
    await flushAsync();

    const workerMethods = chromeMock.debugger.sendCommand.mock.calls
      .filter((c) => c[0].sessionId === 'worker-1')
      .map((c) => c[1]);
    // Fetch.enable reached the worker; no page-only command was ever sent to it
    // (so nothing could reject and abort the batch before Fetch.enable).
    expect(workerMethods).toContain('Fetch.enable');
    expect(workerMethods.some((m) => m.startsWith('Page.') || m.startsWith('Emulation.'))).toBe(false);

    // lastApplied committed the worker subset → a clean re-apply is a no-op,
    // not a perpetual re-issue of a batch that keeps re-rejecting.
    chromeMock.debugger.sendCommand.mockClear();
    replay.applyChild(9, 'worker-1', 'worker');
    await flushAsync();
    expect(chromeMock.debugger.sendCommand.mock.calls.filter((c) => c[0].sessionId === 'worker-1')).toHaveLength(0);
  });
});

/**
 * `createCdpControlReplay` — fans a tab's derived standing CDP control state
 * across its root page target AND every kept child session (workers /
 * OOPIFs), so Fetch interception reaches all of a tab's traffic. Plus the
 * per-child apply/forget the debugger source's child-session observers drive.
 */

import type { CdpTabControlState } from '@openheaders/oracle/correlator-cdp';
import { createInMemoryTabControlPort, EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { describe, expect, it } from 'vitest';

import { createCdpControlReplay } from '@/background/correlator-host/cdp-control-replay';

function withPatterns(urlPattern: string): CdpTabControlState {
  return { ...EMPTY_TAB_CONTROL_STATE, fetchPatterns: [{ urlPattern }] };
}

describe('createCdpControlReplay', () => {
  it('replays the derived state onto the root and every kept child session', () => {
    const port = createInMemoryTabControlPort();
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => withPatterns('*://api.openheaders.io/*'),
      childSessionsOf: () => ['c1', 'c2'],
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
      childSessionsOf: () => ['c1', 'c2'],
    });

    replay.release(5);

    expect(port.forgotten).toEqual([
      { tabId: 5, sessionId: 'page' },
      { tabId: 5, sessionId: 'c1' },
      { tabId: 5, sessionId: 'c2' },
    ]);
  });

  it('applyChild applies the derived state to one child session', () => {
    const port = createInMemoryTabControlPort();
    const replay = createCdpControlReplay({
      tabControlPort: port,
      deriveState: () => withPatterns('*://api.openheaders.io/*'),
      childSessionsOf: () => [],
    });

    replay.applyChild(5, 'worker-1');

    expect(port.applied).toHaveLength(1);
    expect(port.applied[0]?.target).toEqual({ tabId: 5, sessionId: 'worker-1' });
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
});

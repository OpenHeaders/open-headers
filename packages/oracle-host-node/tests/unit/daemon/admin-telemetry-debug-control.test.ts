/**
 * The Debug-mode control channel (`oh.daemon.telemetry.debug.control`) —
 * which commands the host relays to a browser, and which it refuses in
 * band before they reach the relay.
 */

import type { TelemetryDebugCommand, TelemetryDebugState } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdminChannels } from './_admin-channels-rig';

const NODE = 'ext-0eefd940';
const STATE: TelemetryDebugState = {
  available: true,
  enabled: true,
  attachedTabs: [],
  pinnedTabs: [],
  scope: 'both',
};

function rig() {
  const relayed: Array<{ nodeId: string; command: TelemetryDebugCommand }> = [];
  const table = buildAdminChannels({
    telemetryDebugControl: async (nodeId, command) => {
      relayed.push({ nodeId, command });
      return STATE;
    },
  });
  const control = table.get('oh.daemon.telemetry.debug.control');
  if (!control) throw new Error('channel missing');
  return { control, relayed };
}

describe('oh.daemon.telemetry.debug.control', () => {
  it.each([
    [{ kind: 'pin', tabId: 7, pinned: true }],
    [{ kind: 'enable', enabled: false }],
    [{ kind: 'scope', scope: 'devtools' }],
    [{ kind: 'scope', scope: 'active' }],
    [{ kind: 'scope', scope: 'both' }],
  ] as const)('relays %j and answers with the browser’s state', async (command) => {
    const { control, relayed } = rig();
    expect(await control({ nodeId: NODE, command })).toEqual({ ok: true, debug: STATE });
    expect(relayed).toEqual([{ nodeId: NODE, command }]);
  });

  it.each([
    [{ kind: 'scope', scope: 'everything' }],
    [{ kind: 'scope' }],
    [{ kind: 'scope', scope: 3 }],
    [{ kind: 'pin', tabId: '7', pinned: true }],
    [{ kind: 'enable' }],
    [{ kind: 'attach', tabId: 7 }],
    [null],
  ])('refuses %j without reaching the relay', async (command) => {
    const { control, relayed } = rig();
    expect(await control({ nodeId: NODE, command })).toEqual({ ok: false, debug: null });
    expect(relayed).toHaveLength(0);
  });

  it('refuses a command with no browser named', async () => {
    const { control, relayed } = rig();
    expect(await control({ nodeId: '', command: { kind: 'scope', scope: 'both' } })).toEqual({
      ok: false,
      debug: null,
    });
    expect(relayed).toHaveLength(0);
  });
});

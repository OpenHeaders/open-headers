/**
 * The favicon pull channel (`oh.daemon.telemetry.tabs.favicons`) — what
 * the host relays to a browser, and what it answers without asking.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildAdminChannels } from './_admin-channels-rig';

const NODE = 'ext-0eefd940';
const ICON = 'data:image/png;base64,aWNvbg==';

function rig() {
  const pulled: Array<{ nodeId: string; keys: readonly string[] }> = [];
  const table = buildAdminChannels({
    telemetryFavicons: async (nodeId, keys) => {
      pulled.push({ nodeId, keys });
      return { k1: ICON };
    },
  });
  const favicons = table.get('oh.daemon.telemetry.tabs.favicons');
  if (!favicons) throw new Error('channel missing');
  return { favicons, pulled };
}

describe('oh.daemon.telemetry.tabs.favicons', () => {
  it('relays the keys to the named browser and answers with its icons', async () => {
    const { favicons, pulled } = rig();
    expect(await favicons({ nodeId: NODE, keys: ['k1', 'k2'] })).toEqual({ icons: { k1: ICON } });
    expect(pulled).toEqual([{ nodeId: NODE, keys: ['k1', 'k2'] }]);
  });

  it('relays only what is a key', async () => {
    const { favicons, pulled } = rig();
    await favicons({ nodeId: NODE, keys: ['k1', 7, null, { key: 'k2' }] });
    expect(pulled).toEqual([{ nodeId: NODE, keys: ['k1'] }]);
  });

  it.each([[{ keys: ['k1'] }], [{ nodeId: '', keys: ['k1'] }], [{ nodeId: NODE }], [{ nodeId: NODE, keys: 'k1' }]])(
    'answers %j with no icons, without reaching the relay',
    async (message) => {
      const { favicons, pulled } = rig();
      expect(await favicons(message)).toEqual({ icons: {} });
      expect(pulled).toEqual([]);
    },
  );

  it('answers with no icons on a host that runs no relay', async () => {
    const favicons = buildAdminChannels({}).get('oh.daemon.telemetry.tabs.favicons');
    expect(await favicons?.({ nodeId: NODE, keys: ['k1'] })).toEqual({ icons: {} });
  });
});

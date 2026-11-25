/**
 * Peer favicons — the window's store of the watched browsers' tab icons.
 * Asserts:
 *   - an icon the inventory names is asked for once, however many
 *     snapshots name it, and never twice while the ask is in flight
 *   - keys are asked for one pull's worth at a time
 *   - an icon no listed tab names any more is dropped, a browser that is
 *     gone drops all of its own
 *   - a key the browser could not answer is asked again by a later snapshot
 *   - a row that names its icon by key reads the bytes; rows that carry
 *     their bytes, or name nothing, come back as they are
 */

import { TELEMETRY_FAVICONS_PER_PULL } from '@openheaders/core/protocol';
import {
  namedFaviconKeys,
  readPeerFavicons,
  subscribePeerFavicons,
  syncPeerFavicons,
  type TabFaviconRef,
  withPeerFavicons,
} from '@openheaders/ui/workbench/data/peer-favicons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NODE = 'ext-0eefd940';
const OTHER = 'ext-john-doe';
const icon = (key: string): string => `data:image/png;base64,${btoa(key)}`;

interface Row extends TabFaviconRef {
  tabId: number;
}

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => {}), broadcast: vi.fn(), presence: vi.fn() },
  };
});

/** A browser that holds every key but the ones in `lost`. */
function answeringBrowser(lost: ReadonlySet<string> = new Set()): void {
  mockCall.mockImplementation(async (type: string, payload: { keys: string[] }) => {
    if (type !== 'oh.daemon.telemetry.tabs.favicons') throw new Error(`unexpected call ${type}`);
    return { icons: Object.fromEntries(payload.keys.filter((key) => !lost.has(key)).map((key) => [key, icon(key)])) };
  });
}

function named(entries: Record<string, string[]>): Map<string, Set<string>> {
  return new Map(Object.entries(entries).map(([nodeId, keys]) => [nodeId, new Set(keys)]));
}

const pulls = (): Array<{ nodeId: string; keys: string[] }> => mockCall.mock.calls.map(([, payload]) => payload);

/** Let every pull in flight settle, answered or not, and the store take it in. */
async function settle(): Promise<void> {
  await Promise.allSettled(mockCall.mock.results.map((result) => result.value));
  for (let turn = 0; turn < 4; turn++) await Promise.resolve();
}

describe('peer favicons', () => {
  beforeEach(() => {
    answeringBrowser();
  });

  afterEach(async () => {
    await settle();
    syncPeerFavicons(new Map());
    mockCall.mockReset();
  });

  it('asks for an icon once, however many snapshots name it', async () => {
    syncPeerFavicons(named({ [NODE]: ['k1', 'k2'] }));
    syncPeerFavicons(named({ [NODE]: ['k1', 'k2'] }));
    expect(pulls()).toEqual([{ nodeId: NODE, keys: ['k1', 'k2'] }]);

    await settle();
    expect(readPeerFavicons().get(NODE)).toEqual(
      new Map([
        ['k1', icon('k1')],
        ['k2', icon('k2')],
      ]),
    );

    syncPeerFavicons(named({ [NODE]: ['k1', 'k2', 'k3'] }));
    expect(pulls()).toEqual([
      { nodeId: NODE, keys: ['k1', 'k2'] },
      { nodeId: NODE, keys: ['k3'] },
    ]);
  });

  it('tells its readers when icons arrive, and only then', async () => {
    const changed = vi.fn();
    const unsubscribe = subscribePeerFavicons(changed);
    syncPeerFavicons(named({ [NODE]: ['k1'] }));
    expect(changed).not.toHaveBeenCalled();

    await settle();
    expect(changed).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('asks one pull’s worth of keys at a time', () => {
    const keys = Array.from({ length: TELEMETRY_FAVICONS_PER_PULL + 3 }, (_, index) => `k${index}`);
    syncPeerFavicons(named({ [NODE]: keys }));
    expect(pulls().map((pull) => pull.keys)).toEqual([
      keys.slice(0, TELEMETRY_FAVICONS_PER_PULL),
      keys.slice(TELEMETRY_FAVICONS_PER_PULL),
    ]);
  });

  it('drops an icon no listed tab names, and everything of a browser that is gone', async () => {
    syncPeerFavicons(named({ [NODE]: ['k1', 'k2'], [OTHER]: ['k9'] }));
    await settle();

    syncPeerFavicons(named({ [NODE]: ['k2'] }));
    expect(readPeerFavicons().get(NODE)).toEqual(new Map([['k2', icon('k2')]]));
    expect(readPeerFavicons().has(OTHER)).toBe(false);
  });

  it('asks again, with a later snapshot, for a key the browser could not answer', async () => {
    answeringBrowser(new Set(['k1']));
    syncPeerFavicons(named({ [NODE]: ['k1'] }));
    await settle();
    expect(readPeerFavicons().has(NODE)).toBe(false);

    answeringBrowser();
    syncPeerFavicons(named({ [NODE]: ['k1'] }));
    await settle();
    expect(readPeerFavicons().get(NODE)?.get('k1')).toBe(icon('k1'));
  });

  it('holds nothing and keeps asking after a pull the host could not make', async () => {
    mockCall.mockRejectedValueOnce(new Error('host unreachable'));
    syncPeerFavicons(named({ [NODE]: ['k1'] }));
    await settle();
    expect(readPeerFavicons().has(NODE)).toBe(false);

    syncPeerFavicons(named({ [NODE]: ['k1'] }));
    await settle();
    expect(mockCall).toHaveBeenCalledTimes(2);
    expect(readPeerFavicons().get(NODE)?.get('k1')).toBe(icon('k1'));
  });

  it('reads the keys a browser’s tabs name', () => {
    expect(namedFaviconKeys([{ favIconKey: 'k1' }, { favIconUrl: icon('inline') }, {}, { favIconKey: 'k1' }])).toEqual(
      new Set(['k1']),
    );
  });

  it('gives a row that names its icon the bytes, and hands the rest back as they are', () => {
    const keyed: Row = { tabId: 1, favIconKey: 'k1' };
    const inline: Row = { tabId: 2, favIconUrl: icon('inline') };
    const bare: Row = { tabId: 3 };
    const unheld: Row = { tabId: 4, favIconKey: 'k4' };
    const icons = new Map([['k1', icon('k1')]]);

    const shown = withPeerFavicons([keyed, inline, bare, unheld], icons);
    expect(shown).toEqual([{ tabId: 1, favIconKey: 'k1', favIconUrl: icon('k1') }, inline, bare, unheld]);
    expect(shown[1]).toBe(inline);

    const untouched = [inline, bare, unheld];
    expect(withPeerFavicons(untouched, icons)).toBe(untouched);
    expect(withPeerFavicons([keyed], undefined)).toEqual([keyed]);
  });
});

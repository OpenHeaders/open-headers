/**
 * Phase U5 — renderer-side mode-switch machinery. Pins:
 *
 *   - executeUseTarget surfaces the bridge result and folds transport
 *     errors into the right structured failure
 *   - summarizeUseTarget toast copy per outcome
 *   - awaitJoinedOrg resolves on an already-present Org, on a later
 *     arrival, and times out when the join never lands
 */

import type { DiscardResult } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetHostStorage } = vi.hoisted(() => ({ mockGetHostStorage: vi.fn() }));

vi.mock('@openheaders/core/storage', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/storage')>()),
  getHostStorage: mockGetHostStorage,
}));

import {
  awaitJoinedOrg,
  executeUseTarget,
  summarizeUseTargetFailure,
  summarizeUseTargetSuccess,
} from '@openheaders/ui/shared/mode-switch';

const ORG_ID = '0193a8ff-c000-7000-8000-0000000000ff';

beforeEach(() => {
  mockGetHostStorage.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('executeUseTarget (renderer bridge wrapper)', () => {
  it('returns the bridge response on success', async () => {
    const stub: DiscardResult = { ok: true, discardedWorkspaces: [], backupPath: '/tmp/backup.json' };
    const result = await executeUseTarget({ targetOrgId: ORG_ID }, { bridgeCall: async () => stub });
    expect(result).toBe(stub);
  });

  it('folds bridge rejections into backup-failed (stopped before any delete)', async () => {
    const result = await executeUseTarget(
      { targetOrgId: ORG_ID },
      { bridgeCall: () => Promise.reject(new Error('ipc-down')) },
    );
    expect(result).toMatchObject({ ok: false, reason: 'backup-failed', detail: 'ipc-down' });
  });
});

describe('summarizeUseTarget toast copy', () => {
  it('quotes the backup path + retired count in the success line', () => {
    const copy = summarizeUseTargetSuccess(
      {
        ok: true,
        discardedWorkspaces: [{ workspaceId: 'w1', workspaceName: 'Alpha', entityCount: 4 }],
        backupPath: '/tmp/oh-backup.json',
      },
      'Desktop Application',
    );
    expect(copy).toContain('1 workspace');
    expect(copy).toContain('/tmp/oh-backup.json');
    expect(copy).toContain('Desktop Application');
  });

  it('renders a distinct line per failure reason', () => {
    expect(summarizeUseTargetFailure({ ok: false, reason: 'backup-writer-unavailable' }, 'Desktop')).toContain(
      "can't write a backup",
    );
    expect(summarizeUseTargetFailure({ ok: false, reason: 'backup-failed' }, 'Desktop')).toContain('intact');
    expect(
      summarizeUseTargetFailure({ ok: false, reason: 'delete-failed', backupPath: '/tmp/b.json' }, 'Desktop'),
    ).toContain('/tmp/b.json');
  });
});

/** Minimal in-memory `HostStorage` stub for the `OH.joinedOrgs` slot. */
function fakeStorage(initial: Org[]) {
  let value: Org[] = initial;
  const listeners = new Set<(next: Org[] | undefined) => void>();
  return {
    get: vi.fn(async () => value),
    subscribe: vi.fn((_key: unknown, fn: (next: Org[] | undefined) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }),
    push: (next: Org[]): void => {
      value = next;
      for (const fn of listeners) fn(next);
    },
  };
}

function org(id: string): Org {
  return { id, name: `Org ${id}`, hostKind: 'desktop', isSynthetic: true };
}

describe('awaitJoinedOrg', () => {
  it('resolves immediately when the Org is already on file', async () => {
    mockGetHostStorage.mockReturnValue(fakeStorage([org(ORG_ID)]));
    expect(await awaitJoinedOrg(ORG_ID)).toBe(true);
  });

  it('resolves once the Org arrives in a later OH.joinedOrgs write', async () => {
    const storage = fakeStorage([]);
    mockGetHostStorage.mockReturnValue(storage);
    const pending = awaitJoinedOrg(ORG_ID, 5_000);
    await Promise.resolve();
    storage.push([org(ORG_ID)]);
    expect(await pending).toBe(true);
  });

  it('catches a join that lands before the initial read resolves (race regression)', async () => {
    // Reproduces the check-then-subscribe race: under a mode-commit
    // reconnect storm the contended read lags behind the join write.
    // A check-then-subscribe order would miss the write; subscribe-first
    // must catch it even though the read returns stale-empty.
    const storage = fakeStorage([]);
    let resolveGet: (value: Org[]) => void = () => {};
    storage.get = vi.fn(() => new Promise<Org[]>((r) => (resolveGet = r)));
    mockGetHostStorage.mockReturnValue(storage);

    const pending = awaitJoinedOrg(ORG_ID, 5_000);
    storage.push([org(ORG_ID)]); // join lands while the read is still in flight
    resolveGet([]); // read resolves stale-empty
    expect(await pending).toBe(true);
  });

  it('resolves false when the join never lands within the timeout', async () => {
    mockGetHostStorage.mockReturnValue(fakeStorage([]));
    expect(await awaitJoinedOrg(ORG_ID, 30)).toBe(false);
  });

  it('resolves false when no host storage is wired', async () => {
    mockGetHostStorage.mockReturnValue(null);
    expect(await awaitJoinedOrg(ORG_ID, 30)).toBe(false);
  });
});

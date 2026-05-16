/**
 * Phase C F6.b — Activity mute store contract.
 *
 * Pins the in-memory reference impl. The IDB + SQLite backends share
 * this behavioural contract; their own files exercise their respective
 * transport quirks.
 */

import type { ActivityMuteEntry } from '@openheaders/core/sync';
import { InMemoryActivityMuteStore } from '@openheaders/oracle/sync';
import { describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const WS2 = '0193a8ff-c000-7000-8000-000000000002';

function makeEntry(overrides: Partial<ActivityMuteEntry> = {}): ActivityMuteEntry {
  return {
    workspaceId: WS,
    entityType: 'rule',
    entityId: 'r1',
    mutedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('InMemoryActivityMuteStore', () => {
  it('put + has reflects insertion', async () => {
    const s = new InMemoryActivityMuteStore();
    expect(await s.has(WS, 'rule', 'r1')).toBe(false);
    await s.put(makeEntry());
    expect(await s.has(WS, 'rule', 'r1')).toBe(true);
  });

  it('put is idempotent and updates mutedAt', async () => {
    const s = new InMemoryActivityMuteStore();
    await s.put(makeEntry({ mutedAt: 100 }));
    await s.put(makeEntry({ mutedAt: 250 }));
    const rows = await s.list(WS);
    expect(rows).toHaveLength(1);
    expect(rows[0].mutedAt).toBe(250);
  });

  it('remove drops the entry and is idempotent', async () => {
    const s = new InMemoryActivityMuteStore();
    await s.put(makeEntry());
    await s.remove(WS, 'rule', 'r1');
    expect(await s.has(WS, 'rule', 'r1')).toBe(false);
    // Second remove is a no-op (doesn't throw).
    await s.remove(WS, 'rule', 'r1');
  });

  it('list returns workspace-scoped entries only', async () => {
    const s = new InMemoryActivityMuteStore();
    await s.put(makeEntry({ workspaceId: WS, entityId: 'r1' }));
    await s.put(makeEntry({ workspaceId: WS, entityId: 'r2' }));
    await s.put(makeEntry({ workspaceId: WS2, entityId: 'r3' }));
    const wsRows = await s.list(WS);
    expect(wsRows.map((r) => r.entityId).sort()).toEqual(['r1', 'r2']);
    const ws2Rows = await s.list(WS2);
    expect(ws2Rows.map((r) => r.entityId)).toEqual(['r3']);
  });

  it('list of an unknown workspace returns empty array', async () => {
    const s = new InMemoryActivityMuteStore();
    expect(await s.list('unknown')).toEqual([]);
  });
});

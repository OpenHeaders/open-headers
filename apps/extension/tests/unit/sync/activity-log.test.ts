/**
 * Phase C F1 — Activity log contract.
 *
 * Pins the in-memory reference impl. The IDB + SQLite implementations
 * have their own E2E test files; they all share this behavioural
 * contract.
 */

import { activityEntryId } from '@openheaders/core/sync';
import type { ActivityEntry, ActivityEntryKind } from '@openheaders/core/sync';
import { InMemoryActivityLog } from '@openheaders/oracle/sync';
import { describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  const base: ActivityEntry = {
    id: '',
    workspaceId: WS,
    mutationId: 'mut-001',
    hlc: { physicalMs: 1_700_000_000_000, logical: 0, nodeId: 'sw-openheaders' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'popup', deviceId: 'device-A' },
    observedAt: 1_700_000_000_123,
    read: false,
    ...overrides,
  };
  return { ...base, id: activityEntryId(base) };
}

describe('InMemoryActivityLog', () => {
  it('append + list returns newest first by HLC', async () => {
    const log = new InMemoryActivityLog();
    await log.append(
      makeEntry({ mutationId: 'm1', hlc: { physicalMs: 1_000, logical: 0, nodeId: 'n' } }),
    );
    await log.append(
      makeEntry({ mutationId: 'm3', hlc: { physicalMs: 3_000, logical: 0, nodeId: 'n' } }),
    );
    await log.append(
      makeEntry({ mutationId: 'm2', hlc: { physicalMs: 2_000, logical: 0, nodeId: 'n' } }),
    );
    const rows = await log.list(WS);
    expect(rows.map((r) => r.mutationId)).toEqual(['m3', 'm2', 'm1']);
  });

  it('append is idempotent on (workspaceId, mutationId, kind)', async () => {
    const log = new InMemoryActivityLog();
    const e = makeEntry({ mutationId: 'm1' });
    await log.append(e);
    await log.append(e);
    expect((await log.list(WS)).length).toBe(1);
  });

  it('allows one row per kind from the same envelope', async () => {
    const log = new InMemoryActivityLog();
    const base = { mutationId: 'm1', hlc: { physicalMs: 1, logical: 0, nodeId: 'n' } };
    await log.append(makeEntry({ ...base, kind: 'edit-entity' }));
    await log.append(makeEntry({ ...base, kind: 'sensitive-field-rotation' }));
    const rows = await log.list(WS);
    expect(rows.map((r) => r.kind).sort()).toEqual(['edit-entity', 'sensitive-field-rotation']);
  });

  it('list respects workspace scope', async () => {
    const log = new InMemoryActivityLog();
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'm1' }));
    await log.append(makeEntry({ workspaceId: 'other', mutationId: 'm2' }));
    expect((await log.list(WS)).map((r) => r.mutationId)).toEqual(['m1']);
  });

  it('list respects limit + sinceHlcKey + unreadOnly', async () => {
    const log = new InMemoryActivityLog();
    const e1 = makeEntry({ mutationId: 'm1', hlc: { physicalMs: 1_000, logical: 0, nodeId: 'n' } });
    const e2 = makeEntry({ mutationId: 'm2', hlc: { physicalMs: 2_000, logical: 0, nodeId: 'n' } });
    const e3 = makeEntry({
      mutationId: 'm3',
      hlc: { physicalMs: 3_000, logical: 0, nodeId: 'n' },
      read: true,
    });
    await log.append(e1);
    await log.append(e2);
    await log.append(e3);

    expect((await log.list(WS, { limit: 2 })).map((r) => r.mutationId)).toEqual(['m3', 'm2']);
    expect((await log.list(WS, { sinceHlcKey: e1.id.split('|')[0] })).map((r) => r.mutationId)).toEqual([
      'm3',
      'm2',
    ]);
    expect((await log.list(WS, { unreadOnly: true })).map((r) => r.mutationId)).toEqual(['m2', 'm1']);
  });

  it('markRead flips the read flag and updates countUnread', async () => {
    const log = new InMemoryActivityLog();
    const a = makeEntry({ mutationId: 'm1' });
    const b = makeEntry({ mutationId: 'm2' });
    await log.append(a);
    await log.append(b);
    expect(await log.countUnread(WS)).toBe(2);
    await log.markRead(WS, [a.id]);
    expect(await log.countUnread(WS)).toBe(1);
    const rows = await log.list(WS);
    const row = rows.find((r) => r.mutationId === 'm1');
    expect(row?.read).toBe(true);
  });

  it('prune drops rows observed before the cutoff and returns the count', async () => {
    const log = new InMemoryActivityLog();
    await log.append(makeEntry({ mutationId: 'old', observedAt: 100 }));
    await log.append(makeEntry({ mutationId: 'new', observedAt: 500 }));
    const removed = await log.prune(WS, 300);
    expect(removed).toBe(1);
    const rows = await log.list(WS);
    expect(rows.map((r) => r.mutationId)).toEqual(['new']);
  });

  it('has identifies a specific (mutationId, kind) pair', async () => {
    const log = new InMemoryActivityLog();
    await log.append(makeEntry({ mutationId: 'm1', kind: 'edit-entity' }));
    expect(await log.has(WS, 'm1', 'edit-entity')).toBe(true);
    expect(await log.has(WS, 'm1', 'delete-entity' as ActivityEntryKind)).toBe(false);
    expect(await log.has(WS, 'm2', 'edit-entity')).toBe(false);
  });

  it('auto-fills id from (hlc, mutationId, kind) when blank', async () => {
    const log = new InMemoryActivityLog();
    const e = makeEntry({ mutationId: 'm1' });
    await log.append({ ...e, id: '' });
    const rows = await log.list(WS);
    expect(rows[0].id).toBe(activityEntryId(e));
  });
});

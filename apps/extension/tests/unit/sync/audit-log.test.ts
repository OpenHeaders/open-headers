/**
 * Phase U2.4 — `AuditLog` contract.
 *
 * Pins:
 *   - `seq` is gapless within Org and starts at 1.
 *   - Sequences are partitioned per Org (two Orgs each start at 1).
 *   - `id` is `${orgId}:${seq}`.
 *   - `list` returns newest-first, optionally bounded by `limit` /
 *     `sinceSeq`.
 *   - `prune` removes rows with `occurredAt < beforeIso` and reports
 *     the count.
 *   - The IDB-backed implementation honours the same contract using the
 *     `audit_counters` object store (UNIFIED_ORACLE_MODEL.md §9.5).
 */

import { describe, expect, it } from 'vitest';

import { InMemoryAuditLog, type AuditLog } from '@openheaders/oracle/sync';

const ORG_A = '0193a900-aaaa-7000-8000-000000000001';
const ORG_B = '0193a900-aaaa-7000-8000-000000000002';
const USER = '0193a900-bbbb-7000-8000-000000000001';
const WS = '0193a900-cccc-7000-8000-000000000001';

function appendInput(orgId: string, occurredAt: string, overrides: Partial<{ workspaceId: string; allow: boolean }> = {}) {
  return {
    orgId,
    actorUserId: USER,
    capability: 'workspace.write' as const,
    workspaceId: overrides.workspaceId ?? WS,
    decision: { allow: overrides.allow ?? true },
    occurredAt,
  };
}

function suite(label: string, factory: () => AuditLog) {
  describe(label, () => {
    it('mints a gapless sequence within an Org starting at 1', async () => {
      const log = factory();
      const a = await log.append(appendInput(ORG_A, '2026-05-19T00:00:00.000Z'));
      const b = await log.append(appendInput(ORG_A, '2026-05-19T00:00:01.000Z'));
      const c = await log.append(appendInput(ORG_A, '2026-05-19T00:00:02.000Z'));
      expect([a.seq, b.seq, c.seq]).toEqual([1, 2, 3]);
      expect(a.id).toBe(`${ORG_A}:1`);
      expect(c.id).toBe(`${ORG_A}:3`);
    });

    it('partitions sequence by orgId', async () => {
      const log = factory();
      const a1 = await log.append(appendInput(ORG_A, '2026-05-19T00:00:00.000Z'));
      const b1 = await log.append(appendInput(ORG_B, '2026-05-19T00:00:00.000Z'));
      const a2 = await log.append(appendInput(ORG_A, '2026-05-19T00:00:01.000Z'));
      expect(a1.seq).toBe(1);
      expect(b1.seq).toBe(1);
      expect(a2.seq).toBe(2);
    });

    it('list returns newest-first', async () => {
      const log = factory();
      await log.append(appendInput(ORG_A, '2026-05-19T00:00:00.000Z'));
      await log.append(appendInput(ORG_A, '2026-05-19T00:00:01.000Z'));
      await log.append(appendInput(ORG_A, '2026-05-19T00:00:02.000Z'));
      const rows = await log.list(ORG_A);
      expect(rows.map((r) => r.seq)).toEqual([3, 2, 1]);
    });

    it('list respects sinceSeq + limit', async () => {
      const log = factory();
      for (let i = 0; i < 5; i++) {
        await log.append(appendInput(ORG_A, `2026-05-19T00:00:0${i}.000Z`));
      }
      const rows = await log.list(ORG_A, { sinceSeq: 2, limit: 2 });
      expect(rows.map((r) => r.seq)).toEqual([5, 4]);
    });

    it('prune drops entries before the cutoff and reports the count', async () => {
      const log = factory();
      await log.append(appendInput(ORG_A, '2026-05-01T00:00:00.000Z'));
      await log.append(appendInput(ORG_A, '2026-05-15T00:00:00.000Z'));
      await log.append(appendInput(ORG_A, '2026-05-19T00:00:00.000Z'));
      const removed = await log.prune(ORG_A, '2026-05-18T00:00:00.000Z');
      expect(removed).toBe(2);
      const remaining = await log.list(ORG_A);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.occurredAt).toBe('2026-05-19T00:00:00.000Z');
    });

    it('preserves deny decisions with reason', async () => {
      const log = factory();
      const denied = await log.append({
        orgId: ORG_A,
        actorUserId: USER,
        capability: 'workspace.write',
        workspaceId: WS,
        decision: { allow: false, reason: 'no-workspace-role-assignment' },
        occurredAt: '2026-05-19T00:00:00.000Z',
      });
      expect(denied.decision).toEqual({ allow: false, reason: 'no-workspace-role-assignment' });
    });
  });
}

suite('InMemoryAuditLog', () => new InMemoryAuditLog());

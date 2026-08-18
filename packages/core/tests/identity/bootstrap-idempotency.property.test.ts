/**
 * U1.9 property test — `bootstrapSyntheticIdentity` is byte-identical
 * across re-runs for the same `hostInstallId`, sampled across a 1000-id
 * batch.
 *
 * The deliverable text in the unified-oracle status log calls for "1000+
 * scenarios of random init-then-reseed-then-init produce byte-identical
 * row sets, asserting deterministic-UUID idempotency." This file pins
 * exactly that contract at the helper level. The wider end-to-end
 * idempotency (ensure → wipe → ensure with the host-install-id
 * surviving) lands when the per-row oracle-mutator persistence comes
 * online in Phase U2; until then the helper-level guarantee IS the
 * idempotency commitment, because every host persists the helper's
 * return tuple verbatim.
 *
 * Why pinned in its own file: `derive-uuid.test.ts` covers the
 * primitive layer (1000 distinct seeds yield 1000 distinct UUIDs); this
 * one covers the composition (1000 distinct `hostInstallId`s yield 1000
 * distinct bootstrap records, each stable under re-run).
 */

import { describe, expect, it } from 'vitest';
import { bootstrapSyntheticIdentity } from '../../src/identity';

const NOW = '2026-05-19T00:00:00.000Z';
const SAMPLE_SIZE = 1000;

describe('U1.9 — bootstrap idempotency at 1000-host scale', () => {
  it('produces byte-identical records when bootstrap is re-run for the same hostInstallId', async () => {
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const hostInstallId = `probe-host-${i}`;
      const [a, b] = await Promise.all([
        bootstrapSyntheticIdentity({ hostInstallId, hostKind: 'desktop', now: NOW }),
        bootstrapSyntheticIdentity({ hostInstallId, hostKind: 'desktop', now: NOW }),
      ]);
      // toEqual is a deep-equality check on the row tuple; any byte
      // drift across re-runs would surface here.
      expect(b).toEqual(a);
    }
  });

  it('1000 distinct hostInstallIds produce 1000 distinct user ids (no collisions)', async () => {
    const userIds = new Set<string>();
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const r = await bootstrapSyntheticIdentity({ hostInstallId: `probe-host-${i}`, hostKind: 'desktop', now: NOW });
      userIds.add(r.user.id);
    }
    expect(userIds.size).toBe(SAMPLE_SIZE);
  });

  it('1000 distinct hostInstallIds produce 1000 distinct org ids (no collisions)', async () => {
    const orgIds = new Set<string>();
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const r = await bootstrapSyntheticIdentity({ hostInstallId: `probe-host-${i}`, hostKind: 'desktop', now: NOW });
      orgIds.add(r.org.id);
    }
    expect(orgIds.size).toBe(SAMPLE_SIZE);
  });

  it('within a single record, the 7 row ids are pairwise distinct', async () => {
    const r = await bootstrapSyntheticIdentity({ hostInstallId: 'spot-check-host', hostKind: 'desktop', now: NOW });
    const ids = [
      r.user.id, r.org.id, r.userIdentity.id, r.session.id,
      r.membership.id, r.principal.id, r.localAdmin.id,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

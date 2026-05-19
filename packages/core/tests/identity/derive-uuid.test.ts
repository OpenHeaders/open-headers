/**
 * Coverage for the deterministic UUIDv7 derivation underlying every
 * synthetic identity row (UNIFIED_ORACLE_MODEL.md §5.1).
 *
 * The contract:
 *   - Same seed → byte-identical UUID across runs.
 *   - Distinct seeds → distinct UUIDs (collision probability ≡ random v7
 *     because SHA-256 expands enough entropy).
 *   - Output is valid UUIDv7 (version=7, variant=10) — gates through the
 *     `UuidV7Schema` regex at the schema boundary.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { deriveSyntheticUuidV7, SYNTHETIC_SEEDS } from '../../src/identity';
import { UuidV7Schema } from '../../src/schemas';

describe('deriveSyntheticUuidV7', () => {
  it('produces a valid UUIDv7 layout', async () => {
    const uuid = await deriveSyntheticUuidV7('local-user@host-abc');
    expect(v.safeParse(UuidV7Schema, uuid).success).toBe(true);
  });

  it('is deterministic for the same seed', async () => {
    const a = await deriveSyntheticUuidV7('local-user@host-abc');
    const b = await deriveSyntheticUuidV7('local-user@host-abc');
    expect(a).toBe(b);
  });

  it('produces distinct UUIDs for distinct seeds', async () => {
    const a = await deriveSyntheticUuidV7('local-user@host-abc');
    const b = await deriveSyntheticUuidV7('local-user@host-xyz');
    expect(a).not.toBe(b);
  });

  it('user-seed and org-seed for the same host produce distinct UUIDs', async () => {
    const u = await deriveSyntheticUuidV7(SYNTHETIC_SEEDS.user('host-abc'));
    const o = await deriveSyntheticUuidV7(SYNTHETIC_SEEDS.org('host-abc'));
    expect(u).not.toBe(o);
  });

  it('survives a 1000-seed batch with no collisions and full v7 conformance', async () => {
    const uuids = await Promise.all(
      Array.from({ length: 1000 }, (_, i) => deriveSyntheticUuidV7(`probe-seed-${i}`)),
    );
    expect(new Set(uuids).size).toBe(1000);
    for (const uuid of uuids) {
      expect(v.safeParse(UuidV7Schema, uuid).success).toBe(true);
    }
  });
});

describe('SYNTHETIC_SEEDS', () => {
  it('pins the wire format for each seed kind', () => {
    expect(SYNTHETIC_SEEDS.user('h')).toBe('local-user@h');
    expect(SYNTHETIC_SEEDS.org('h')).toBe('local-org@h');
    expect(SYNTHETIC_SEEDS.userIdentity('h')).toBe('local-user-identity@h');
    expect(SYNTHETIC_SEEDS.session('h')).toBe('local-session@h');
    expect(SYNTHETIC_SEEDS.membership('h')).toBe('local-membership@h');
    expect(SYNTHETIC_SEEDS.principal('h')).toBe('local-principal@h');
    expect(SYNTHETIC_SEEDS.daemonAdmin('h')).toBe('local-daemon-admin@h');
  });
});

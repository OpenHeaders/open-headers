/**
 * Phase U1 slice 1 schema coverage — the five fields landed per
 * UNIFIED_ORACLE_MODEL.md §5.3 (`User.isSynthetic`, `Org.isSynthetic`,
 * `'local'` in `UserIdentityKind`, `'local'` in `SessionSource`,
 * `DaemonConfig.hostInstallId`).
 *
 * The slice is additive — these tests pin the validator surface so later
 * slices (bootstrap helper, resolver, transport filter) can rely on
 * shape-stable rows.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  DaemonConfigSchema,
  OrgSchema,
  SessionSchema,
  UserIdentitySchema,
  UserSchema,
  UuidV7Schema,
} from '../../src/schemas';

// Deterministic-looking UUIDv7s with the right layout (version=7, variant=10).
const USER_UUID = '01900000-0000-7000-8000-000000000001';
const ORG_UUID = '01900000-0000-7000-8000-000000000002';
const IDENT_UUID = '01900000-0000-7000-8000-000000000003';
const SESSION_UUID = '01900000-0000-7000-8000-000000000004';

describe('UuidV7Schema', () => {
  it('accepts a well-formed UUIDv7', () => {
    expect(v.parse(UuidV7Schema, USER_UUID)).toBe(USER_UUID);
  });

  it('rejects a UUIDv4', () => {
    expect(
      v.safeParse(UuidV7Schema, '01900000-0000-4000-8000-000000000001').success,
    ).toBe(false);
  });

  it('rejects a non-UUID string', () => {
    expect(v.safeParse(UuidV7Schema, 'not-a-uuid').success).toBe(false);
  });
});

describe('UserSchema — isSynthetic landed (U1.1)', () => {
  it('accepts a synthetic user row', () => {
    expect(
      v.parse(UserSchema, {
        id: USER_UUID,
        displayName: 'Local',
        homeOrgId: ORG_UUID,
        isSynthetic: true,
      }),
    ).toMatchObject({ isSynthetic: true });
  });

  it('accepts a promoted (real) user row with same id', () => {
    expect(
      v.parse(UserSchema, {
        id: USER_UUID,
        displayName: 'Alice',
        homeOrgId: ORG_UUID,
        isSynthetic: false,
      }),
    ).toMatchObject({ isSynthetic: false });
  });

  it('rejects a missing isSynthetic field', () => {
    expect(
      v.safeParse(UserSchema, { id: USER_UUID, displayName: 'x', homeOrgId: ORG_UUID }).success,
    ).toBe(false);
  });

  it('rejects a non-boolean isSynthetic', () => {
    expect(
      v.safeParse(UserSchema, {
        id: USER_UUID,
        displayName: 'x',
        homeOrgId: ORG_UUID,
        isSynthetic: 'true',
      }).success,
    ).toBe(false);
  });
});

describe('OrgSchema — isSynthetic + hostKind landed (U1.1 / Bug B)', () => {
  it('accepts a synthetic org row', () => {
    expect(
      v.parse(OrgSchema, {
        id: ORG_UUID,
        name: 'Local',
        hostKind: 'browser',
        isSynthetic: true,
      }),
    ).toMatchObject({ isSynthetic: true, hostKind: 'browser' });
  });

  it('accepts every hostKind picklist value', () => {
    for (const hostKind of ['browser', 'desktop', 'daemon'] as const) {
      expect(v.safeParse(OrgSchema, { id: ORG_UUID, name: 'Local', hostKind, isSynthetic: true }).success).toBe(true);
    }
  });

  it('rejects a missing isSynthetic field', () => {
    expect(
      v.safeParse(OrgSchema, {
        id: ORG_UUID,
        name: 'Local',
        hostKind: 'desktop',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing hostKind field', () => {
    expect(
      v.safeParse(OrgSchema, {
        id: ORG_UUID,
        name: 'Local',
        isSynthetic: true,
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown hostKind value', () => {
    expect(
      v.safeParse(OrgSchema, {
        id: ORG_UUID,
        name: 'Local',
        hostKind: 'team',
        isSynthetic: true,
      }).success,
    ).toBe(false);
  });
});

describe('UserIdentitySchema — "local" kind landed (U1.2)', () => {
  it('accepts the synthetic local kind', () => {
    expect(
      v.parse(UserIdentitySchema, {
        id: IDENT_UUID,
        userId: USER_UUID,
        kind: 'local',
        value: null,
        isPrimary: true,
        verifiedAt: '2026-05-19T00:00:00.000Z',
      }),
    ).toMatchObject({ kind: 'local', value: null });
  });

  it('accepts the email kind alongside the local variant', () => {
    expect(
      v.parse(UserIdentitySchema, {
        id: IDENT_UUID,
        userId: USER_UUID,
        kind: 'email',
        value: 'alice@openheaders.io',
        isPrimary: true,
        verifiedAt: '2026-05-19T00:00:00.000Z',
      }),
    ).toMatchObject({ kind: 'email' });
  });

  it('rejects an unknown identity kind', () => {
    expect(
      v.safeParse(UserIdentitySchema, {
        id: IDENT_UUID,
        userId: USER_UUID,
        kind: 'oauth',
        value: 'x',
        isPrimary: true,
        verifiedAt: '2026-05-19T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('SessionSchema — "local" source landed (U1.2)', () => {
  it('accepts the synthetic local source', () => {
    expect(
      v.parse(SessionSchema, {
        id: SESSION_UUID,
        userId: USER_UUID,
        source: 'local',
        createdAt: '2026-05-19T00:00:00.000Z',
        revokedAt: null,
      }),
    ).toMatchObject({ source: 'local', revokedAt: null });
  });

  it('accepts a revokedAt timestamp (promotion path)', () => {
    expect(
      v.parse(SessionSchema, {
        id: SESSION_UUID,
        userId: USER_UUID,
        source: 'local',
        createdAt: '2026-05-19T00:00:00.000Z',
        revokedAt: '2026-05-20T00:00:00.000Z',
      }),
    ).toMatchObject({ revokedAt: '2026-05-20T00:00:00.000Z' });
  });

  it('rejects an unknown source', () => {
    expect(
      v.safeParse(SessionSchema, {
        id: SESSION_UUID,
        userId: USER_UUID,
        source: 'magic-link',
        createdAt: '2026-05-19T00:00:00.000Z',
        revokedAt: null,
      }).success,
    ).toBe(false);
  });
});

describe('DaemonConfigSchema — hostInstallId landed (U1.3)', () => {
  it('accepts a host-install-id', () => {
    expect(v.parse(DaemonConfigSchema, { hostInstallId: 'host-abc-123' })).toEqual({
      hostInstallId: 'host-abc-123',
    });
  });

  it('rejects an empty host-install-id', () => {
    expect(v.safeParse(DaemonConfigSchema, { hostInstallId: '' }).success).toBe(false);
  });

  it('rejects a missing host-install-id', () => {
    expect(v.safeParse(DaemonConfigSchema, {}).success).toBe(false);
  });
});

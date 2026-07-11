import { describe, expect, it } from 'vitest';
import { FREE_SEAT_LIMIT, RESERVED_ENTITLEMENTS } from '../../src/licensing';

describe('entitlement vocabulary', () => {
  it('pins the free seat limit at 10', () => {
    expect(FREE_SEAT_LIMIT).toBe(10);
  });

  it('reserves the v1 capability strings', () => {
    expect(RESERVED_ENTITLEMENTS).toEqual(['mock-server', 'workflows', 'scim', 'groups', 'audit-forwarding']);
  });
});

/**
 * resolveOrgActiveWorkspace — the Org-switch fallback chain
 * (remembered → default → first → null). Pure; Phase U5.9.
 */

import { describe, expect, it } from 'vitest';
import { resolveOrgActiveWorkspace } from '../../src/identity/org-workspace';
import type { ExtensionWorkspace } from '../../src/types';

const ORG_A = '01900000-aaaa-7000-8000-0000000000a1';
const ORG_B = '01900000-aaaa-7000-8000-0000000000a2';

function ws(id: string, orgId: string, sortIndex: number): ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id,
    kind: 'personal',
    name: id,
    sortIndex,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
    orgId,
  };
}

const workspaces: ExtensionWorkspace[] = [ws('a1', ORG_A, 1), ws('a2', ORG_A, 0), ws('b1', ORG_B, 0)];

describe('resolveOrgActiveWorkspace', () => {
  it("returns the Org's remembered active workspace when still valid", () => {
    expect(resolveOrgActiveWorkspace(ORG_A, workspaces, { [ORG_A]: 'a1' }, {})).toBe('a1');
  });

  it('falls back to the Org default when no remembered entry is valid', () => {
    expect(resolveOrgActiveWorkspace(ORG_A, workspaces, {}, { [ORG_A]: 'a1' })).toBe('a1');
  });

  it('skips a remembered entry that no longer lives in the Org', () => {
    // 'b1' is in ORG_B — not a valid ORG_A candidate; falls to first.
    expect(resolveOrgActiveWorkspace(ORG_A, workspaces, { [ORG_A]: 'b1' }, {})).toBe('a2');
  });

  it("falls back to the Org's first workspace in sort order", () => {
    expect(resolveOrgActiveWorkspace(ORG_A, workspaces, {}, {})).toBe('a2');
  });

  it('returns null for an Org with no workspaces', () => {
    expect(resolveOrgActiveWorkspace('01900000-aaaa-7000-8000-0000000000ff', workspaces, {}, {})).toBeNull();
  });
});

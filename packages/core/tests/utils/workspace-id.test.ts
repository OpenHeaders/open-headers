/**
 * Workspace identity — `generateWorkspaceId` + `isCanonicalWorkspaceId`.
 *
 * The function is a thin alias over `uuidv7`; this test pins the
 * canonical-form invariant the rest of the codebase relies on
 * (handshake's HELLO carries `workspaceId`; storage paths derive from
 * it; the YAML codec puts it in file paths).
 */
import { describe, expect, it } from 'vitest';

import {
  generateWorkspaceId,
  isCanonicalWorkspaceId,
} from '../../src/utils/workspace-id';
import { isUuidV7 } from '../../src/utils/uuidv7';

describe('generateWorkspaceId', () => {
  it('returns a canonical UUIDv7', () => {
    const id = generateWorkspaceId();
    expect(isUuidV7(id)).toBe(true);
    expect(isCanonicalWorkspaceId(id)).toBe(true);
  });

  it('produces unique ids across rapid calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateWorkspaceId());
    expect(seen.size).toBe(500);
  });
});

describe('isCanonicalWorkspaceId', () => {
  it('rejects legacy 8-char base36 ids that the older generator produced', () => {
    expect(isCanonicalWorkspaceId('x7k2abcd')).toBe(false);
  });

  it('rejects UUIDv4 strings', () => {
    expect(isCanonicalWorkspaceId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('rejects the global-scope sentinel', () => {
    // `__global__` is a reserved sentinel for the per-user oracle;
    // canonical workspace ids must never collide with it.
    expect(isCanonicalWorkspaceId('__global__')).toBe(false);
  });
});

/**
 * Phase C M7 — `findNameCollisions` pure helper. Pins:
 *
 *   - NFC normalization (pre-composed vs. decomposed Unicode)
 *   - locale-insensitive case-fold
 *   - whitespace trim
 *   - same-id pairs are NOT reported (Import already covers those)
 *   - empty / whitespace-only names are dropped
 *   - each target pairs with at most one source (first wins)
 *   - output order follows source iteration order
 */

import {
  findNameCollisions,
  normalizeWorkspaceNameForCollision,
  summarizeWorkspaces,
  type DataPresenceSummary,
  type WorkspaceContentSnapshot,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';

const ID_A = '0193a8ff-c000-7000-8000-00000000000a';
const ID_B = '0193a8ff-c000-7000-8000-00000000000b';
const ID_C = '0193a8ff-c000-7000-8000-00000000000c';
const ID_D = '0193a8ff-c000-7000-8000-00000000000d';

function ws(workspaceId: string, workspaceName: string): WorkspaceContentSnapshot {
  return { workspaceId, workspaceName, entityCounts: { rule: 1 } };
}

function presence(workspaces: WorkspaceContentSnapshot[]): DataPresenceSummary {
  return summarizeWorkspaces(workspaces);
}

describe('normalizeWorkspaceNameForCollision', () => {
  it('folds case', () => {
    expect(normalizeWorkspaceNameForCollision('Production')).toBe('production');
    expect(normalizeWorkspaceNameForCollision('PRODUCTION')).toBe('production');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeWorkspaceNameForCollision('  Staging  ')).toBe('staging');
  });

  it('canonicalizes Unicode (NFC pulls decomposed forms onto pre-composed)', () => {
    // é as a single pre-composed codepoint (U+00E9)
    const composed = 'Café';
    // e + combining acute (U+0065 U+0301)
    const decomposed = 'Café';
    expect(normalizeWorkspaceNameForCollision(composed)).toBe(
      normalizeWorkspaceNameForCollision(decomposed),
    );
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeWorkspaceNameForCollision('   ')).toBe('');
    expect(normalizeWorkspaceNameForCollision('')).toBe('');
  });
});

describe('findNameCollisions', () => {
  it('returns empty when no names match', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, 'Alpha')]),
      target: presence([ws(ID_B, 'Beta')]),
    });
    expect(out).toEqual([]);
  });

  it('returns empty when either side has no workspaces', () => {
    expect(
      findNameCollisions({
        source: presence([]),
        target: presence([ws(ID_A, 'Production')]),
      }),
    ).toEqual([]);
    expect(
      findNameCollisions({
        source: presence([ws(ID_A, 'Production')]),
        target: presence([]),
      }),
    ).toEqual([]);
  });

  it('pairs workspaces whose names match exactly', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, 'Production')]),
      target: presence([ws(ID_B, 'Production')]),
    });
    expect(out).toEqual([
      {
        sourceWorkspaceId: ID_A,
        sourceWorkspaceName: 'Production',
        targetWorkspaceId: ID_B,
        targetWorkspaceName: 'Production',
        normalizedName: 'production',
      },
    ]);
  });

  it('preserves the original casing of each side in the pair payload', () => {
    const [collision] = findNameCollisions({
      source: presence([ws(ID_A, 'PRODUCTION')]),
      target: presence([ws(ID_B, 'production')]),
    });
    expect(collision.sourceWorkspaceName).toBe('PRODUCTION');
    expect(collision.targetWorkspaceName).toBe('production');
    expect(collision.normalizedName).toBe('production');
  });

  it('treats decomposed and pre-composed Unicode as the same name', () => {
    const [collision] = findNameCollisions({
      source: presence([ws(ID_A, 'Café')]),
      target: presence([ws(ID_B, 'Café')]),
    });
    expect(collision).toBeTruthy();
    expect(collision.sourceWorkspaceId).toBe(ID_A);
    expect(collision.targetWorkspaceId).toBe(ID_B);
  });

  it('treats trailing/leading whitespace as the same name', () => {
    const [collision] = findNameCollisions({
      source: presence([ws(ID_A, 'Staging')]),
      target: presence([ws(ID_B, '  staging  ')]),
    });
    expect(collision).toBeTruthy();
  });

  it('skips same-id matches — Import already HLC-merges those', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, 'Production')]),
      target: presence([ws(ID_A, 'Production')]),
    });
    expect(out).toEqual([]);
  });

  it('drops empty / whitespace-only normalized names on both sides', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, '   '), ws(ID_B, 'Production')]),
      target: presence([ws(ID_C, '   '), ws(ID_D, 'Production')]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].sourceWorkspaceId).toBe(ID_B);
    expect(out[0].targetWorkspaceId).toBe(ID_D);
  });

  it('pairs each target with at most one source — first source wins', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, 'Production'), ws(ID_B, 'production')]),
      target: presence([ws(ID_C, 'Production')]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].sourceWorkspaceId).toBe(ID_A);
  });

  it('pairs each target with at most one source — first target also wins', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, 'Production')]),
      target: presence([ws(ID_B, 'Production'), ws(ID_C, 'production')]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].targetWorkspaceId).toBe(ID_B);
  });

  it('emits multiple collisions in source iteration order', () => {
    const out = findNameCollisions({
      source: presence([ws(ID_A, 'Staging'), ws(ID_B, 'Production')]),
      target: presence([ws(ID_C, 'Production'), ws(ID_D, 'Staging')]),
    });
    expect(out.map((c) => c.sourceWorkspaceId)).toEqual([ID_A, ID_B]);
    expect(out.map((c) => c.targetWorkspaceId)).toEqual([ID_D, ID_C]);
  });
});

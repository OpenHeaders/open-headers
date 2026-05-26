/**
 * Meta-test for the request-lifecycle invariant registry.
 *
 * Asserts that every invariant 1–8 declared in
 * `src/request-lifecycle/invariant-registry.ts` is either:
 *
 *   (a) enforced — every `assertedBy` path resolves on disk relative
 *       to the repo root, and each file contents contains the literal
 *       `marker`; or
 *
 *   (b) explicitly pending — `assertedBy` is empty and `pending` is
 *       set with a non-empty `slice` and `reason`.
 *
 * Renaming a `describe` block, moving a test file, or silently
 * removing an assertion all surface here as a named failure pointing
 * at the invariant whose enforcement disappeared.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REQUEST_LIFECYCLE_INVARIANTS,
  type InvariantId,
} from '../../src/request-lifecycle/invariant-registry';

const REPO_ROOT = findRepoRoot();

function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  // Walk up until we find pnpm-workspace.yaml — the marker file for
  // this monorepo's root.
  while (dir !== '/' && dir.length > 1) {
    try {
      statSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('Could not locate repo root (pnpm-workspace.yaml not found)');
}

describe('request-lifecycle invariant registry — completeness', () => {
  it('declares exactly the eight canonical invariants (1–8), each once', () => {
    const ids = REQUEST_LIFECYCLE_INVARIANTS.map((entry) => entry.id).sort();
    expect(ids).toEqual<InvariantId[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gives every entry a non-empty name and summary', () => {
    for (const entry of REQUEST_LIFECYCLE_INVARIANTS) {
      expect(entry.name, `invariant ${entry.id} name`).toMatch(/\S/);
      expect(entry.summary, `invariant ${entry.id} summary`).toMatch(/\S/);
    }
  });
});

describe('request-lifecycle invariant registry — enforced entries', () => {
  const enforced = REQUEST_LIFECYCLE_INVARIANTS.filter((entry) => entry.pending === undefined);

  it('every enforced entry has at least one assertion', () => {
    for (const entry of enforced) {
      expect(entry.assertedBy.length, `invariant ${entry.id} assertedBy`).toBeGreaterThan(0);
    }
  });

  for (const entry of enforced) {
    for (const assertion of entry.assertedBy) {
      it(`invariant ${entry.id} — ${assertion.path} contains its marker`, () => {
        const absolute = resolve(REPO_ROOT, assertion.path);
        let contents: string;
        try {
          contents = readFileSync(absolute, 'utf8');
        } catch (err) {
          throw new Error(
            `invariant ${entry.id}: assertion file does not exist at ${assertion.path}` +
              ` (resolved to ${absolute}). Either restore the file or update the registry.`,
            { cause: err },
          );
        }
        expect(
          contents.includes(assertion.marker),
          `invariant ${entry.id}: ${assertion.path} no longer contains marker ${JSON.stringify(assertion.marker)}. ` +
            `Either restore the describe/it block, or update the marker in invariant-registry.ts.`,
        ).toBe(true);
      });
    }
  }
});

describe('request-lifecycle invariant registry — pending entries', () => {
  const pending = REQUEST_LIFECYCLE_INVARIANTS.filter((entry) => entry.pending !== undefined);

  it('every pending entry has no concurrent assertions (pending and enforced are mutually exclusive)', () => {
    for (const entry of pending) {
      expect(entry.assertedBy.length, `invariant ${entry.id} pending+assertedBy mix`).toBe(0);
    }
  });

  it('every pending entry names a slice and a reason', () => {
    for (const entry of pending) {
      expect(entry.pending?.slice, `invariant ${entry.id} pending.slice`).toMatch(/\S/);
      expect(entry.pending?.reason, `invariant ${entry.id} pending.reason`).toMatch(/\S/);
    }
  });
});

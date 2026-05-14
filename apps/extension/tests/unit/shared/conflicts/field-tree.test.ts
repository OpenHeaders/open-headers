/**
 * Walker extensions added in Session 29 — exercised against synthetic
 * schemas that are decoupled from the production canaries so the tests
 * pin behavior, not coverage.
 *
 *   1. `array-comma-space-join` coercion policy round-trips
 *      `string[]` ↔ comma-space joined string.
 *   2. `baseline: 'skip'` excludes a leaf from `extractBaseline` while
 *      `readPath` still surfaces it.
 *   3. `discriminate(parent, value)` lets a union read its tag from a
 *      sibling path (Rule's `type` lives outside the action subtree).
 *   4. `writeLeafOverride` returning `'fallthrough'` lets bundles
 *      handle specific paths and let everything else default-write.
 */

import { describe, expect, it } from 'vitest';
import { enumLeaf, leaf, obj, setByUid, union } from '@openheaders/ui/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';

describe('field-tree walker — Session 29 extensions', () => {
  describe('array-comma-space-join coercion', () => {
    const SCHEMA = obj({
      tags: leaf('string', { coercion: 'array-comma-space-join' }),
    });
    const adapters = makeConflictAdapter<{ uid: string; tags: string[] }>({
      schema: SCHEMA,
      signature: (e) => e.uid,
    });

    it('joins array values with comma-space in baseline', () => {
      const baseline = adapters.tracking.extractBaseline({ uid: 'e1', tags: ['a', 'b', 'c'] });
      expect(baseline).toEqual({ tags: 'a, b, c' });
    });

    it('reads non-array values as empty string', () => {
      const baseline = adapters.tracking.extractBaseline({ uid: 'e1', tags: undefined as unknown as string[] });
      expect(baseline).toEqual({ tags: '' });
    });

    it('writes empty string back to []', () => {
      const e = { uid: 'e1', tags: ['a'] };
      adapters.resolve.applyResolutionToEntity(e, 'tags', { base: 'a', theirs: '' });
      expect(e.tags).toEqual([]);
    });

    it('writes joined string back to trimmed array', () => {
      const e = { uid: 'e1', tags: [] as string[] };
      adapters.resolve.applyResolutionToEntity(e, 'tags', { base: '', theirs: 'x, y, z' });
      expect(e.tags).toEqual(['x', 'y', 'z']);
    });
  });

  describe("baseline: 'skip'", () => {
    const SCHEMA = obj({
      visible: leaf('string'),
      hidden: leaf('string', { baseline: 'skip' }),
    });
    const adapters = makeConflictAdapter<{ uid: string; visible: string; hidden: string }>({
      schema: SCHEMA,
      signature: (e) => e.uid,
    });

    it('omits skip-flagged leaf from extractBaseline', () => {
      const baseline = adapters.tracking.extractBaseline({ uid: 'e1', visible: 'v', hidden: 'h' });
      expect(baseline).toEqual({ visible: 'v' });
    });

    it('readPath still surfaces the skip-flagged leaf', () => {
      expect(adapters.tracking.readPath({ uid: 'e1', visible: 'v', hidden: 'h' }, 'hidden')).toBe('h');
    });

    it('write still works for skip-flagged leaf', () => {
      const e = { uid: 'e1', visible: 'v', hidden: 'h' };
      adapters.resolve.applyResolutionToEntity(e, 'hidden', { base: 'h', theirs: 'h2' });
      expect(e.hidden).toBe('h2');
    });
  });

  describe('discriminate accessor on union', () => {
    interface Rule {
      uid: string;
      type: 'a' | 'b';
      action: { foo?: string; bar?: string };
    }
    const SCHEMA = obj({
      type: enumLeaf(['a', 'b']),
      action: union({
        discriminator: 'type',
        kindTransitionUnsafe: true,
        discriminate: (parent) => (parent as { type?: string } | null | undefined)?.type,
        branches: {
          a: obj({ foo: leaf('string') }),
          b: obj({ bar: leaf('string') }),
        },
      }),
    });
    const adapters = makeConflictAdapter<Rule>({ schema: SCHEMA, signature: (e) => e.uid });

    it('reads the active branch using the parent-level discriminator', () => {
      const baseline = adapters.tracking.extractBaseline({ uid: 'r1', type: 'a', action: { foo: 'x' } });
      expect(baseline).toEqual({ type: 'a', 'action.foo': 'x' });
    });

    it('descends into the alternative branch when the discriminator changes', () => {
      const baseline = adapters.tracking.extractBaseline({ uid: 'r1', type: 'b', action: { bar: 'y' } });
      expect(baseline).toEqual({ type: 'b', 'action.bar': 'y' });
    });

    it('readPath honors the parent-level discriminator', () => {
      const r: Rule = { uid: 'r1', type: 'a', action: { foo: 'x' } };
      expect(adapters.tracking.readPath(r, 'action.foo')).toBe('x');
      expect(adapters.tracking.readPath(r, 'action.bar')).toBeNull();
    });
  });

  describe("writeLeafOverride 'fallthrough'", () => {
    interface Entity {
      uid: string;
      name: string;
      other: string;
      _externalNameSink: string;
    }
    const SCHEMA = obj({
      name: leaf('string'),
      other: leaf('string'),
    });
    const adapters = makeConflictAdapter<Entity>({
      schema: SCHEMA,
      signature: (e) => e.uid,
      writeLeafOverride: (entity, path, value) => {
        if (path === 'name') {
          entity._externalNameSink = value;
          return true;
        }
        return 'fallthrough';
      },
    });

    it('intercepted path routes to the sink without touching the schema field', () => {
      const e: Entity = { uid: 'e1', name: 'old', other: 'o', _externalNameSink: '' };
      const ok = adapters.resolve.applyResolutionToEntity(e, 'name', { base: 'old', theirs: 'new' });
      expect(ok).toBe(true);
      expect(e._externalNameSink).toBe('new');
      expect(e.name).toBe('old');
    });

    it("'fallthrough' lets the default writer handle non-intercepted paths", () => {
      const e: Entity = { uid: 'e1', name: 'old', other: 'o', _externalNameSink: '' };
      const ok = adapters.resolve.applyResolutionToEntity(e, 'other', { base: 'o', theirs: 'o2' });
      expect(ok).toBe(true);
      expect(e.other).toBe('o2');
      expect(e._externalNameSink).toBe('');
    });
  });

  describe('unions emit nested set rows correctly', () => {
    interface Branch {
      uid: string;
      kind: 'pair' | 'single';
      pair?: { uid: string; left: string; right: string }[];
      value?: string;
    }
    const SCHEMA = obj({
      branch: union({
        discriminator: 'kind',
        kindTransitionUnsafe: true,
        branches: {
          pair: obj({
            kind: enumLeaf(['pair', 'single']),
            pair: setByUid({
              summary: (r) => `${(r as { left: string }).left}=${(r as { right: string }).right}`,
              child: obj({ left: leaf('string'), right: leaf('string') }),
            }),
          }),
          single: obj({
            kind: enumLeaf(['pair', 'single']),
            value: leaf('string'),
          }),
        },
      }),
    });
    const adapters = makeConflictAdapter<{ uid: string; branch: Branch }>({
      schema: SCHEMA,
      signature: (e) => e.uid,
    });

    it('emits set leaves under the active branch only', () => {
      const baseline = adapters.tracking.extractBaseline({
        uid: 'e1',
        branch: { uid: 'b1', kind: 'pair', pair: [{ uid: 'aaaaaaa1', left: 'L', right: 'R' }] },
      });
      expect(baseline).toEqual({
        'branch.kind': 'pair',
        'branch.pair.aaaaaaa1.left': 'L',
        'branch.pair.aaaaaaa1.right': 'R',
      });
    });
  });
});

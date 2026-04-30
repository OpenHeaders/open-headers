/**
 * Coverage for {@link useDirtyDraft} — the shared dirty-tracking hook
 * used by EnvironmentEditor / WorkspaceVariablesEditor / VaultEditor /
 * CollectionVariablesEditor.
 *
 * Regression target: the `useMemo`-on-ref bug where `isDirty` stayed
 * stale after a successful save because the underlying ref didn't
 * trigger memo invalidation. The test `markPersisted clears dirty`
 * nails that exact behaviour.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDirtyDraft } from '@/workbench/hooks/useDirtyDraft';

// Module-level fingerprint — stable reference as the hook contract requires.
const fingerprint = (arr: ReadonlyArray<{ name: string; value: string }>): string =>
  JSON.stringify(arr.map((e) => [e.name, e.value]));

type Entry = { name: string; value: string };

function mount(initial: Entry[] | null) {
  return renderHook(
    ({ serverDraft }: { serverDraft: Entry[] | null }) =>
      useDirtyDraft<Entry[]>({ serverDraft, fingerprint, empty: [] }),
    {
      initialProps: { serverDraft: initial },
    },
  );
}

describe('useDirtyDraft — initial state', () => {
  it('seeds draft from serverDraft when provided', () => {
    const seed: Entry[] = [{ name: 'API_URL', value: 'https://openheaders.io' }];
    const { result } = mount(seed);
    expect(result.current.draft).toEqual(seed);
    expect(result.current.isDirty).toBe(false);
  });

  it('falls back to empty when serverDraft is null', () => {
    const { result } = mount(null);
    expect(result.current.draft).toEqual([]);
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useDirtyDraft — local edits', () => {
  it('flags dirty when setDraft produces a different fingerprint', () => {
    const { result } = mount([]);
    act(() => {
      result.current.setDraft([{ name: 'A', value: '1' }]);
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('stays clean when setDraft produces an equivalent fingerprint', () => {
    const seed: Entry[] = [{ name: 'A', value: '1' }];
    const { result } = mount(seed);
    act(() => {
      // Same fingerprint — different object identity.
      result.current.setDraft([{ name: 'A', value: '1' }]);
    });
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useDirtyDraft — markPersisted', () => {
  it('clears isDirty after a successful save (the regression the hook exists to fix)', () => {
    const { result } = mount([]);
    act(() => {
      result.current.setDraft([{ name: 'X', value: 'Y' }]);
    });
    expect(result.current.isDirty).toBe(true);

    // Simulate a successful save — caller passes the persisted value.
    act(() => {
      result.current.markPersisted(result.current.draft);
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('accepts a transform-shifted persisted value (vault-style)', () => {
    // Vault editor computes `fromVars(draft)` before saving; the persisted
    // value passed to markPersisted reflects the transformed shape. Here
    // we simulate: draft has one junk entry, but only the named entries
    // are saved.
    const { result } = mount([]);
    act(() => {
      result.current.setDraft([
        { name: 'KEEP', value: '1' },
        { name: '', value: 'drop' }, // blank-name row — editor filters out
      ]);
    });
    expect(result.current.isDirty).toBe(true);

    const persistedAsSaved: Entry[] = [{ name: 'KEEP', value: '1' }];
    act(() => {
      result.current.markPersisted(persistedAsSaved);
    });
    // Draft still holds the blank row; isDirty reflects the difference
    // between CURRENT draft and LAST persisted shape.
    expect(result.current.isDirty).toBe(true);
  });
});

describe('useDirtyDraft — external server updates', () => {
  it('resyncs draft when a different server value arrives', () => {
    const seed: Entry[] = [{ name: 'A', value: '1' }];
    const next: Entry[] = [{ name: 'A', value: '2' }];
    const { result, rerender } = mount(seed);

    rerender({ serverDraft: next });
    expect(result.current.draft).toEqual(next);
    expect(result.current.isDirty).toBe(false);
  });

  it('does NOT resync when the server value fingerprints the same', () => {
    const seed: Entry[] = [{ name: 'A', value: '1' }];
    const { result, rerender } = mount(seed);

    act(() => {
      result.current.setDraft([{ name: 'A', value: 'draft-edit' }]);
    });
    expect(result.current.isDirty).toBe(true);

    // Same server contents, new array identity (common: broadcast replay).
    rerender({ serverDraft: [{ name: 'A', value: '1' }] });
    // Draft edits preserved, dirty flag preserved — the hook doesn't
    // clobber user state when the server hasn't actually changed.
    expect(result.current.draft).toEqual([{ name: 'A', value: 'draft-edit' }]);
    expect(result.current.isDirty).toBe(true);
  });

  it('goes from null → loaded by resyncing the draft', () => {
    const { result, rerender } = mount(null);
    expect(result.current.draft).toEqual([]);

    const arrived: Entry[] = [{ name: 'A', value: '1' }];
    rerender({ serverDraft: arrived });
    expect(result.current.draft).toEqual(arrived);
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useDirtyDraft — §6.3 dirty-gate on resync', () => {
  it('does NOT clobber user typing when an external commit lands while dirty', () => {
    const seed: Entry[] = [{ name: 'A', value: '1' }];
    const external: Entry[] = [{ name: 'A', value: 'committed-elsewhere' }];
    const { result, rerender } = mount(seed);

    // User starts typing.
    act(() => {
      result.current.setDraft([{ name: 'A', value: 'draft-edit' }]);
    });
    expect(result.current.isDirty).toBe(true);

    // External commit lands — broadcast replays a new server value.
    rerender({ serverDraft: external });

    // Draft stays as the user's typing — LWW resolves at the oracle on save.
    expect(result.current.draft).toEqual([{ name: 'A', value: 'draft-edit' }]);
    expect(result.current.isDirty).toBe(true);
  });
});

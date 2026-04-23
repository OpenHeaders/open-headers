import { describe, expect, it } from 'vitest';
import {
  type CollectionEnvAutoSwitchMode,
  resolveAutoSwitchTarget,
  resolveCollectionEnv,
} from '../../src/utils/collection-env-resolution';

// Minimal collection shape the resolver reads from — mirrors what
// App.tsx passes in (full V5.Collection[] works too; only the uid +
// defaultEnvironmentId are consumed).
function collection(uid: string, defaultEnvironmentId: string | null = null) {
  return { uid, defaultEnvironmentId };
}

describe('resolveAutoSwitchTarget — keep-selection mode', () => {
  const mode: CollectionEnvAutoSwitchMode = 'keep-selection';

  it('leaves the active env unchanged when one is selected', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: {},
      activeEnvId: 'env-picked',
      manualEnvId: 'env-picked',
      knownEnvIds: new Set(['env-picked', 'env-default']),
    });
    expect(result).toBe('env-picked');
  });

  it('bootstraps to the collection default when nothing is selected', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: {},
      activeEnvId: null,
      manualEnvId: null,
      knownEnvIds: new Set(['env-default']),
    });
    expect(result).toBe('env-default');
  });

  it('stays at null when nothing is selected and the collection has no default', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', null)],
      overrides: {},
      activeEnvId: null,
      manualEnvId: null,
      knownEnvIds: new Set(),
    });
    expect(result).toBeNull();
  });

  it('ignores a collection default that points to a deleted env', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-gone')],
      overrides: {},
      activeEnvId: null,
      manualEnvId: null,
      knownEnvIds: new Set(['env-other']),
    });
    expect(result).toBeNull();
  });
});

describe('resolveAutoSwitchTarget — apply-defaults mode', () => {
  const mode: CollectionEnvAutoSwitchMode = 'apply-defaults';

  it("switches to a collection's default when inside one", () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-staging')],
      overrides: {},
      activeEnvId: 'env-base',
      manualEnvId: 'env-base',
      knownEnvIds: new Set(['env-staging', 'env-base']),
    });
    expect(result).toBe('env-staging');
  });

  it('restores the manual base env when the collection has no default', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-b',
      collections: [collection('col-b', null)],
      overrides: {},
      activeEnvId: 'env-staging',
      manualEnvId: 'env-base',
      knownEnvIds: new Set(['env-staging', 'env-base']),
    });
    expect(result).toBe('env-base');
  });

  it('restores the manual base env outside any collection', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: null,
      collections: [],
      overrides: {},
      activeEnvId: 'env-staging',
      manualEnvId: 'env-base',
      knownEnvIds: new Set(['env-staging', 'env-base']),
    });
    expect(result).toBe('env-base');
  });

  it('returns null when there is no default and no manual base', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-b',
      collections: [collection('col-b', null)],
      overrides: {},
      activeEnvId: null,
      manualEnvId: null,
      knownEnvIds: new Set(),
    });
    expect(result).toBeNull();
  });

  it('drops a manual base env whose uid no longer exists', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: null,
      collections: [],
      overrides: {},
      activeEnvId: 'env-base',
      manualEnvId: 'env-deleted',
      knownEnvIds: new Set(['env-base']),
    });
    expect(result).toBeNull();
  });
});

describe('resolveAutoSwitchTarget — follow-collection mode', () => {
  const mode: CollectionEnvAutoSwitchMode = 'follow-collection';

  it('applies a per-collection override when present', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: { 'col-a': 'env-picked' },
      activeEnvId: 'env-anything',
      manualEnvId: null,
      knownEnvIds: new Set(['env-default', 'env-picked', 'env-anything']),
    });
    expect(result).toBe('env-picked');
  });

  it('honors a "No environment" override (null value)', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: { 'col-a': null },
      activeEnvId: 'env-default',
      manualEnvId: null,
      knownEnvIds: new Set(['env-default']),
    });
    expect(result).toBeNull();
  });

  it("falls back to the collection's default when no override exists", () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: {},
      activeEnvId: 'env-current',
      manualEnvId: null,
      knownEnvIds: new Set(['env-default', 'env-current']),
    });
    expect(result).toBe('env-default');
  });

  it('keeps the current active env when the collection has no default', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-b',
      collections: [collection('col-b', null)],
      overrides: {},
      activeEnvId: 'env-current',
      manualEnvId: null,
      knownEnvIds: new Set(['env-current']),
    });
    expect(result).toBe('env-current');
  });

  it('ignores an override that points to a deleted env and falls through to default', () => {
    const result = resolveAutoSwitchTarget({
      mode,
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: { 'col-a': 'env-gone' },
      activeEnvId: null,
      manualEnvId: null,
      knownEnvIds: new Set(['env-default']),
    });
    expect(result).toBe('env-default');
  });
});

describe('resolveCollectionEnv (legacy entry point)', () => {
  it('is equivalent to follow-collection resolution', () => {
    const shared = {
      collectionId: 'col-a',
      collections: [collection('col-a', 'env-default')],
      overrides: { 'col-a': 'env-override' },
      activeEnvId: 'env-current',
      knownEnvIds: new Set(['env-default', 'env-override', 'env-current']),
    };
    const direct = resolveCollectionEnv(shared);
    const viaTarget = resolveAutoSwitchTarget({
      ...shared,
      mode: 'follow-collection',
      manualEnvId: null,
    });
    expect(direct).toBe(viaTarget);
  });
});

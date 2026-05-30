/**
 * `enumerateSnapshotEntities` — the pure projection of a
 * {@link WorkspaceSnapshot} down to its user-content entity ids. Shared
 * by the mode-switch orchestrators that need an entity tally (the
 * Discard archive's per-workspace count).
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import { enumerateSnapshotEntities } from '@openheaders/oracle/sync';
import { describe, expect, it } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';

function makeSnapshot(workspaceId: string, overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    takenAtHlc: {},
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
    ...overrides,
  };
}

describe('enumerateSnapshotEntities', () => {
  it('returns an empty list for a snapshot with no user-content entries', () => {
    expect(enumerateSnapshotEntities(makeSnapshot(WS_A))).toEqual([]);
  });

  it('extracts uid as the entity id for every per-type post-state array', () => {
    const snap = makeSnapshot(WS_A, {
      // Cast through unknown so the test doesn't have to construct every
      // schema field; the enumerator only reads `<entry>.<kind>.uid`.
      rules: [{ rule: { uid: 'rule-1' } }] as unknown as WorkspaceSnapshot['rules'],
      environments: [{ environment: { uid: 'env-1' } }] as unknown as WorkspaceSnapshot['environments'],
      collections: [{ collection: { uid: 'col-1' } }] as unknown as WorkspaceSnapshot['collections'],
      folders: [{ folder: { uid: 'fol-1' } }] as unknown as WorkspaceSnapshot['folders'],
      requests: [{ request: { uid: 'req-1' } }] as unknown as WorkspaceSnapshot['requests'],
      liveWorkflows: [{ workflow: { uid: 'wf-1' } }] as unknown as WorkspaceSnapshot['liveWorkflows'],
    });
    const enumerated = enumerateSnapshotEntities(snap);
    expect(enumerated).toContainEqual({ type: 'rule', id: 'rule-1' });
    expect(enumerated).toContainEqual({ type: 'environment', id: 'env-1' });
    expect(enumerated).toContainEqual({ type: 'collection', id: 'col-1' });
    expect(enumerated).toContainEqual({ type: 'folder', id: 'fol-1' });
    expect(enumerated).toContainEqual({ type: 'request', id: 'req-1' });
    expect(enumerated).toContainEqual({ type: 'live-workflow', id: 'wf-1' });
  });

  it('surfaces oauth-bundle keyed by workspaceId when the bundle is populated', () => {
    const snap = makeSnapshot(WS_A, {
      liveValues: [],
      liveFallbackPriority: [],
      oauthBundles: [{ tokens: [], configs: [], refreshErrors: [] }] as unknown as WorkspaceSnapshot['oauthBundles'],
    });
    expect(enumerateSnapshotEntities(snap)).toContainEqual({ type: 'oauth-bundle', id: WS_A });
  });
});

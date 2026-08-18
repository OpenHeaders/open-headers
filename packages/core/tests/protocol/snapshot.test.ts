import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  HOST_LOCAL_SNAPSHOT_KEYS,
  MIN_SNAPSHOT_SCHEMA_VERSION,
  redactHostLocalSnapshotKeys,
  redactSameDeviceOnlySnapshotKeys,
  redactSensitiveSnapshotKeys,
  SAME_DEVICE_ONLY_SNAPSHOT_KEYS,
  SENSITIVE_SNAPSHOT_KEYS,
  SNAPSHOT_SCHEMA_VERSION,
  SYNC_SNAPSHOT_TYPE,
  SyncSnapshotMessageSchema,
  type WorkspaceSnapshot,
  WorkspaceSnapshotSchema,
} from '../../src/protocol';

function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId: 'ws-1',
    takenAtHlc: { sw: { physicalMs: 100, logical: 0, nodeId: 'sw' } },
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    grpcRequests: [],
    websocketRequests: [],
    responseExamples: [],
    grpcResponseExamples: [],
    wsResponseExamples: [],
    scriptPackages: [],
    specs: [],
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

describe('SNAPSHOT_SCHEMA_VERSION constants', () => {
  it('current >= min', () => {
    expect(SNAPSHOT_SCHEMA_VERSION).toBeGreaterThanOrEqual(MIN_SNAPSHOT_SCHEMA_VERSION);
  });
});

describe('WorkspaceSnapshotSchema', () => {
  it('round-trips an empty snapshot', () => {
    const snap = makeSnapshot();
    expect(v.parse(WorkspaceSnapshotSchema, snap)).toEqual(snap);
  });

  it('accepts opaque payloads in entity arrays', () => {
    const opaqueRule = { rule: { totally: 'unknown' }, setItemIds: {}, setOrderKeys: {} };
    const snap = makeSnapshot({
      rules: [opaqueRule as unknown as WorkspaceSnapshot['rules'][number]],
    });
    expect(() => v.parse(WorkspaceSnapshotSchema, snap)).not.toThrow();
  });

  it('rejects schemaVersion below the minimum', () => {
    expect(() => v.parse(WorkspaceSnapshotSchema, makeSnapshot({ schemaVersion: 0 }))).toThrow();
  });

  it('rejects an empty workspaceId', () => {
    expect(() => v.parse(WorkspaceSnapshotSchema, makeSnapshot({ workspaceId: '' }))).toThrow();
  });

  it('rejects a missing entity array', () => {
    const snap = makeSnapshot();
    delete (snap as Partial<WorkspaceSnapshot>).rules;
    expect(() => v.parse(WorkspaceSnapshotSchema, snap)).toThrow();
  });

  it('defaults the post-first-cut arrays to empty when an older sender omits them', () => {
    const snap = makeSnapshot();
    for (const key of [
      'grpcRequests',
      'websocketRequests',
      'responseExamples',
      'grpcResponseExamples',
      'wsResponseExamples',
      'scriptPackages',
      'specs',
    ] as const) {
      delete (snap as Partial<WorkspaceSnapshot>)[key];
    }
    const parsed = v.parse(WorkspaceSnapshotSchema, snap);
    expect(parsed.grpcRequests).toEqual([]);
    expect(parsed.specs).toEqual([]);
    expect(parsed.websocketRequests).toEqual([]);
  });

  it('validates an embedded takenAtHlc state vector', () => {
    const bad = makeSnapshot({
      takenAtHlc: { sw: { physicalMs: -1, logical: 0, nodeId: 'sw' } },
    });
    expect(() => v.parse(WorkspaceSnapshotSchema, bad)).toThrow();
  });
});

describe('SyncSnapshotMessageSchema', () => {
  it('round-trips a message envelope', () => {
    const msg = { type: SYNC_SNAPSHOT_TYPE, workspaceId: 'ws-1', snapshot: makeSnapshot() };
    expect(v.parse(SyncSnapshotMessageSchema, msg)).toEqual(msg);
  });

  it('rejects an unknown discriminator', () => {
    const msg = { type: 'oh.sync.elsewhere', workspaceId: 'ws-1', snapshot: makeSnapshot() };
    expect(() => v.parse(SyncSnapshotMessageSchema, msg)).toThrow();
  });
});

describe('redactSensitiveSnapshotKeys', () => {
  it('blanks every sensitive array', () => {
    const snap = makeSnapshot({
      vault: [{ vault: { uid: 'v' }, secretUids: ['s1'] } as unknown as WorkspaceSnapshot['vault'][number]],
      oauthBundles: [
        {
          tokens: { ref1: { token: 'secret' } },
          configs: {},
          refreshErrors: {},
          credentialRefs: ['ref1'],
        },
      ],
      liveValues: [
        {
          values: {
            'wf1:__none__': {
              workflowUid: 'wf1',
              environmentId: null,
              stepCaptures: { s1: { token: 'secret' } },
              extractedAt: 1,
              expiresAt: null,
            },
          },
          runKeys: ['wf1:__none__'],
        },
      ],
    });
    const redacted = redactSensitiveSnapshotKeys(snap);
    for (const key of SENSITIVE_SNAPSHOT_KEYS) expect(redacted[key]).toEqual([]);
  });

  it('leaves non-sensitive arrays untouched (referential equality)', () => {
    const rules = [{ rule: {}, setItemIds: {}, setOrderKeys: {} }] as unknown as WorkspaceSnapshot['rules'];
    const snap = makeSnapshot({ rules });
    const redacted = redactSensitiveSnapshotKeys(snap);
    expect(redacted.rules).toBe(rules);
  });

  it('does not mutate the input', () => {
    const snap = makeSnapshot({
      vault: [{ vault: { uid: 'v' } } as unknown as WorkspaceSnapshot['vault'][number]],
    });
    const before = JSON.parse(JSON.stringify(snap));
    redactSensitiveSnapshotKeys(snap);
    expect(snap).toEqual(before);
  });
});

describe('redactSameDeviceOnlySnapshotKeys', () => {
  it('only lists the vault as same-device-only (strict subset of sensitive keys)', () => {
    expect(SAME_DEVICE_ONLY_SNAPSHOT_KEYS).toEqual(['vault']);
    for (const key of SAME_DEVICE_ONLY_SNAPSHOT_KEYS) {
      expect(SENSITIVE_SNAPSHOT_KEYS).toContain(key);
    }
  });

  it('blanks the vault but keeps derived OAuth + live values flowing', () => {
    const oauthBundles = [
      { tokens: { ref1: { token: 'secret' } }, configs: {}, refreshErrors: {}, credentialRefs: ['ref1'] },
    ] as unknown as WorkspaceSnapshot['oauthBundles'];
    const liveValues = [{ values: {}, runKeys: [] }] as unknown as WorkspaceSnapshot['liveValues'];
    const snap = makeSnapshot({
      vault: [{ vault: { uid: 'v' }, secretUids: ['s1'] } as unknown as WorkspaceSnapshot['vault'][number]],
      oauthBundles,
      liveValues,
    });
    const redacted = redactSameDeviceOnlySnapshotKeys(snap);
    expect(redacted.vault).toEqual([]);
    // OAuth + live values are trust-zone-scoped, not device-scoped — untouched.
    expect(redacted.oauthBundles).toBe(oauthBundles);
    expect(redacted.liveValues).toBe(liveValues);
  });

  it('does not mutate the input', () => {
    const snap = makeSnapshot({
      vault: [{ vault: { uid: 'v' } } as unknown as WorkspaceSnapshot['vault'][number]],
    });
    const before = JSON.parse(JSON.stringify(snap));
    redactSameDeviceOnlySnapshotKeys(snap);
    expect(snap).toEqual(before);
  });
});

describe('redactHostLocalSnapshotKeys', () => {
  it('only lists the layout singleton as host-local', () => {
    expect(HOST_LOCAL_SNAPSHOT_KEYS).toEqual(['layoutState']);
  });

  it('blanks the layout but keeps synced entities flowing', () => {
    const rules = [{ uid: 'r-1' }] as unknown as WorkspaceSnapshot['rules'];
    const snap = makeSnapshot({
      layoutState: [{ layout: { panes: [] } } as unknown as WorkspaceSnapshot['layoutState'][number]],
      rules,
    });
    const redacted = redactHostLocalSnapshotKeys(snap);
    expect(redacted.layoutState).toEqual([]);
    expect(redacted.rules).toBe(rules);
  });

  it('does not mutate the input', () => {
    const snap = makeSnapshot({
      layoutState: [{ layout: {} } as unknown as WorkspaceSnapshot['layoutState'][number]],
    });
    const before = JSON.parse(JSON.stringify(snap));
    redactHostLocalSnapshotKeys(snap);
    expect(snap).toEqual(before);
  });
});

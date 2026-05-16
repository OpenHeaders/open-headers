import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  MIN_SNAPSHOT_SCHEMA_VERSION,
  SENSITIVE_SNAPSHOT_KEYS,
  SNAPSHOT_SCHEMA_VERSION,
  SYNC_SNAPSHOT_TYPE,
  SyncSnapshotMessageSchema,
  WorkspaceSnapshotSchema,
  redactSensitiveSnapshotKeys,
  type WorkspaceSnapshot,
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
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
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

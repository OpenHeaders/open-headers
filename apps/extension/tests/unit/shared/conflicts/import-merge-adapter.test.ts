import { describe, expect, it, vi } from 'vitest';
import {
  type ImportBundleEntity,
  type ImportWorkspaceSnapshot,
  buildImportMergeSession,
} from '@/shared/conflicts/import-merge-adapter';

interface FakeRule {
  uid: string;
  name: string;
}

const ruleA: ImportBundleEntity = {
  uid: 'rule-a',
  entityType: 'rules',
  path: 'rules/openheaders.io/auth-header.yaml',
  entity: { uid: 'rule-a', name: 'Auth header' } as FakeRule,
};

const ruleB: ImportBundleEntity = {
  uid: 'rule-b',
  entityType: 'rules',
  path: 'rules/openheaders.io/cors.yaml',
  entity: { uid: 'rule-b', name: 'CORS' } as FakeRule,
};

const envA: ImportBundleEntity = {
  uid: 'env-a',
  entityType: 'environments',
  path: 'environments/staging.yaml',
  entity: { uid: 'env-a', name: 'Staging' },
};

function fakeSerialize(_type: string, entity: unknown): string {
  return JSON.stringify(entity);
}

function fakeDeserialize(_type: string, text: string): unknown {
  return JSON.parse(text);
}

function snapshotWith(entries: Array<[string, unknown | undefined]>): ImportWorkspaceSnapshot {
  const map = new Map<string, unknown>();
  for (const [uid, entity] of entries) if (entity !== undefined) map.set(uid, entity);
  return {
    findByPathOrUid(incoming) {
      return map.get(incoming.uid);
    },
  };
}

describe('buildImportMergeSession', () => {
  it('renders pure add as 2-pane (kind=add, base undefined, mine empty, initialResult=incoming)', () => {
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(session.files).toHaveLength(1);
    const f = session.files[0];
    expect(f.kind).toBe('add');
    expect(f.base).toBeUndefined();
    expect(f.theirs).toBe(fakeSerialize('rules', ruleA.entity));
    expect(f.mine).toBe('');
    expect(f.initialResult).toBe(f.theirs);
    expect(f.group).toBe('rules');
    expect(f.badges?.[0].tone).toBe('success');
  });

  it('renders collision with snapshot as 3-pane (base=snapshot, theirs=incoming, mine=existing)', () => {
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([['rule-a', { uid: 'rule-a', name: 'Auth header (local)' }]]),
      lastImportedSnapshots: new Map([['rule-a', '{"uid":"rule-a","name":"Auth header (snapshot)"}']]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel: vi.fn(),
    });
    const f = session.files[0];
    expect(f.kind).toBe('modify');
    expect(f.base).toBe('{"uid":"rule-a","name":"Auth header (snapshot)"}');
    expect(f.theirs).toBe(fakeSerialize('rules', ruleA.entity));
    expect(f.mine).toBe(fakeSerialize('rules', { uid: 'rule-a', name: 'Auth header (local)' }));
    expect(f.initialResult).toBe(f.mine);
    expect(f.badges?.[0].tone).toBe('warn');
  });

  it('renders collision without snapshot as 2-pane (base undefined, no fabricated ancestor)', () => {
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([['rule-a', { uid: 'rule-a', name: 'Auth header (local)' }]]),
      // no lastImportedSnapshots
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel: vi.fn(),
    });
    const f = session.files[0];
    expect(f.kind).toBe('modify');
    expect(f.base).toBeUndefined();
    expect(f.mine).toBe(fakeSerialize('rules', { uid: 'rule-a', name: 'Auth header (local)' }));
  });

  it('groups files by entityType in MergeFile.group', () => {
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA, ruleB, envA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(session.files.map((f) => f.group)).toEqual(['rules', 'rules', 'environments']);
  });

  it('title pluralizes by file count', () => {
    const single = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(single.title).toBe('Import — 1 item');
    const multi = buildImportMergeSession({
      bundle: { entities: [ruleA, ruleB] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(multi.title).toBe('Import — 2 items');
  });

  it('Apply create routes through applyEntity with parsed entity', async () => {
    const applyEntity = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const finalText = '{"uid":"rule-a","name":"Auth header"}';
    const outcomes = await session.onApply(session.files, new Map([['rule-a', finalText]]));
    expect(outcomes).toEqual([{ fileId: 'rule-a', ok: true, status: 'resolved' }]);
    expect(applyEntity).toHaveBeenCalledWith('rules', 'create', { uid: 'rule-a', name: 'Auth header' });
  });

  it('Apply update routes through applyEntity with op=update for collisions', async () => {
    const applyEntity = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([['rule-a', { uid: 'rule-a', name: 'Auth header (local)' }]]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    await session.onApply(session.files, new Map([['rule-a', '{"uid":"rule-a","name":"Merged"}']]));
    expect(applyEntity).toHaveBeenCalledWith('rules', 'update', { uid: 'rule-a', name: 'Merged' });
  });

  it('Apply with empty result on add-row routes through applyEntity skip', async () => {
    const applyEntity = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(session.files, new Map([['rule-a', '   \n  ']]));
    expect(outcomes).toEqual([{ fileId: 'rule-a', ok: true, status: 'resolved' }]);
    expect(applyEntity).toHaveBeenCalledWith('rules', 'skip', null);
  });

  it('Files with no result entry surface as unresolved (no applyEntity call)', async () => {
    const applyEntity = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(session.files, new Map());
    expect(outcomes).toEqual([{ fileId: 'rule-a', ok: true, status: 'unresolved' }]);
    expect(applyEntity).not.toHaveBeenCalled();
  });

  it('Deserialize errors are coerced into MergeApplyOutcome.error', async () => {
    const applyEntity = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([['rule-a', { uid: 'rule-a', name: 'X' }]]),
      serializeYaml: fakeSerialize,
      deserializeYaml: () => {
        throw new Error('bad yaml at line 3');
      },
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(session.files, new Map([['rule-a', 'malformed']]));
    expect(outcomes[0]).toMatchObject({ fileId: 'rule-a', ok: false, status: 'resolved', error: 'bad yaml at line 3' });
    expect(applyEntity).not.toHaveBeenCalled();
  });

  it('applyEntity errors surface with their message', async () => {
    const applyEntity = vi.fn().mockRejectedValueOnce(new Error('write failed'));
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(
      session.files,
      new Map([['rule-a', '{"uid":"rule-a","name":"Auth header"}']]),
    );
    expect(outcomes[0]).toMatchObject({ fileId: 'rule-a', ok: false, error: 'write failed' });
  });

  it('Non-Error throws are coerced via String(err)', async () => {
    const applyEntity = vi.fn().mockImplementationOnce(() => {
      throw 'string error';
    });
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(
      session.files,
      new Map([['rule-a', '{"uid":"rule-a","name":"Auth header"}']]),
    );
    expect(outcomes[0]).toMatchObject({ fileId: 'rule-a', ok: false, error: 'string error' });
  });

  it('Skip apply errors are also coerced into outcome.error', async () => {
    const applyEntity = vi.fn().mockRejectedValueOnce(new Error('skip rejected'));
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(session.files, new Map([['rule-a', '']]));
    expect(outcomes[0]).toMatchObject({ fileId: 'rule-a', ok: false, error: 'skip rejected' });
  });

  it('Mixed bundle: each file applies under its own outcome', async () => {
    const applyEntity = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [ruleA, ruleB, envA] },
      workspace: snapshotWith([['rule-b', { uid: 'rule-b', name: 'CORS (local)' }]]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity,
      onCancel: vi.fn(),
    });
    const outcomes = await session.onApply(
      session.files,
      new Map([
        ['rule-a', '{"uid":"rule-a","name":"Auth header"}'],
        ['rule-b', '{"uid":"rule-b","name":"Merged CORS"}'],
        // env-a left out -> unresolved
      ]),
    );
    expect(outcomes).toEqual([
      { fileId: 'rule-a', ok: true, status: 'resolved' },
      { fileId: 'rule-b', ok: true, status: 'resolved' },
      { fileId: 'env-a', ok: true, status: 'unresolved' },
    ]);
    expect(applyEntity).toHaveBeenNthCalledWith(1, 'rules', 'create', { uid: 'rule-a', name: 'Auth header' });
    expect(applyEntity).toHaveBeenNthCalledWith(2, 'rules', 'update', { uid: 'rule-b', name: 'Merged CORS' });
  });

  it('onCancel is forwarded to the session unchanged', () => {
    const onCancel = vi.fn();
    const session = buildImportMergeSession({
      bundle: { entities: [] },
      workspace: snapshotWith([]),
      serializeYaml: fakeSerialize,
      deserializeYaml: fakeDeserialize,
      applyEntity: vi.fn(),
      onCancel,
    });
    session.onCancel();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

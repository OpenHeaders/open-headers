/**
 * Phase B — projector reads post-commit state for files envelopes and
 * returns null for non-matching envelopes / cold-oracle cases.
 */

import {
  addFileRef,
  type FileRefSlot,
  type MutationEnvelope,
  type MutatorContext,
  removeFileRef,
  RULE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { projectFilesPostState, projectFilesSingleton } from '@/background/sync/files-post-state';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { seedFiles } from '@/shared/sync/files-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const slot = (overrides: Partial<FileRefSlot> = {}): FileRefSlot => ({
  fileId: 'file:a',
  hash: 'sha256:a',
  filename: 'a.txt',
  mimeType: 'text/plain',
  size: 4,
  ...overrides,
});

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectFilesPostState', () => {
  it('returns post-state after seed + addFileRef', async () => {
    const oracle = newOracle();
    await oracle.apply(seedFiles([], ctx(1)), []);
    const intent = addFileRef(ctx(2), { ref: slot({ fileId: 'file:new' }) });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);

    const post = projectFilesPostState(oracle, intent.batch.mutations[0]);
    expect(post).not.toBeNull();
    expect(post?.refs.map((r) => r.fileId)).toEqual(['file:new']);
    expect(post?.fileIds).toEqual(['file:new']);
  });

  it('drops a fileId after removeFileRef', async () => {
    const oracle = newOracle();
    await oracle.apply(seedFiles([slot({ fileId: 'file:a' }), slot({ fileId: 'file:b', hash: 'sha256:b', filename: 'b.bin' })], ctx(1)), []);
    await oracle.apply(removeFileRef(ctx(2), { fileId: 'file:a' }).batch, []);
    const post = projectFilesSingleton(oracle);
    expect(post?.fileIds).toEqual(['file:b']);
  });

  it('keeps the latest payload on concurrent same-fileId adds (LWW)', async () => {
    const oracle = newOracle();
    await oracle.apply(seedFiles([], ctx(1)), []);
    await oracle.apply(addFileRef(ctx(2), { ref: slot({ fileId: 'f', filename: 'old.txt' }) }).batch, []);
    await oracle.apply(addFileRef(ctx(3), { ref: slot({ fileId: 'f', filename: 'new.txt' }) }).batch, []);
    const post = projectFilesSingleton(oracle);
    expect(post?.refs[0].filename).toBe('new.txt');
  });

  it('sorts refs deterministically by fileId', async () => {
    const oracle = newOracle();
    await oracle.apply(seedFiles([], ctx(1)), []);
    await oracle.apply(addFileRef(ctx(2), { ref: slot({ fileId: 'file:z' }) }).batch, []);
    await oracle.apply(addFileRef(ctx(3), { ref: slot({ fileId: 'file:a' }) }).batch, []);
    const post = projectFilesSingleton(oracle);
    expect(post?.fileIds).toEqual(['file:a', 'file:z']);
  });

  it('returns null for non-matching envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r', path: 'name', value: 'x' },
    };
    expect(projectFilesPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectFilesSingleton(oracle)).toBeNull();
  });
});

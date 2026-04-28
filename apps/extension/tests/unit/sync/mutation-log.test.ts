/**
 * Append-only contract for the in-memory MutationLog reference impl
 * (R5 test surface). The IDB-backed impl is exercised E2E since the
 * repo deliberately avoids a fake-indexeddb dependency.
 */

import type { MutationEnvelope } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';

const env = (id: string, ms: number, nodeId = 'n0'): MutationEnvelope => ({
  mutationId: id,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: id },
});

const collect = async (it: AsyncIterable<MutationEnvelope>): Promise<MutationEnvelope[]> => {
  const out: MutationEnvelope[] = [];
  for await (const e of it) out.push(e);
  return out;
};

describe('InMemoryMutationLog', () => {
  it('append + readSince(null) returns entries oldest-first by HLC', async () => {
    const log = new InMemoryMutationLog();
    await log.append(env('m1', 1_000));
    await log.append(env('m3', 3_000));
    await log.append(env('m2', 2_000));
    const all = await collect(log.readSince(null));
    expect(all.map((e) => e.mutationId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('append is idempotent on mutationId', async () => {
    const log = new InMemoryMutationLog();
    await log.append(env('m1', 1_000));
    await log.append(env('m1', 1_000));
    const all = await collect(log.readSince(null));
    expect(all).toHaveLength(1);
    expect(await log.hasMutation('m1')).toBe(true);
  });

  it('readSince filters by HLC string codec watermark', async () => {
    const log = new InMemoryMutationLog();
    await log.append(env('m1', 1_000));
    await log.append(env('m2', 2_000));
    const allKeys = await collect(log.readSince(null));
    const watermark = (await import('@openheaders/core/sync')).hlcToString(allKeys[0].hlc);
    const after = await collect(log.readSince(watermark));
    expect(after.map((e) => e.mutationId)).toEqual(['m2']);
  });

  it('truncateBefore drops earlier entries and forgets their dedup ids', async () => {
    const log = new InMemoryMutationLog();
    await log.append(env('m1', 1_000));
    await log.append(env('m2', 2_000));
    const all = await collect(log.readSince(null));
    const middleKey = (await import('@openheaders/core/sync')).hlcToString(all[1].hlc);
    await log.truncateBefore(middleKey);
    const remaining = await collect(log.readSince(null));
    expect(remaining.map((e) => e.mutationId)).toEqual(['m2']);
    expect(await log.hasMutation('m1')).toBe(false);
  });
});

/**
 * Coverage for the three-way patch (`workspace-tree/three-way-patch.ts`)
 * — one change laid over a value that moved on its own.
 *
 * The load-bearing properties:
 *   - a key the change did not touch keeps the current value, whatever
 *     the current side did to it;
 *   - a list of identified members is patched member by member, so the
 *     current side's own rows survive the change's adds, removes, edits
 *     and reorders;
 *   - a value both sides changed takes the change's value and is
 *     counted — nothing is merged textually and nothing throws.
 */

import { describe, expect, it } from 'vitest';
import { type PatchTally, patchRecord } from '../../src/workspace-tree/three-way-patch';

const NO_SKIP: ReadonlySet<string> = new Set();

function patch<T extends Record<string, unknown>>(current: T, from: T | undefined, to: T, skip = NO_SKIP) {
  const tally: PatchTally = { overridden: 0 };
  return { value: patchRecord(current, from, to, skip, tally), overridden: tally.overridden };
}

const header = (uid: string, value: string, extra: Record<string, unknown> = {}) => ({
  uid,
  key: `X-${uid}`,
  value,
  ...extra,
});

describe('patchRecord — keys', () => {
  it('takes the keys the change touched and leaves the rest as the current side has them', () => {
    const from = { name: 'Probe', url: 'https://api.openheaders.io/status', method: 'GET' };
    const to = { ...from, url: 'https://api.openheaders.io/v2/status' };
    const current = { ...from, name: 'Status Probe v2' };
    expect(patch(current, from, to)).toEqual({
      value: { name: 'Status Probe v2', url: 'https://api.openheaders.io/v2/status', method: 'GET' },
      overridden: 0,
    });
  });

  it('a key the change removed leaves; a key it added lands', () => {
    const from: Record<string, unknown> = { name: 'Probe', description: 'old' };
    const to: Record<string, unknown> = { name: 'Probe', timeoutMs: 500 };
    const current: Record<string, unknown> = { name: 'Probe', description: 'old', enabled: false };
    expect(patch(current, from, to).value).toEqual({ name: 'Probe', enabled: false, timeoutMs: 500 });
  });

  it('a value both sides changed takes the change and is counted once', () => {
    const from = { name: 'Probe', method: 'GET' };
    const to = { name: 'Probe (picked)', method: 'GET' };
    const current = { name: 'Probe (local)', method: 'POST' };
    expect(patch(current, from, to)).toEqual({
      value: { name: 'Probe (picked)', method: 'POST' },
      overridden: 1,
    });
  });

  it('both sides arriving at the same value is not counted', () => {
    const from = { name: 'Probe' };
    const to = { name: 'Health' };
    expect(patch({ name: 'Health' }, from, to)).toEqual({ value: { name: 'Health' }, overridden: 0 });
  });

  it('a nested record the change touched is taken whole', () => {
    const from = { auth: { type: 'none' } as Record<string, unknown> };
    const to = { auth: { type: 'bearer', token: '{{TOKEN}}' } as Record<string, unknown> };
    const current = { auth: { type: 'basic', username: 'john', password: 'x' } as Record<string, unknown> };
    expect(patch(current, from, to)).toEqual({
      value: { auth: { type: 'bearer', token: '{{TOKEN}}' } },
      overridden: 1,
    });
  });

  it('a skipped key is never written', () => {
    const from = { uid: 'a', path: 'requests/old' };
    const to = { uid: 'a', path: 'requests/new' };
    const current = { uid: 'a', path: 'requests/mine' };
    expect(patch(current, from, to, new Set(['path'])).value).toEqual(current);
  });

  it('a record the change created is its own, key by key, over what the current side holds', () => {
    const to = { name: 'Probe', method: 'GET' };
    const current = { name: 'Probe', method: 'POST', enabled: true };
    expect(patch<Record<string, unknown>>(current, undefined, to)).toEqual({
      value: { name: 'Probe', method: 'GET', enabled: true },
      overridden: 1,
    });
  });
});

describe('patchRecord — lists of identified members', () => {
  it('an edited row takes the edit while the current side keeps its own rows', () => {
    const from = { headers: [header('h1', 'probe-two')] };
    const to = { headers: [header('h1', 'probe-auth')] };
    const current = { headers: [header('h1', 'probe-two'), header('mine', 'local')] };
    expect(patch(current, from, to)).toEqual({
      value: { headers: [header('h1', 'probe-auth'), header('mine', 'local')] },
      overridden: 0,
    });
  });

  it('a row edited on both sides in different keys keeps both edits', () => {
    const from = { headers: [header('h1', 'one', { enabled: true })] };
    const to = { headers: [header('h1', 'two', { enabled: true })] };
    const current = { headers: [header('h1', 'one', { enabled: false })] };
    expect(patch(current, from, to)).toEqual({
      value: { headers: [header('h1', 'two', { enabled: false })] },
      overridden: 0,
    });
  });

  it('a row edited on both sides in the same key takes the change and is counted', () => {
    const from = { headers: [header('h1', 'one')] };
    const to = { headers: [header('h1', 'two')] };
    const current = { headers: [header('h1', 'mine')] };
    expect(patch(current, from, to)).toEqual({ value: { headers: [header('h1', 'two')] }, overridden: 1 });
  });

  it('a row that drifted to another shape takes the edited row whole', () => {
    const from = { parts: [{ uid: 'p1', kind: 'text', name: 'a', value: '1' }] as Record<string, unknown>[] };
    const to = { parts: [{ uid: 'p1', kind: 'text', name: 'a', value: '2' }] as Record<string, unknown>[] };
    const current = { parts: [{ uid: 'p1', kind: 'file', name: 'a', files: [] }] as Record<string, unknown>[] };
    expect(patch(current, from, to)).toEqual({
      value: { parts: [{ uid: 'p1', kind: 'text', name: 'a', value: '2' }] },
      overridden: 1,
    });
  });

  it('a removed row leaves; removing a row the current side edited is counted', () => {
    const from = { headers: [header('h1', 'one'), header('h2', 'two')] };
    const to = { headers: [header('h2', 'two')] };
    expect(patch({ headers: [header('h1', 'one'), header('h2', 'two'), header('mine', 'x')] }, from, to)).toEqual({
      value: { headers: [header('h2', 'two'), header('mine', 'x')] },
      overridden: 0,
    });
    expect(patch({ headers: [header('h1', 'edited'), header('h2', 'two')] }, from, to)).toEqual({
      value: { headers: [header('h2', 'two')] },
      overridden: 1,
    });
  });

  it('an added row lands after the neighbour it follows in the change', () => {
    const from = { order: ['a', 'b', 'c'] };
    const to = { order: ['a', 'new', 'b', 'c'] };
    const current = { order: ['mine', 'a', 'b', 'c', 'tail'] };
    expect(patch(current, from, to).value).toEqual({ order: ['mine', 'a', 'new', 'b', 'c', 'tail'] });
  });

  it('an added first row lands before the neighbour it precedes; with no neighbour left, at the end', () => {
    const from = { order: ['a', 'b'] };
    const to = { order: ['new', 'a', 'b'] };
    expect(patch({ order: ['mine', 'a', 'b'] }, from, to).value).toEqual({ order: ['mine', 'new', 'a', 'b'] });
    expect(patch({ order: ['mine'] }, from, to).value).toEqual({ order: ['mine', 'new'] });
  });

  it('two rows added side by side keep their order', () => {
    const from = { order: ['a'] };
    const to = { order: ['a', 'n1', 'n2'] };
    expect(patch({ order: ['a', 'mine'] }, from, to).value).toEqual({ order: ['a', 'n1', 'n2', 'mine'] });
  });

  it('a reorder is replayed over the members both sides know, in the places they hold', () => {
    const from = { order: ['a', 'b', 'c'] };
    const to = { order: ['c', 'a', 'b'] };
    const current = { order: ['a', 'mine', 'b', 'c'] };
    expect(patch(current, from, to).value).toEqual({ order: ['c', 'mine', 'a', 'b'] });
  });

  it('a change that kept the order leaves the current side its own order', () => {
    const from = { headers: [header('h1', 'one'), header('h2', 'two')] };
    const to = { headers: [header('h1', 'one'), header('h2', 'changed')] };
    const current = { headers: [header('h2', 'two'), header('h1', 'one')] };
    expect(patch(current, from, to).value).toEqual({ headers: [header('h2', 'changed'), header('h1', 'one')] });
  });

  it('a list with no identity is taken whole', () => {
    const from = { codes: [200, 201] };
    const to = { codes: [200, 204] };
    expect(patch({ codes: [200, 201, 202] }, from, to)).toEqual({ value: { codes: [200, 204] }, overridden: 1 });
  });

  it('a list the change added to a record that has none lands whole', () => {
    const from: Record<string, unknown> = { name: 'Probe' };
    const to: Record<string, unknown> = { name: 'Probe', headers: [header('h1', 'one')] };
    expect(patch({ name: 'Probe' } as Record<string, unknown>, from, to).value).toEqual(to);
  });
});

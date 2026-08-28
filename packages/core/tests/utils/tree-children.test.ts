/**
 * Ordered children — slotted runs in slot order, slot-less children
 * after them by stored path, never a slot required on read.
 */

import { describe, expect, it } from 'vitest';
import { indexTreeChildren, orderedChildren } from '../../src/utils/tree-children';

interface Node {
  uid: string;
  path: string;
}

const node = (uid: string, path: string): Node => ({ uid, path });

const folders = [
  node('fol00001', 'rules/col00001/a-fol00001'),
  node('fol00002', 'rules/col00001/b-fol00002'),
  node('fol00003', 'rules/col00001/a-fol00001/c-fol00003'),
];
const leaves = [
  node('rul00001', 'rules/col00001/one-rul00001'),
  node('rul00002', 'rules/col00001/two-rul00002'),
  node('rul00003', 'rules/col00001/a-fol00001/three-rul00003'),
  node('rul00004', 'rules/col00001/four-rul00004'),
];
const index = indexTreeChildren(
  folders,
  leaves,
  (f) => f.path,
  (l) => l.path,
);

describe('orderedChildren', () => {
  it('reads by stored path when the reader has no slots', () => {
    const out = orderedChildren(index, 'rules/col00001', null);
    expect(out.folders.map((f) => f.uid)).toEqual(['fol00001', 'fol00002']);
    expect(out.leaves.map((l) => l.uid)).toEqual(['rul00001', 'rul00002', 'rul00004']);
  });

  it('follows slot order and appends slot-less children by path', () => {
    const out = orderedChildren(index, 'rules/col00001', {
      folders: ['fol00002', 'fol00001'],
      items: ['rul00004', 'rul00001'],
    });
    expect(out.folders.map((f) => f.uid)).toEqual(['fol00002', 'fol00001']);
    expect(out.leaves.map((l) => l.uid)).toEqual(['rul00004', 'rul00001', 'rul00002']);
  });

  it('skips slots whose child is unknown and never emits a child twice', () => {
    const out = orderedChildren(index, 'rules/col00001', {
      folders: ['fol0dead', 'fol00001', 'fol00001'],
      items: ['rul0dead', 'rul00002', 'rul00002'],
    });
    expect(out.folders.map((f) => f.uid)).toEqual(['fol00001', 'fol00002']);
    expect(out.leaves.map((l) => l.uid)).toEqual(['rul00002', 'rul00001', 'rul00004']);
  });

  it('answers nested containers from the same index', () => {
    const out = orderedChildren(index, 'rules/col00001/a-fol00001', { folders: [], items: ['rul00003'] });
    expect(out.folders.map((f) => f.uid)).toEqual(['fol00003']);
    expect(out.leaves.map((l) => l.uid)).toEqual(['rul00003']);
  });
});

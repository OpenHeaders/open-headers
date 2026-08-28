/**
 * Leaf `path` projection — parent path + frozen segment when a live
 * slot resolved, the stored scalar otherwise (the mixed-fleet net).
 */

import { describe, expect, it } from 'vitest';
import { projectLeafPath } from '../../src/sync-builders/projections/leaf-path';

describe('projectLeafPath', () => {
  it('composes the parent path with the frozen pathSegment', () => {
    const data = { path: 'rules/old-col00001/probe-rul00001', pathSegment: 'probe-rul00001' };
    expect(projectLeafPath(data, 'rules/new-col00002/sub-fol00001')).toBe(
      'rules/new-col00002/sub-fol00001/probe-rul00001',
    );
  });

  it('keeps the stored path when no parent resolved', () => {
    const data = { path: 'rules/old-col00001/probe-rul00001', pathSegment: 'probe-rul00001' };
    expect(projectLeafPath(data, null)).toBe('rules/old-col00001/probe-rul00001');
  });

  it('borrows the stored path tail for an old-client leaf without a segment', () => {
    const data = { path: 'rules/old-col00001/probe-rul00001' };
    expect(projectLeafPath(data, 'rules/new-col00002')).toBe('rules/new-col00002/probe-rul00001');
  });

  it('keeps an empty stored path when nothing can be derived', () => {
    expect(projectLeafPath({ path: '' }, 'rules/new-col00002')).toBe('');
    expect(projectLeafPath({}, null)).toBe('');
  });
});

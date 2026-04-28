import { describe, expect, it } from 'vitest';
import type { HLC } from '../../../src/sync';
import { advanceHlc, compareHlc, initialHlc } from '../../../src/sync';

describe('advanceHlc', () => {
  it('returns strictly greater than local', () => {
    const local: HLC = initialHlc('a', 100);
    const next = advanceHlc(local, 100);
    expect(compareHlc(next, local)).toBeGreaterThan(0);
  });

  it('bumps logical when wall clock has not advanced', () => {
    const local: HLC = { physicalMs: 100, logical: 0, nodeId: 'a' };
    const next = advanceHlc(local, 100);
    expect(next.physicalMs).toBe(100);
    expect(next.logical).toBe(1);
  });

  it('resets logical when wall clock has advanced', () => {
    const local: HLC = { physicalMs: 100, logical: 5, nodeId: 'a' };
    const next = advanceHlc(local, 200);
    expect(next.physicalMs).toBe(200);
    expect(next.logical).toBe(0);
  });

  it('absorbs an observed remote HLC ahead in physical', () => {
    const local: HLC = { physicalMs: 100, logical: 0, nodeId: 'a' };
    const remote: HLC = { physicalMs: 500, logical: 7, nodeId: 'b' };
    const next = advanceHlc(local, 100, remote);
    expect(next.physicalMs).toBe(500);
    expect(next.logical).toBe(8);
    expect(next.nodeId).toBe('a');
  });

  it('breaks ties when local, remote, and wall share a physical tick', () => {
    const local: HLC = { physicalMs: 100, logical: 3, nodeId: 'a' };
    const remote: HLC = { physicalMs: 100, logical: 5, nodeId: 'b' };
    const next = advanceHlc(local, 100, remote);
    expect(next.physicalMs).toBe(100);
    expect(next.logical).toBe(6);
  });

  it('strictly greater than observed even when observed leads', () => {
    const local: HLC = { physicalMs: 50, logical: 0, nodeId: 'a' };
    const remote: HLC = { physicalMs: 1000, logical: 9, nodeId: 'b' };
    const next = advanceHlc(local, 60, remote);
    expect(compareHlc(next, remote)).toBeGreaterThan(0);
  });
});

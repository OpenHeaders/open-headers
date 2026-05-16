import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { HlcSchema } from '../../../src/sync';

describe('HlcSchema', () => {
  it('accepts a well-formed HLC', () => {
    const parsed = v.parse(HlcSchema, { physicalMs: 1700000000000, logical: 0, nodeId: 'sw-openheaders' });
    expect(parsed).toEqual({ physicalMs: 1700000000000, logical: 0, nodeId: 'sw-openheaders' });
  });

  it('rejects negative physicalMs', () => {
    expect(() => v.parse(HlcSchema, { physicalMs: -1, logical: 0, nodeId: 'a' })).toThrow();
  });

  it('rejects non-integer logical', () => {
    expect(() => v.parse(HlcSchema, { physicalMs: 1, logical: 0.5, nodeId: 'a' })).toThrow();
  });

  it('rejects empty nodeId', () => {
    expect(() => v.parse(HlcSchema, { physicalMs: 1, logical: 0, nodeId: '' })).toThrow();
  });
});

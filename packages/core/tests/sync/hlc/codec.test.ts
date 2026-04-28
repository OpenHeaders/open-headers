import { describe, expect, it } from 'vitest';
import type { HLC } from '../../../src/sync';
import { compareHlc, hlcToString, parseHlc } from '../../../src/sync';

describe('hlcToString / parseHlc', () => {
  it('round-trips', () => {
    const hlc: HLC = { physicalMs: 1_700_000_000_000, logical: 42, nodeId: 'node-x' };
    expect(parseHlc(hlcToString(hlc))).toEqual(hlc);
  });

  it('lex order matches numeric compareHlc', () => {
    const samples: HLC[] = [];
    for (let i = 0; i < 200; i += 1) {
      samples.push({
        physicalMs: Math.floor(Math.random() * 1_000_000),
        logical: Math.floor(Math.random() * 100),
        nodeId: ['aa', 'ab', 'b', 'zzz'][Math.floor(Math.random() * 4)],
      });
    }
    const byNumeric = [...samples].sort(compareHlc);
    const byLex = [...samples].sort((a, b) => {
      const sa = hlcToString(a);
      const sb = hlcToString(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    expect(byLex).toEqual(byNumeric);
  });

  it('rejects malformed strings', () => {
    expect(() => parseHlc('not-an-hlc')).toThrow();
    expect(() => parseHlc('123-')).toThrow();
  });
});

import { lookupOriginalPosition, parseSourceMap } from '@openheaders/ui/panel/data/initiator/source-map';
import { describe, expect, it } from 'vitest';

describe('parseSourceMap', () => {
  it('returns null for non-JSON input', () => {
    expect(parseSourceMap('not json')).toBeNull();
  });

  it('returns null when mappings field is missing', () => {
    expect(parseSourceMap(JSON.stringify({ version: 3, sources: [], names: [] }))).toBeNull();
  });

  it('returns null for indexed (sectioned) source maps', () => {
    expect(parseSourceMap(JSON.stringify({ version: 3, sections: [] }))).toBeNull();
  });

  it('strips XSSI prefix before JSON parsing', () => {
    const map = parseSourceMap(`)]}'\n${JSON.stringify({ version: 3, sources: [], names: [], mappings: '' })}`);
    expect(map).not.toBeNull();
  });

  it('splits mappings into raw lines without decoding them', () => {
    const map = parseSourceMap(JSON.stringify({ version: 3, sources: [], names: [], mappings: 'AAAA;CADC;EAEE' }));
    expect(map!.rawLines).toEqual(['AAAA', 'CADC', 'EAEE']);
    expect(map!.decodedLines.size).toBe(0);
  });
});

describe('lookupOriginalPosition', () => {
  // Constructed map:
  //   Generated line 0 ("AAAA") → single segment at genCol=0 mapping to
  //     sources[0], origLine=0, origCol=0, no name.
  //   Generated line 1 ("AACA,EAAEA") → two segments:
  //     genCol=0 → orig (0, 1, 0), name idx undefined
  //     genCol=2 → orig (0, 1, 2), name idx 0 ("handleClick")
  const fixture = parseSourceMap(
    JSON.stringify({
      version: 3,
      sources: ['app.ts'],
      names: ['handleClick'],
      mappings: 'AAAA;AACA,EAAEA',
    }),
  )!;

  it('looks up a position on line 0', () => {
    const pos = lookupOriginalPosition(fixture, 0, 5);
    expect(pos?.source).toBe('app.ts');
    expect(pos?.line).toBe(0);
    expect(pos?.column).toBe(0);
    expect(pos?.name).toBeNull();
  });

  it('returns the original name when the segment carries a nameIdx', () => {
    const pos = lookupOriginalPosition(fixture, 1, 3);
    expect(pos?.name).toBe('handleClick');
  });

  it('returns null when the line is out of range', () => {
    expect(lookupOriginalPosition(fixture, 99, 0)).toBeNull();
  });

  it('selects the largest segment ≤ the query column (not strict equality)', () => {
    // On line 1 with segments at genCol=0 and genCol=2, querying col=1
    // should land on the genCol=0 segment.
    const pos = lookupOriginalPosition(fixture, 1, 1);
    expect(pos?.line).toBe(1);
    expect(pos?.column).toBe(0);
    expect(pos?.name).toBeNull();
  });

  it('memoises decoded segments', () => {
    const map = parseSourceMap(JSON.stringify({ version: 3, sources: [], names: [], mappings: 'AAAA' }))!;
    expect(map.decodedLines.size).toBe(0);
    lookupOriginalPosition(map, 0, 0);
    expect(map.decodedLines.has(0)).toBe(true);
  });
});

import { buildResultView } from '@openheaders/ui/panel/data/search/search-display';
import type { SearchGroup, SearchMatch } from '@openheaders/ui/panel/data/search/search-engine';
import { describe, expect, it } from 'vitest';

function match(
  opts: Partial<SearchMatch> & Pick<SearchMatch, 'section' | 'lineNumber' | 'column' | 'sectionIndex'>,
): SearchMatch {
  return {
    lineText: opts.lineText ?? 'x',
    ...opts,
  };
}

function group(docId: string, matches: SearchMatch[], displayId = 1): SearchGroup {
  return {
    docId,
    source: 'network',
    target: { kind: 'request', requestId: docId },
    displayId,
    filename: `${docId}.txt`,
    origin: `origin/${docId}`,
    timestamp: 0,
    matches,
  };
}

describe('buildResultView', () => {
  it('returns empty view for no groups', () => {
    const view = buildResultView([]);
    expect(view.groups).toEqual([]);
    expect(view.flatRows).toEqual([]);
    expect(view.totalMatches).toBe(0);
    expect(view.totalFiles).toBe(0);
  });

  it('collapses adjacent same-line matches into a single row with an ordinal range', () => {
    // Two lines in one section: first has 3 matches, second has 1.
    const g = group('a', [
      match({ section: 'Response', lineNumber: 1, column: 9, sectionIndex: 0 }),
      match({ section: 'Response', lineNumber: 1, column: 25, sectionIndex: 1 }),
      match({ section: 'Response', lineNumber: 1, column: 42, sectionIndex: 2 }),
      match({ section: 'Response', lineNumber: 2, column: 7, sectionIndex: 3 }),
    ]);
    const view = buildResultView([g]);
    expect(view.groups).toHaveLength(1);
    const rows = view.groups[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ firstOrdinal: 1, lastOrdinal: 3, count: 3, lineNumber: 1, column: 9 });
    expect(rows[1]).toMatchObject({ firstOrdinal: 4, lastOrdinal: 4, count: 1, lineNumber: 2 });
  });

  it('does not coalesce matches across sections even when line numbers match', () => {
    const g = group('a', [
      match({ section: 'Request Headers', lineNumber: 1, column: 1, sectionIndex: 0 }),
      match({ section: 'Response Headers', lineNumber: 1, column: 1, sectionIndex: 0 }),
    ]);
    const view = buildResultView([g]);
    expect(view.groups[0].rows).toHaveLength(2);
    expect(view.groups[0].rows[0].section).toBe('Request Headers');
    expect(view.groups[0].rows[1].section).toBe('Response Headers');
  });

  it('keeps ordinals contiguous across groups — last row covers the last match', () => {
    const groups: SearchGroup[] = [
      group('a', [
        match({ section: 'Response', lineNumber: 1, column: 1, sectionIndex: 0 }),
        match({ section: 'Response', lineNumber: 1, column: 10, sectionIndex: 1 }),
      ]),
      group(
        'b',
        [
          match({ section: 'Response', lineNumber: 3, column: 1, sectionIndex: 0 }),
          match({ section: 'Response', lineNumber: 3, column: 8, sectionIndex: 1 }),
          match({ section: 'Response', lineNumber: 4, column: 1, sectionIndex: 2 }),
        ],
        2,
      ),
    ];
    const view = buildResultView(groups);

    // 5 matches total across both groups.
    expect(view.totalMatches).toBe(5);
    expect(view.totalFiles).toBe(2);

    // Group 1: one row covering matches 1-2.
    expect(view.groups[0].rows).toHaveLength(1);
    expect(view.groups[0].rows[0]).toMatchObject({ firstOrdinal: 1, lastOrdinal: 2 });

    // Group 2: rows covering matches 3-4 and match 5.
    expect(view.groups[1].rows).toHaveLength(2);
    expect(view.groups[1].rows[0]).toMatchObject({ firstOrdinal: 3, lastOrdinal: 4 });
    expect(view.groups[1].rows[1]).toMatchObject({ firstOrdinal: 5, lastOrdinal: 5 });

    // Invariant: last row's lastOrdinal === totalMatches.
    const lastGroup = view.groups[view.groups.length - 1];
    const lastRow = lastGroup.rows[lastGroup.rows.length - 1];
    expect(lastRow.lastOrdinal).toBe(view.totalMatches);
  });

  it('computes firstFlatIndex as a monotonic prefix sum of row counts', () => {
    const groups: SearchGroup[] = [
      group('a', [
        match({ section: 'Response', lineNumber: 1, column: 1, sectionIndex: 0 }),
        match({ section: 'Response', lineNumber: 2, column: 1, sectionIndex: 1 }),
      ]),
      group('b', [match({ section: 'Response', lineNumber: 1, column: 1, sectionIndex: 0 })]),
      group('c', [
        match({ section: 'Response', lineNumber: 1, column: 1, sectionIndex: 0 }),
        match({ section: 'Response', lineNumber: 2, column: 1, sectionIndex: 1 }),
        match({ section: 'Response', lineNumber: 3, column: 1, sectionIndex: 2 }),
      ]),
    ];
    const view = buildResultView(groups);
    // Row counts: 2, 1, 3 → cumulative 0, 2, 3.
    expect(view.groups.map((g) => g.firstFlatIndex)).toEqual([0, 2, 3]);
  });

  it('flatRows has one entry per display row, pointing back to the source group+row', () => {
    const groups: SearchGroup[] = [
      group('a', [
        match({ section: 'Response', lineNumber: 1, column: 1, sectionIndex: 0 }),
        match({ section: 'Response', lineNumber: 2, column: 1, sectionIndex: 1 }),
      ]),
      group('b', [match({ section: 'Response', lineNumber: 5, column: 1, sectionIndex: 0 })]),
    ];
    const view = buildResultView(groups);
    expect(view.flatRows).toHaveLength(3);
    expect(view.flatRows[0]).toEqual({ groupIndex: 0, rowIndex: 0 });
    expect(view.flatRows[1]).toEqual({ groupIndex: 0, rowIndex: 1 });
    expect(view.flatRows[2]).toEqual({ groupIndex: 1, rowIndex: 0 });
  });
});

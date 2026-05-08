import { describe, expect, it } from 'vitest';
import { decorateYamlForDiff } from '@/shared/conflicts/decorate-yaml';

describe('decorateYamlForDiff', () => {
  it('appends row uid trailers only on lines that have a duplicate sibling — leaves unique lines alone', () => {
    const yaml = [
      'requestHeaders:',
      '  - uid: aaaaaaaa',
      '    operation: override',
      '    headerName: x-debug-2',
      '    value: "3"',
      '  - uid: bbbbbbbb',
      '    operation: override',
      '    headerName: x-wat3',
      '    value: "3"',
      'responseHeaders: []',
    ].join('\n');

    const out = decorateYamlForDiff(yaml).split('\n');
    // Duplicate lines (`operation: override` x2, `value: "3"` x2) — decorated.
    expect(out[2]).toMatch(/# aaaaaaaa$/);
    expect(out[4]).toMatch(/# aaaaaaaa$/);
    expect(out[6]).toMatch(/# bbbbbbbb$/);
    expect(out[8]).toMatch(/# bbbbbbbb$/);
    // Unique lines (each `headerName` is distinct) — left clean.
    expect(out[3]).toBe('    headerName: x-debug-2');
    expect(out[7]).toBe('    headerName: x-wat3');
    // The two `value: "3"` lines are now distinct strings, so Monaco
    // can no longer cross-match them as identical.
    expect(out[4]).not.toBe(out[8]);
    expect(out[9]).toBe('responseHeaders: []');
  });

  it('leaves all per-row lines clean when nothing collides', () => {
    const yaml = [
      'requestHeaders:',
      '  - uid: aaaaaaaa',
      '    operation: override',
      '    headerName: x-1',
      '    value: "1"',
      '  - uid: bbbbbbbb',
      '    operation: add',
      '    headerName: x-2',
      '    value: "2"',
      'responseHeaders: []',
    ].join('\n');
    const out = decorateYamlForDiff(yaml).split('\n');
    // Unique lines stay untouched — most rule rows look like this and
    // the diff has no cross-match risk to mitigate.
    expect(out[3]).toBe('    headerName: x-1');
    expect(out[4]).toBe('    value: "1"');
    expect(out[7]).toBe('    headerName: x-2');
    expect(out[8]).toBe('    value: "2"');
  });

  it('does not double-tag lines that already carry a comment', () => {
    const yaml = ['  - uid: aaaaaaaa', '    value: "3"  # already-tagged'].join('\n');
    const out = decorateYamlForDiff(yaml).split('\n');
    expect(out[1]).toBe('    value: "3"  # already-tagged');
  });

  it('stops tagging at the row boundary (next array item or de-indent)', () => {
    // Two rows with a duplicated `value: "3"` line so the decoration
    // actually fires, then a top-level key that resets the row context.
    const yaml = [
      '  - uid: aaaaaaaa',
      '    value: "3"',
      '  - uid: bbbbbbbb',
      '    value: "3"',
      'responseHeaders: []',
    ].join('\n');
    const out = decorateYamlForDiff(yaml).split('\n');
    expect(out[1]).toMatch(/# aaaaaaaa$/);
    expect(out[3]).toMatch(/# bbbbbbbb$/);
    expect(out[4]).toBe('responseHeaders: []');
  });
});

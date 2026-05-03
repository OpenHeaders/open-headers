import { describe, expect, it } from 'vitest';
import { decorateYamlForDiff } from '@/shared/conflicts/decorate-yaml';

describe('decorateYamlForDiff', () => {
  it('appends row uid trailers so identical scalars from different rows stay distinct', () => {
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
    expect(out[2]).toMatch(/# aaaaaaaa$/);
    expect(out[3]).toMatch(/# aaaaaaaa$/);
    expect(out[4]).toMatch(/# aaaaaaaa$/);
    expect(out[6]).toMatch(/# bbbbbbbb$/);
    expect(out[7]).toMatch(/# bbbbbbbb$/);
    expect(out[8]).toMatch(/# bbbbbbbb$/);
    // The two `value: "3"` lines are now distinct strings, so Monaco
    // can no longer cross-match them as identical.
    expect(out[4]).not.toBe(out[8]);
    expect(out[9]).toBe('responseHeaders: []');
  });

  it('does not double-tag lines that already carry a comment', () => {
    const yaml = ['  - uid: aaaaaaaa', '    value: "3"  # already-tagged'].join('\n');
    const out = decorateYamlForDiff(yaml).split('\n');
    expect(out[1]).toBe('    value: "3"  # already-tagged');
  });

  it('stops tagging at the row boundary (next array item or de-indent)', () => {
    const yaml = [
      '  - uid: aaaaaaaa',
      '    value: "3"',
      'responseHeaders: []',
    ].join('\n');
    const out = decorateYamlForDiff(yaml).split('\n');
    expect(out[1]).toMatch(/# aaaaaaaa$/);
    expect(out[2]).toBe('responseHeaders: []');
  });
});

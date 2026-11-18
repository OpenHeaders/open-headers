/**
 * The rows the Git card lists of one binding: the last reading's, then
 * the last flush's — two feeds, each replaced by its own pass.
 */

import { describe, expect, it } from 'vitest';
import { bindingRows } from '../../src/workspace-tree/runtime/sweep';

const READ = { path: 'rules/broken-colbbbbb/_collection.yaml', message: 'name — Invalid type — skipped' };
const UNWRITTEN = { path: 'specs/', message: 'is a link — not written' };

describe('bindingRows', () => {
  it('says the reading’s rows, then the flush’s', () => {
    expect(bindingRows({ issues: [READ], unwritten: [UNWRITTEN] })).toEqual([READ, UNWRITTEN]);
    expect(bindingRows({ issues: [READ], unwritten: [] })).toEqual([READ]);
    expect(bindingRows({ issues: [], unwritten: [UNWRITTEN] })).toEqual([UNWRITTEN]);
  });

  it('a file both tell of has one row, the reading’s', () => {
    const skipped = { path: 'rules/a\\b/rule.yaml', message: '"\\" cannot be part of a path — skipped' };
    const notWritten = { path: skipped.path, message: '"\\" cannot be part of a path — not written' };
    expect(bindingRows({ issues: [skipped], unwritten: [notWritten, UNWRITTEN] })).toEqual([skipped, UNWRITTEN]);
  });
});

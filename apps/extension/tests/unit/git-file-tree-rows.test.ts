/**
 * The files tree's visible-row walk and its lead rules
 * (`file-tree.ts`): rows in paint order with collapsed subtrees left
 * out, the one file the pane's verbs act on after a gesture, and the
 * selected rows a single-row verb picks its target from.
 */

import {
  buildFileTree,
  leadFilePath,
  selectedRowsLeadFirst,
  visibleFileTreeRows,
} from '@openheaders/ui/workbench/components/panels/git/file-tree';
import { describe, expect, it } from 'vitest';

const FILES = [
  { path: 'docs/guides/auth.md', status: 'M' },
  { path: 'docs/guides/tokens.md', status: 'A' },
  { path: 'README.md', status: 'M' },
  { path: 'scripts/local.sh', status: 'D' },
];

describe('visibleFileTreeRows', () => {
  it('walks dirs then files in paint order with depth and parent', () => {
    const rows = visibleFileTreeRows(buildFileTree(FILES), new Set());
    expect(rows.map((row) => [row.key, row.kind, row.depth, row.parentKey])).toEqual([
      ['docs/guides', 'dir', 0, null],
      ['docs/guides/auth.md', 'file', 1, 'docs/guides'],
      ['docs/guides/tokens.md', 'file', 1, 'docs/guides'],
      ['scripts', 'dir', 0, null],
      ['scripts/local.sh', 'file', 1, 'scripts'],
      ['README.md', 'file', 0, null],
    ]);
    expect(rows[0].expanded).toBe(true);
    expect(rows[1].expanded).toBeUndefined();
  });

  it('leaves a collapsed dir’s subtree out and marks it closed', () => {
    const rows = visibleFileTreeRows(buildFileTree(FILES), new Set(['docs/guides']));
    expect(rows.map((row) => row.key)).toEqual(['docs/guides', 'scripts', 'scripts/local.sh', 'README.md']);
    expect(rows[0].expanded).toBe(false);
  });

  it('a flat tree is files only at depth zero', () => {
    const rows = visibleFileTreeRows(buildFileTree(FILES, false), new Set());
    expect(rows.every((row) => row.kind === 'file' && row.depth === 0 && row.parentKey === null)).toBe(true);
    expect(rows).toHaveLength(4);
  });
});

describe('leadFilePath', () => {
  const rows = visibleFileTreeRows(buildFileTree(FILES), new Set());

  it('prefers the gesture’s file while it is selected', () => {
    expect(leadFilePath(rows, new Set(['README.md', 'scripts/local.sh']), 'scripts/local.sh')).toBe('scripts/local.sh');
  });

  it('falls back to the first selected file in row order', () => {
    expect(leadFilePath(rows, new Set(['README.md', 'scripts/local.sh']), 'docs/guides/auth.md')).toBe(
      'scripts/local.sh',
    );
    expect(leadFilePath(rows, new Set(['README.md', 'docs/guides/tokens.md']), null)).toBe('docs/guides/tokens.md');
  });

  it('a dir is never the lead — a dir-only selection has no file', () => {
    expect(leadFilePath(rows, new Set(['docs/guides']), 'docs/guides')).toBeNull();
    expect(leadFilePath(rows, new Set(), null)).toBeNull();
  });
});

describe('selectedRowsLeadFirst', () => {
  const rows = visibleFileTreeRows(buildFileTree(FILES), new Set());
  const keys = (selected: string[], preferred: string | null): string[] =>
    selectedRowsLeadFirst(rows, new Set(selected), preferred).map((row) => row.key);

  it('lists the selected rows in row order, the gesture’s row first while it is one of them', () => {
    expect(keys(['README.md', 'docs/guides', 'scripts/local.sh'], 'scripts/local.sh')).toEqual([
      'scripts/local.sh',
      'docs/guides',
      'README.md',
    ]);
    expect(keys(['README.md', 'docs/guides'], 'docs/guides')).toEqual(['docs/guides', 'README.md']);
  });

  it('a gesture’s row that is not selected leads nothing', () => {
    expect(keys(['README.md', 'docs/guides'], 'scripts/local.sh')).toEqual(['docs/guides', 'README.md']);
    expect(keys([], 'README.md')).toEqual([]);
  });
});

/**
 * The order a merge session's files are listed in, and the file the
 * editor opens on: groups alphabetical, a group's files as the session
 * holds them, the first of those the open one.
 */

import { firstListedFile, groupFiles } from '@openheaders/ui/shared/merge-editor/file-groups';
import type { MergeFile } from '@openheaders/ui/shared/merge-editor/types';
import { describe, expect, it } from 'vitest';

const file = (id: string, group?: string): MergeFile => ({
  id,
  label: id.slice(id.lastIndexOf('/') + 1),
  ...(group !== undefined ? { group } : {}),
  kind: 'modify',
  theirs: '',
  mine: '',
  initialResult: '',
});

const REQUEST = file('requests/create-order/request.yaml', 'requests/create-order');
const BODY = file('requests/create-order/body.json', 'requests/create-order');
const ENVIRONMENT = file('environments/staging.yaml', 'environments');
const NOTES = file('notes/orders.md', 'notes');

describe('groupFiles', () => {
  it('lists groups alphabetically and keeps a group’s files in the session’s order', () => {
    expect(groupFiles([REQUEST, BODY, ENVIRONMENT, NOTES]).map((g) => [g.group, g.files.map((f) => f.label)])).toEqual([
      ['environments', ['staging.yaml']],
      ['notes', ['orders.md']],
      ['requests/create-order', ['request.yaml', 'body.json']],
    ]);
  });

  it('files that name no group share one, listed first', () => {
    const loose = file('README.md');
    expect(groupFiles([NOTES, loose]).map((g) => g.group)).toEqual(['', 'notes']);
  });
});

describe('firstListedFile', () => {
  it('is the top row of the list, not the session’s first file', () => {
    expect(firstListedFile([REQUEST, BODY, ENVIRONMENT, NOTES])).toBe(ENVIRONMENT);
  });

  it('is the only file of a one-file session, and null for none', () => {
    expect(firstListedFile([REQUEST])).toBe(REQUEST);
    expect(firstListedFile([])).toBeNull();
  });
});

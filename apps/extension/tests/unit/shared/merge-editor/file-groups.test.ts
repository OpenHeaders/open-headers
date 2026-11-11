/**
 * The order a merge session's files are listed in, and the file the
 * editor opens on: sections as the caller orders them (an unnamed or
 * unknown one last), a section's groups alphabetical, a group's files
 * as the session holds them, the first of those the open one.
 */

import { firstListedFile, listFiles, sectionFiles } from '@openheaders/ui/shared/merge-editor/file-groups';
import type { MergeFile } from '@openheaders/ui/shared/merge-editor/types';
import { describe, expect, it } from 'vitest';

const file = (id: string, group?: string, section?: string): MergeFile => ({
  id,
  label: id.slice(id.lastIndexOf('/') + 1),
  ...(group !== undefined ? { group } : {}),
  ...(section !== undefined ? { section } : {}),
  kind: 'modify',
  theirs: '',
  mine: '',
  initialResult: '',
});

const REQUEST = file('requests/col/create-order/request.yaml', 'col/create-order', 'api-requests');
const BODY = file('requests/col/create-order/body.json', 'col/create-order', 'api-requests');
const LIST = file('requests/col/a-list/request.yaml', 'col/a-list', 'api-requests');
const ENVIRONMENT = file('environments/staging.yaml', 'environments', 'variables');
const NOTES = file('notes/orders.md', 'notes', 'files');
const ORDER = ['api-requests', 'variables', 'files'];

const shape = (files: MergeFile[], order?: string[]) =>
  listFiles(files, order).map((s) => [s.section, s.groups.map((g) => [g.group, g.files.map((f) => f.label)])]);

describe('listFiles', () => {
  it('lists sections in the caller’s order, groups alphabetically, files as the session holds them', () => {
    expect(shape([NOTES, ENVIRONMENT, REQUEST, BODY, LIST], ORDER)).toEqual([
      [
        'api-requests',
        [
          ['col/a-list', ['request.yaml']],
          ['col/create-order', ['request.yaml', 'body.json']],
        ],
      ],
      ['variables', [['environments', ['staging.yaml']]]],
      ['files', [['notes', ['orders.md']]]],
    ]);
  });

  it('a section the caller does not name lists after the named ones, an unnamed file under none', () => {
    const loose = file('README.md');
    const odd = file('specs/orders/spec.yaml', 'specs/orders', 'specs');
    expect(listFiles([loose, odd, NOTES], ORDER).map((s) => s.section)).toEqual(['files', '', 'specs']);
  });

  it('a session that names no sections is one, grouped as before', () => {
    const a = file('b/one.yaml', 'b');
    const b = file('a/two.yaml', 'a');
    expect(shape([a, b])).toEqual([
      [
        '',
        [
          ['a', ['two.yaml']],
          ['b', ['one.yaml']],
        ],
      ],
    ]);
  });
});

describe('sectionFiles', () => {
  it('is a section’s files in listing order', () => {
    const [requests] = listFiles([REQUEST, BODY, LIST], ORDER);
    expect(sectionFiles(requests).map((f) => f.id)).toEqual([LIST.id, REQUEST.id, BODY.id]);
  });
});

describe('firstListedFile', () => {
  it('is the top row of the list, not the session’s first file', () => {
    expect(firstListedFile([NOTES, ENVIRONMENT, REQUEST, BODY, LIST], ORDER)).toBe(LIST);
  });

  it('is the only file of a one-file session, and null for none', () => {
    expect(firstListedFile([REQUEST])).toBe(REQUEST);
    expect(firstListedFile([])).toBeNull();
  });
});

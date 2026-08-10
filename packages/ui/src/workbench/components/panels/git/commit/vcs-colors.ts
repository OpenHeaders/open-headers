/**
 * vcs-colors — the Commit window's file-status palette, matched to the
 * IDE reference per theme: green for files added to VCS, blue for
 * modified (renames/copies ride the same tint), gray for deleted,
 * salmon for unversioned, olive for ignored. Pure lookup; the tree
 * resolves a row to one color through {@link vcsFileColor}.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';

export interface VcsPalette {
  added: string;
  modified: string;
  deleted: string;
  unversioned: string;
  ignored: string;
}

const DARK: VcsPalette = {
  added: '#6AAB73',
  modified: '#548AF7',
  deleted: '#6F737A',
  unversioned: '#E8927C',
  ignored: '#A9B837',
};

const LIGHT: VcsPalette = {
  added: '#0A7700',
  modified: '#0032A0',
  deleted: '#616161',
  unversioned: '#993300',
  ignored: '#727238',
};

export function vcsPalette(isDarkMode: boolean): VcsPalette {
  return isDarkMode ? DARK : LIGHT;
}

/** One row's filename color — flags first, then the merged status letter. */
export function vcsFileColor(row: WorkspaceTreeWorkingChangeWire, palette: VcsPalette): string {
  if (row.ignored) return palette.ignored;
  if (row.unversioned) return palette.unversioned;
  switch (row.status) {
    case 'A':
      return palette.added;
    case 'D':
      return palette.deleted;
    default:
      return palette.modified;
  }
}

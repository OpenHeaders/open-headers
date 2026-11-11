/**
 * The order a session's files are listed in: by group, the groups
 * alphabetical, a group's files as the session holds them. The file
 * rail renders this order and the modal opens on its first file, so the
 * open file is the rail's top row.
 */

import type { MergeFile } from './types';

export interface MergeFileGroup {
  /** `''` for files that name no group. */
  group: string;
  files: MergeFile[];
}

export function groupFiles(files: ReadonlyArray<MergeFile>): MergeFileGroup[] {
  const byGroup = new Map<string, MergeFile[]>();
  for (const file of files) {
    const key = file.group ?? '';
    const listed = byGroup.get(key);
    if (listed) listed.push(file);
    else byGroup.set(key, [file]);
  }
  return Array.from(byGroup.entries())
    .map(([group, listed]) => ({ group, files: listed }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

/** The file listed first; null for a session with no files. */
export function firstListedFile(files: ReadonlyArray<MergeFile>): MergeFile | null {
  return groupFiles(files)[0]?.files[0] ?? null;
}

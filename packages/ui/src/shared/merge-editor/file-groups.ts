/**
 * The order a session's files are listed in: by section, then by group,
 * then as the session holds them. Sections follow the order the caller
 * names them in (a file naming none, or one the caller does not know,
 * lists after them); a section's groups are alphabetical. The file rail
 * renders this order, the collapsed rail shows its sections, and the
 * modal opens on its first file, so the open file is the rail's top
 * row.
 */

import type { MergeFile } from './types';

export interface MergeFileGroup {
  /** `''` for files that name no group. */
  group: string;
  files: MergeFile[];
}

export interface MergeFileSection {
  /** `''` for files that name no section. */
  section: string;
  groups: MergeFileGroup[];
}

function groupsOf(files: ReadonlyArray<MergeFile>): MergeFileGroup[] {
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

export function listFiles(
  files: ReadonlyArray<MergeFile>,
  sectionOrder: ReadonlyArray<string> = [],
): MergeFileSection[] {
  const bySection = new Map<string, MergeFile[]>();
  for (const file of files) {
    const key = file.section ?? '';
    const listed = bySection.get(key);
    if (listed) listed.push(file);
    else bySection.set(key, [file]);
  }
  const rank = (section: string): number => {
    const at = sectionOrder.indexOf(section);
    return at === -1 ? sectionOrder.length : at;
  };
  return Array.from(bySection.entries())
    .map(([section, listed]) => ({ section, groups: groupsOf(listed) }))
    .sort((a, b) => rank(a.section) - rank(b.section) || a.section.localeCompare(b.section));
}

/** A section's files, in listing order. */
export function sectionFiles(section: MergeFileSection): MergeFile[] {
  return section.groups.flatMap((group) => group.files);
}

/** The file listed first; null for a session with no files. */
export function firstListedFile(
  files: ReadonlyArray<MergeFile>,
  sectionOrder: ReadonlyArray<string> = [],
): MergeFile | null {
  return listFiles(files, sectionOrder)[0]?.groups[0]?.files[0] ?? null;
}

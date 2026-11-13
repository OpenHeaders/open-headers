/**
 * commit-file-groups — a merge's files as the groups a changed-files
 * tree lists (the reference reading): what the merge itself settled —
 * the files that differ from every parent — first, then the change
 * against each parent in parent order, each read against that parent.
 * A group with no file is left out; a merge that settled nothing says
 * so in a line of its own (the caller's). Pure.
 */

import type { WorkspaceTreeCommitParentWire } from '@openheaders/core/bridge';

/** One changed path — the bridge re-exports the parent's record, not its file row. */
type ChangedFile = WorkspaceTreeCommitParentWire['files'][number];

/** The group of the files that differ from every parent. */
export const MERGED_FILES_GROUP = 'merged';

export type CommitFileGroup =
  | { kind: 'merged'; id: string; files: readonly ChangedFile[] }
  | {
      kind: 'parent';
      id: string;
      /** The parent's sha — what the group's diffs read against. */
      base: string;
      subject: string;
      files: readonly ChangedFile[];
    };

export function commitFileGroups(changes: {
  parents: readonly WorkspaceTreeCommitParentWire[];
  merged: readonly ChangedFile[];
}): CommitFileGroup[] {
  const groups: CommitFileGroup[] = [];
  if (changes.merged.length > 0) groups.push({ kind: 'merged', id: MERGED_FILES_GROUP, files: changes.merged });
  for (const parent of changes.parents) {
    if (parent.files.length === 0) continue;
    groups.push({ kind: 'parent', id: parent.sha, base: parent.sha, subject: parent.subject, files: parent.files });
  }
  return groups;
}

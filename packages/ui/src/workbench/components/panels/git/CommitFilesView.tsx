/**
 * CommitFilesView — what a pane lists for the commit it shows: the
 * changed-files tree (`FileTreeView`), and never an empty pane. A merge
 * lists no files in the log's own entry, so its files are read by
 * parent (`use-commit-parent-changes`) and listed in groups — what the
 * merge settled itself, then the change against each parent
 * (`commit-file-groups`) — with a line saying so when it settled
 * nothing. A commit, or a set of them, that changes no file says that.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { theme } from 'antd';
import { forwardRef, useMemo } from 'react';
import { commitFileGroups } from './commit-file-groups';
import FileTreeView from './FileTreeView';
import type { FileTreeGroup, FileTreeViewProps } from './file-tree-view-props';
import { useCommitParentChanges } from './use-commit-parent-changes';
import type { FileTreeViewHandle } from './use-file-tree-behaviour';

export interface CommitFilesViewProps extends Omit<FileTreeViewProps, 'groups' | 'groupsNote'> {
  /** The ONE commit the files are of — a merge's are listed by parent. Absent where they are of several. */
  commit?: { sha: string; parents: readonly string[] };
}

const SHORT_SHA = 8;

const CommitFilesView = forwardRef<FileTreeViewHandle, CommitFilesViewProps>(function CommitFilesView(
  { commit, ...tree },
  handleRef,
) {
  const t = useT();
  const { token } = theme.useToken();
  const merge = commit !== undefined && commit.parents.length >= 2 ? commit.sha : null;
  const changes = useCommitParentChanges(tree.workspaceId, merge);
  const groups = useMemo(
    () =>
      changes === undefined || changes === null
        ? null
        : commitFileGroups(changes).map(
            (group): FileTreeGroup =>
              group.kind === 'merged'
                ? { id: group.id, title: t('workbench.gitLog.parents.merged'), files: group.files }
                : {
                    id: group.id,
                    base: group.base,
                    title: t('workbench.gitLog.parents.changesTo', {
                      sha: group.base.slice(0, SHORT_SHA),
                      subject: group.subject,
                    }),
                    files: group.files,
                  },
          ),
    [changes, t],
  );

  // The read is out: nothing is claimed about the merge until it answers.
  if (changes === undefined) return <div style={{ flex: '1 1 55%', minHeight: 0 }} data-testid="git-tool-files-reading" />;
  if (groups !== null && changes !== null) {
    return (
      <FileTreeView
        {...tree}
        ref={handleRef}
        groups={groups}
        {...(changes.merged.length === 0 ? { groupsNote: t('workbench.gitLog.parents.noneMerged') } : {})}
      />
    );
  }
  if (tree.files.length === 0) {
    return (
      <div
        style={{
          flex: '1 1 55%',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: token.colorTextSecondary,
        }}
        data-testid="git-tool-files-none"
      >
        {t('workbench.gitLog.noFilesChanged')}
      </div>
    );
  }
  return <FileTreeView {...tree} ref={handleRef} />;
});

export default CommitFilesView;

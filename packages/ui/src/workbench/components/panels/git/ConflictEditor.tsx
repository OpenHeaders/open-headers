/**
 * ConflictEditor — the shared merge editor over the files of a
 * conflicted pass, listed as the workbench's own panels list what they
 * belong to: the strip's surfaces (`conflict-rail`), and beside it
 * every surface's sections, collections and entities (`ConflictTree`).
 * The session's files follow that listing, so the editor opens on its
 * top row.
 *
 * Mounted only while the editor is open — the workspace is read here,
 * not by every surface that can start a pass.
 */

import type { WorkspaceTreeApplyCommitConflictFileWire } from '@openheaders/core/bridge';
import { useUiTheme } from '@openheaders/ui/context';
import {
  buildCommitMergeSession,
  type CommitMergeAnswer,
  type CommitMergeApplyResult,
} from '@openheaders/ui/shared/conflicts/commit-merge-adapter';
import { MergeConflictModal, type MergeFilesPanelProps } from '@openheaders/ui/shared/merge-editor';
import { type ReactElement, type ReactNode, useCallback, useMemo } from 'react';
import ConflictTree from './ConflictTree';
import { useConflictRail } from './conflict-rail';
import { useConflictTree } from './use-conflict-tree';

export interface ConflictEditorProps {
  title: string;
  files: readonly WorkspaceTreeApplyCommitConflictFileWire[];
  /** Send the answers; resolves `ok` once the pass is over. */
  apply(answers: CommitMergeAnswer[]): Promise<CommitMergeApplyResult>;
  onCancel(): void;
  onClose(): void;
}

const ConflictEditor = ({ title, files, apply, onCancel, onClose }: ConflictEditorProps): ReactElement => {
  const { isDarkMode, monacoTheme } = useUiTheme();
  const rail = useConflictRail();
  const paths = useMemo(() => files.map((file) => file.path), [files]);
  const tree = useConflictTree(paths);

  const session = useMemo(() => {
    const byPath = new Map(files.map((file) => [file.path, file]));
    return buildCommitMergeSession({
      title,
      files: tree.order.flatMap((path) => byPath.get(path) ?? []),
      place: tree.place,
      apply,
      onCancel,
    });
  }, [title, files, tree, apply, onCancel]);

  const renderFiles = useCallback(
    (panel: MergeFilesPanelProps): ReactNode => <ConflictTree {...panel} tree={tree.sections} />,
    [tree.sections],
  );

  return (
    <MergeConflictModal
      open
      session={session}
      isDarkMode={isDarkMode}
      monacoTheme={monacoTheme}
      surfaceId="git"
      rail={rail}
      renderFiles={renderFiles}
      onClose={onClose}
    />
  );
};

export default ConflictEditor;

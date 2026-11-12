/**
 * ConflictFilesTree — the files of a conflicted pass as the step before
 * the editor names them: by what they belong to, in the tree the
 * editor's files panel draws (`ConflictTree`) — its sections, the
 * collections and entities by name, an entity's several files by part.
 * It names; a row opens nothing, and nothing is counted yet. Scrolls
 * past a handful of rows.
 *
 * Mounted only while the step is open — the workspace is read here.
 */

import type { MergeFile } from '@openheaders/ui/shared/merge-editor';
import { theme } from 'antd';
import type { ReactElement } from 'react';
import ConflictTree from './ConflictTree';
import { useConflictTree } from './use-conflict-tree';

export interface ConflictFilesTreeProps {
  /** The files both sides changed, at the branch's paths. */
  files: readonly string[];
  testId: string;
}

const NO_FILES: readonly MergeFile[] = [];
const noop = (): void => {};

const ConflictFilesTree = ({ files, testId }: ConflictFilesTreeProps): ReactElement => {
  const { token } = theme.useToken();
  const tree = useConflictTree(files);
  return (
    <div
      data-testid={testId}
      style={{ padding: '4px 0', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 4 }}
    >
      <ConflictTree tree={tree.sections} files={NO_FILES} activeFileId="" onSelect={noop} listing />
    </div>
  );
};

export default ConflictFilesTree;

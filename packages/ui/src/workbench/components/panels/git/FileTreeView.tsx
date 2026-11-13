/**
 * FileTreeView — the detail pane's changed-files tree, drawn one of two
 * ways. By what the files belong to in the workbench (Group By
 * Workspace — `NamedFileTree`): the panels' sections, collections and
 * entities by name. Or by path (`PathFileRows`): single-child dir
 * chains fold into one `a/b/c` node with an `N files` badge, or flat
 * full-path rows while Group By Directory is off, filenames behind the
 * Commit tree's file-type icon and colored by porcelain status.
 *
 * Either way the tree behaves the same (`use-file-tree-behaviour`):
 * with a selection handler wired (the log pane, the Push window) the
 * rows ride the shared selection model, the caret and a double-click
 * toggle a row that holds others, a double-click opens a file, the keys
 * walk and fold; the pane's verbs (Show Diff, Jump to Source, the row
 * menu) act on the ONE file the tree reports. Without a selection
 * handler (the compare pane) a click opens the diff directly and the
 * built-in header keeps the expand/collapse pair. Expand All / Collapse
 * All also arrive through the imperative handle when the toolbar lives
 * outside.
 *
 * Handed groups (a merge's files, by parent) it lists each under its
 * heading, drawn the same two ways (`GroupedFileTree`).
 */

import { type ForwardedRef, forwardRef, useCallback, useMemo } from 'react';
import FileTreeFrame from './FileTreeFrame';
import { allDirKeys, buildFileTree, visibleFileTreeRows } from './file-tree';
import type { FileTreeViewProps } from './file-tree-view-props';
import { PathGroupedFileTree, WorkspaceGroupedFileTree } from './GroupedFileTree';
import { WorkspaceFileTree } from './NamedFileTree';
import PathFileRows from './PathFileRows';
import { type FileTreeViewHandle, useFileTreeBehaviour } from './use-file-tree-behaviour';

export type { FileTreeViewProps } from './file-tree-view-props';
export type { FileTreeViewHandle } from './use-file-tree-behaviour';

const PathFileTree = ({
  files,
  loadingPath,
  onOpenFile,
  selectedPath,
  onSelectFile,
  groupByDirectory = true,
  showHeader = false,
  rowMenu,
  handleRef,
}: FileTreeViewProps & { handleRef: ForwardedRef<FileTreeViewHandle> }) => {
  const tree = useMemo(() => buildFileTree(files, groupByDirectory), [files, groupByDirectory]);
  const foldKeys = useMemo(() => allDirKeys(tree), [tree]);
  const rowsOf = useCallback((collapsed: ReadonlySet<string>) => visibleFileTreeRows(tree, collapsed), [tree]);
  const behaviour = useFileTreeBehaviour(
    {
      rowsOf,
      foldKeys,
      onOpenFile: (path) => onOpenFile(path),
      selectedPath,
      ...(onSelectFile === undefined ? {} : { onSelect: (file) => onSelectFile(file) }),
    },
    handleRef,
  );

  return (
    <FileTreeFrame
      containerRef={behaviour.containerRef}
      selectable={behaviour.selectable}
      showHeader={showHeader}
      onKeyDown={behaviour.onKeyDown}
      onExpandAll={behaviour.expandAll}
      onCollapseAll={behaviour.collapseAll}
    >
      <PathFileRows
        nodes={tree}
        scope={behaviour}
        loadingPath={loadingPath}
        rowMenu={rowMenu === undefined ? undefined : (path) => rowMenu(path)}
      />
    </FileTreeFrame>
  );
};

const FileTreeView = forwardRef<FileTreeViewHandle, FileTreeViewProps>(function FileTreeView(props, handleRef) {
  const { groups, groupByWorkspace } = props;
  if (groups !== undefined) {
    return groupByWorkspace === true ? (
      <WorkspaceGroupedFileTree {...props} groups={groups} handleRef={handleRef} />
    ) : (
      <PathGroupedFileTree {...props} groups={groups} handleRef={handleRef} />
    );
  }
  return groupByWorkspace === true ? (
    <WorkspaceFileTree {...props} handleRef={handleRef} />
  ) : (
    <PathFileTree {...props} handleRef={handleRef} />
  );
});

export default FileTreeView;

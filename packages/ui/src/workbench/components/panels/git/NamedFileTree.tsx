/**
 * NamedFileTree — a changed-files tree with its files listed by what
 * they belong to in the workbench (`workspace-file-tree`), in the
 * panels' own rows and section headers (`NamedFileRows`): REQUESTS,
 * RULES, ENVIRONMENTS, … then the collections, folders and entities by
 * name, an entity's several files by part, the user's own under Files.
 * A row's name wears its change's colour — an entity that lists several
 * reads added or deleted when all of its own files are, modified
 * otherwise.
 *
 * It behaves as the path tree does (`use-file-tree-behaviour`): a row
 * that stands for one file is that file to the pane's verbs, to the row
 * menu and to a double-click; a row that holds others selects on a
 * click and folds on its caret or a double-click. A section folds on a
 * click and is not a row.
 *
 * A row knows the entity it is or is a part of, and hands it to the
 * pane with its file — Jump to Source opens it by uid — so an entity's
 * row that lists several files has that one verb and a menu of its own.
 *
 * `WorkspaceFileTree` is the tree over the live workspace — the
 * workspace is read there, only while this view is the one shown. A
 * file the workspace holds no entity for is then named from its commit
 * (`use-former-files`) and listed where that entity sat.
 */

import {
  isEntityTreePath,
  listedWorkspaceFiles,
  type WorkspaceFileSection,
  workspaceFileTree,
} from '@openheaders/ui/shared/workspace-files';
import { type ForwardedRef, useCallback, useMemo } from 'react';
import FileTreeFrame from './FileTreeFrame';
import type { FileTreeViewProps } from './file-tree-view-props';
import NamedFileRows, { namedRowEntityRef } from './NamedFileRows';
import { type NamedFileRow, namedFoldKeys, namedSections, visibleNamedSections } from './named-file-tree';
import { type FileTreeViewHandle, useFileTreeBehaviour } from './use-file-tree-behaviour';
import { type CommitFile, useFormerFiles } from './use-former-files';
import { useListedWorkspace } from './use-listed-workspace';

export interface NamedFileTreeProps extends FileTreeViewProps {
  /** The files as the workbench lists what they belong to. */
  sections: readonly WorkspaceFileSection[];
  handleRef: ForwardedRef<FileTreeViewHandle>;
}

const UNFOLDED: ReadonlySet<string> = new Set();

export const NamedFileTree = ({
  sections,
  files,
  loadingPath,
  onOpenFile,
  selectedPath,
  onSelectFile,
  groupByDirectory = true,
  showHeader = false,
  rowMenu,
  handleRef,
}: NamedFileTreeProps) => {
  const listed = useMemo(() => namedSections(sections, groupByDirectory), [sections, groupByDirectory]);
  const foldKeys = useMemo(() => namedFoldKeys(listed), [listed]);
  const rowsOf = useCallback(
    (collapsed: ReadonlySet<string>) => visibleNamedSections(listed, collapsed).flatMap((section) => section.rows),
    [listed],
  );
  const entityByFile = useMemo(
    () =>
      new Map(
        rowsOf(UNFOLDED).flatMap((row) => {
          const entity = namedRowEntityRef(row);
          return row.kind === 'file' && entity !== undefined ? [[row.key, entity] as const] : [];
        }),
      ),
    [rowsOf],
  );
  const behaviour = useFileTreeBehaviour<NamedFileRow>(
    {
      rowsOf,
      foldKeys,
      onOpenFile: (path) => onOpenFile(path, entityByFile.get(path)),
      selectedPath,
      ...(onSelectFile === undefined
        ? {}
        : {
            // One target for the pane's verbs: the reported file's entity, or — no file
            // selected — the entity of the first selected row that names one.
            onSelect: (file, selected) =>
              onSelectFile(
                file,
                file !== null
                  ? entityByFile.get(file)
                  : selected.map(namedRowEntityRef).find((entity) => entity !== undefined),
              ),
          }),
    },
    handleRef,
  );

  return (
    <FileTreeFrame
      containerRef={behaviour.containerRef}
      selectable={behaviour.selectable}
      showHeader={showHeader}
      className="rules-sidebar-content git-named-file-tree"
      onKeyDown={behaviour.onKeyDown}
      onExpandAll={behaviour.expandAll}
      onCollapseAll={behaviour.collapseAll}
    >
      <NamedFileRows sections={listed} scope={behaviour} files={files} loadingPath={loadingPath} rowMenu={rowMenu} />
    </FileTreeFrame>
  );
};

/** The files the workspace holds no entity for, each with the commit to read its name from. */
export function unnamedCommitFiles(
  held: readonly WorkspaceFileSection[],
  shaOf: (path: string) => string | undefined,
): CommitFile[] {
  return listedWorkspaceFiles(held).flatMap((file): CommitFile[] => {
    const from = shaOf(file.path);
    return file.entity === undefined && from !== undefined && isEntityTreePath(file.path)
      ? [{ path: file.path, sha: from }]
      : [];
  });
}

export const WorkspaceFileTree = (props: FileTreeViewProps & { handleRef: ForwardedRef<FileTreeViewHandle> }) => {
  const workspace = useListedWorkspace();
  const { files, workspaceId, sha } = props;
  const paths = useMemo(() => files.map((file) => file.path), [files]);
  const held = useMemo(() => workspaceFileTree(paths, workspace), [paths, workspace]);
  const unnamed = useMemo(() => {
    const shas = new Map(files.map((file) => [file.path, file.sha ?? sha]));
    return unnamedCommitFiles(held, (path) => shas.get(path));
  }, [held, files, sha]);
  const former = useFormerFiles(workspaceId, unnamed);
  const sections = useMemo(
    () => (former.size === 0 ? held : workspaceFileTree(paths, workspace, former)),
    [held, paths, workspace, former],
  );
  return <NamedFileTree {...props} sections={sections} />;
};

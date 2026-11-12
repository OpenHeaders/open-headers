/**
 * NamedFileTree — a changed-files tree with its files listed by what
 * they belong to in the workbench (`workspace-file-tree`), in the
 * panels' own rows and section headers (`sidebar/TreeNodeRow`,
 * `sidebar/SectionHeader`): REQUESTS, RULES, ENVIRONMENTS, … then the
 * collections, folders and entities by name, an entity's several files
 * by part, the user's own under Files. A row's name wears its change's
 * colour — an entity that lists several reads added or deleted when all
 * of its own files are, modified otherwise.
 *
 * It behaves as the path tree does (`use-file-tree-behaviour`): a row
 * that stands for one file is that file to the pane's verbs, to the row
 * menu and to a double-click; a row that holds others selects on a
 * click and folds on its caret or a double-click. A section folds on a
 * click and is not a row.
 *
 * `WorkspaceFileTree` is the tree over the live workspace — the
 * workspace is read there, only while this view is the one shown.
 */

import { type WorkspaceFileSection, workspaceFileTree } from '@openheaders/ui/shared/workspace-files';
import { Dropdown, Spin, theme } from 'antd';
import type React from 'react';
import { type ForwardedRef, Fragment, useCallback, useMemo } from 'react';
import { SectionHeader, SectionOpenerRow } from '../../sidebar/SectionHeader';
import { TreeNodeRow } from '../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../sidebar/types';
import FileTreeFrame from './FileTreeFrame';
import { type FileTreeViewProps, fileStatusColor } from './file-tree-view-props';
import { contextMenuAlign } from './git-menu-overflow';
import {
  isOpenerSection,
  type NamedFileRow,
  namedFoldKeys,
  namedRowStatus,
  namedSectionKey,
  namedSections,
  visibleNamedSections,
} from './named-file-tree';
import { type FileTreeViewHandle, useFileTreeBehaviour } from './use-file-tree-behaviour';
import { useListedWorkspace } from './use-listed-workspace';
import { useWorkspaceFileFace } from './workspace-file-face';

export interface NamedFileTreeProps extends FileTreeViewProps {
  /** The files as the workbench lists what they belong to. */
  sections: readonly WorkspaceFileSection[];
  handleRef: ForwardedRef<FileTreeViewHandle>;
}

const noop = (): void => {};

const onCaret = (event: React.MouseEvent): boolean =>
  event.target instanceof Element && event.target.closest('.rules-sidebar-item-caret') !== null;

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
  const { token } = theme.useToken();
  const face = useWorkspaceFileFace();
  const listed = useMemo(() => namedSections(sections, groupByDirectory), [sections, groupByDirectory]);
  const foldKeys = useMemo(() => namedFoldKeys(listed), [listed]);
  const rowsOf = useCallback(
    (collapsed: ReadonlySet<string>) => visibleNamedSections(listed, collapsed).flatMap((section) => section.rows),
    [listed],
  );
  const behaviour = useFileTreeBehaviour({ rowsOf, foldKeys, onOpenFile, selectedPath, onSelectFile }, handleRef);
  const { selectable, collapsed, isSelected } = behaviour;
  const statuses = useMemo(() => new Map(files.map((file) => [file.path, file.status])), [files]);

  const nodeOf = (row: NamedFileRow): TreeNode => {
    const status = namedRowStatus(row.node, (path) => statuses.get(path));
    return {
      id: row.node.id,
      kind: row.kind === 'dir' ? 'folder' : 'leaf',
      label: face.labelOf(row.node),
      depth: row.depth,
      expandable: row.kind === 'dir',
      icon: face.iconOf(row.section, row.node, status),
      ...(row.kind === 'file' && loadingPath === row.key ? { badge: <Spin size="small" /> } : {}),
      ...(status !== undefined ? { labelColor: fileStatusColor(status, token) } : {}),
      canRename: false,
      canDelete: false,
      canAddChild: false,
    };
  };

  const rowOf = (row: NamedFileRow): React.ReactNode => {
    const file = row.kind === 'file' ? row.key : undefined;
    const selected = isSelected(row.key);
    const body = (
      <div
        key={row.key}
        title={file}
        onClick={(event) => {
          if (selectable && row.kind === 'dir' && onCaret(event)) behaviour.toggleCollapse(row.key);
          else behaviour.onRowClick(row, event);
        }}
        onDoubleClick={() => behaviour.onRowDoubleClick(row)}
        onContextMenu={() => behaviour.onRowContextMenu(row)}
        data-testid={file !== undefined ? 'git-tool-file' : 'git-tool-file-dir'}
        data-path={file}
        data-row-key={row.key}
        data-selected={selected || undefined}
      >
        {isOpenerSection(row.section) ? (
          <SectionOpenerRow title={face.sectionTitle(row.section)} node={nodeOf(row)} selected={selected} />
        ) : (
          <TreeNodeRow
            node={nodeOf(row)}
            isSelected={selected}
            isFocused={selected}
            isRenaming={false}
            isExpanded={row.expanded === true}
            onClick={noop}
            onDoubleClick={noop}
            onStartRename={noop}
          />
        )}
      </div>
    );
    if (file === undefined || rowMenu === undefined) return body;
    return (
      <Dropdown
        key={row.key}
        menu={rowMenu(file)}
        trigger={['contextMenu']}
        align={contextMenuAlign}
        classNames={{ root: 'commit-tool-row-menu' }}
      >
        {body}
      </Dropdown>
    );
  };

  return (
    <FileTreeFrame
      containerRef={behaviour.containerRef}
      selectable={selectable}
      showHeader={showHeader}
      className="rules-sidebar-content git-named-file-tree"
      onKeyDown={behaviour.onKeyDown}
      onExpandAll={behaviour.expandAll}
      onCollapseAll={behaviour.collapseAll}
    >
      {listed.map((section) => {
        const rows = behaviour.rows.filter((row) => row.section === section.id).map(rowOf);
        if (isOpenerSection(section.id)) return <Fragment key={section.id}>{rows}</Fragment>;
        const key = namedSectionKey(section.id);
        return (
          <Fragment key={section.id}>
            <SectionHeader
              title={face.sectionTitle(section.id)}
              expanded={!collapsed.has(key)}
              onToggle={() => behaviour.toggleCollapse(key)}
              testid={`git-tool-file-section-${section.id}`}
            />
            {rows}
          </Fragment>
        );
      })}
    </FileTreeFrame>
  );
};

export const WorkspaceFileTree = (props: FileTreeViewProps & { handleRef: ForwardedRef<FileTreeViewHandle> }) => {
  const workspace = useListedWorkspace();
  const { files } = props;
  const sections = useMemo(
    () =>
      workspaceFileTree(
        files.map((file) => file.path),
        workspace,
      ),
    [files, workspace],
  );
  return <NamedFileTree {...props} sections={sections} />;
};

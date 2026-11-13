/**
 * NamedFileRows — a changed-files tree's rows by what the files belong
 * to in the workbench, in the panels' own rows and section headers
 * (`sidebar/TreeNodeRow`, `sidebar/SectionHeader`): each section's
 * header, then its collections, folders and entities by name, a row's
 * name in its change's colour. Drawn against a row scope
 * (`use-file-tree-behaviour`), so the same rows serve a tree of one
 * listing and one group of a tree that lists several.
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import { isWorkspaceFilePage, type WorkspaceFileSection } from '@openheaders/ui/shared/workspace-files';
import { Dropdown, type MenuProps, Spin, theme } from 'antd';
import type React from 'react';
import { Fragment, useMemo } from 'react';
import { SectionHeader, SectionOpenerRow } from '../../sidebar/SectionHeader';
import { isRowCaretClick, TreeNodeRow } from '../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../sidebar/types';
import { fileStatusColor } from './file-tree-view-props';
import { contextMenuAlign } from './git-menu-overflow';
import { type NamedFileRow, namedRowStatus, namedSectionKey } from './named-file-tree';
import type { FileTreeRowScope } from './use-file-tree-behaviour';
import { workspaceFileEntityRef } from './workspace-file-entity-ref';
import { useWorkspaceFileFace } from './workspace-file-face';

export interface NamedFileRowsProps {
  /** The sections as the tree lists them (`namedSections`). */
  sections: readonly WorkspaceFileSection[];
  scope: FileTreeRowScope<NamedFileRow>;
  /** The listed files with their change. */
  files: ReadonlyArray<{ path: string; status: string }>;
  /** Path currently fetching its diff (per-file spinner). */
  loadingPath: string | null;
  /** Right-click menu of a file's row and of an entity's row that lists several (no path); absent = no menu. */
  rowMenu?: (path: string | null, entity?: WorkspaceTreeEntityRefWire) => MenuProps;
}

const noop = (): void => {};

/** The entity a row is, or is a part of, as Jump to Source opens it. */
export const namedRowEntityRef = (row: NamedFileRow): WorkspaceTreeEntityRefWire | undefined =>
  row.entity === undefined ? undefined : workspaceFileEntityRef(row.section, row.entity);

const NamedFileRows: React.FC<NamedFileRowsProps> = ({ sections, scope, files, loadingPath, rowMenu }) => {
  const { token } = theme.useToken();
  const face = useWorkspaceFileFace();
  const { selectable, collapsed, isSelected, keyOf } = scope;
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
          if (selectable && row.kind === 'dir' && isRowCaretClick(event)) scope.toggleCollapse(row.key);
          else scope.onRowClick(row, event);
        }}
        onDoubleClick={() => scope.onRowDoubleClick(row)}
        onContextMenu={() => scope.onRowContextMenu(row)}
        data-testid={file !== undefined ? 'git-tool-file' : 'git-tool-file-dir'}
        data-path={file}
        data-row-key={keyOf(row.key)}
        data-selected={selected || undefined}
      >
        {isWorkspaceFilePage(row.section) ? (
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
    const entity = namedRowEntityRef(row);
    if (rowMenu === undefined || (file === undefined && entity === undefined)) return body;
    return (
      <Dropdown
        key={row.key}
        menu={rowMenu(file ?? null, entity)}
        trigger={['contextMenu']}
        align={contextMenuAlign}
        classNames={{ root: 'commit-tool-row-menu' }}
      >
        {body}
      </Dropdown>
    );
  };

  return (
    <>
      {sections.map((section) => {
        const rows = scope.rows.filter((row) => row.section === section.id).map(rowOf);
        if (isWorkspaceFilePage(section.id)) return <Fragment key={section.id}>{rows}</Fragment>;
        const key = namedSectionKey(section.id);
        return (
          <Fragment key={section.id}>
            <SectionHeader
              title={face.sectionTitle(section.id)}
              expanded={!collapsed.has(key)}
              onToggle={() => scope.toggleCollapse(key)}
              testid={`git-tool-file-section-${section.id}`}
            />
            {rows}
          </Fragment>
        );
      })}
    </>
  );
};

export default NamedFileRows;

/**
 * GroupedFileTree — a changed-files tree that lists several sets of
 * files, each under a heading that folds (a merge's files: what the
 * commit holds differently from each parent). ONE tree: one selection
 * and one keyboard walk the headings and every group's rows
 * (`grouped-file-tree`), and a group's rows are drawn as the pane's
 * tree draws any — by path (`PathFileRows`) or by what the files belong
 * to in the workbench (`NamedFileRows`). The same file may sit in
 * several groups; the tree hands the pane the group's base commit with
 * every file it reports, so a diff reads against that group's parent.
 */

import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type WorkspaceFileSection, workspaceFileTree } from '@openheaders/ui/shared/workspace-files';
import { theme } from 'antd';
import type React from 'react';
import { type ForwardedRef, useCallback, useMemo } from 'react';
import FileTreeFrame from './FileTreeFrame';
import { allDirKeys, buildFileTree, type FileTreeNode, type FileTreeRow, visibleFileTreeRows } from './file-tree';
import type { FileTreeGroup, FileTreeViewProps } from './file-tree-view-props';
import {
  type FileTreeGroupModel,
  type GroupedFileRow,
  groupedFoldKeys,
  groupedRows,
  groupRowKey,
  groupScope,
} from './grouped-file-tree';
import NamedFileRows, { namedRowEntityRef } from './NamedFileRows';
import { unnamedCommitFiles } from './NamedFileTree';
import { type NamedFileRow, namedFoldKeys, namedSections, visibleNamedSections } from './named-file-tree';
import PathFileRows from './PathFileRows';
import { type FileTreeRowScope, type FileTreeViewHandle, useFileTreeBehaviour } from './use-file-tree-behaviour';
import { useFormerFiles } from './use-former-files';
import { useListedWorkspace } from './use-listed-workspace';

type GroupedTreeProps = Omit<FileTreeViewProps, 'groups'> & {
  groups: readonly FileTreeGroup[];
  handleRef: ForwardedRef<FileTreeViewHandle>;
};

interface GroupedFileTreeProps<Row extends FileTreeRow, Shape>
  extends Pick<FileTreeViewProps, 'onOpenFile' | 'onSelectFile' | 'showHeader' | 'groupsNote'> {
  groups: readonly FileTreeGroupModel<Row, Shape>[];
  /** Beside the tree's own: the row family the groups' rows are drawn in. */
  className?: string;
  renderRows: (group: FileTreeGroupModel<Row, Shape>, scope: FileTreeRowScope<Row>) => React.ReactNode;
  entityOf?: (row: Row) => WorkspaceTreeEntityRefWire | undefined;
  handleRef: ForwardedRef<FileTreeViewHandle>;
}

const UNFOLDED: ReadonlySet<string> = new Set();

function GroupedFileTree<Row extends FileTreeRow, Shape>({
  groups,
  groupsNote,
  className,
  renderRows,
  entityOf,
  onOpenFile,
  onSelectFile,
  showHeader = false,
  handleRef,
}: GroupedFileTreeProps<Row, Shape>) {
  const { token } = theme.useToken();
  const t = useT();
  const foldKeys = useMemo(() => groupedFoldKeys(groups), [groups]);
  const rowsOf = useCallback((collapsed: ReadonlySet<string>) => groupedRows(groups, collapsed), [groups]);
  const everyRow = useMemo(() => new Map(rowsOf(UNFOLDED).map((row) => [row.key, row])), [rowsOf]);
  const baseOf = useMemo(() => new Map(groups.map((group) => [group.id, group.base])), [groups]);
  const entityOfRow = (row: GroupedFileRow<Row>): WorkspaceTreeEntityRefWire | undefined =>
    row.member === undefined ? undefined : entityOf?.(row.member);

  const behaviour = useFileTreeBehaviour<GroupedFileRow<Row>>(
    {
      rowsOf,
      foldKeys,
      onOpenFile: (key) => {
        const row = everyRow.get(key);
        if (row?.member !== undefined) onOpenFile(row.member.key, entityOfRow(row), baseOf.get(row.group));
      },
      ...(onSelectFile === undefined
        ? {}
        : {
            // One target for the pane's verbs: the reported file with its group's base, or —
            // no file selected — the entity of the first selected row that names one.
            onSelect: (file, selected) => {
              const lead =
                file !== null ? everyRow.get(file) : selected.find((row) => entityOfRow(row) !== undefined);
              if (lead?.member === undefined) onSelectFile(null);
              else onSelectFile(file !== null ? lead.member.key : null, entityOfRow(lead), baseOf.get(lead.group));
            },
          }),
    },
    handleRef,
  );
  const { selectable, collapsed, isSelected } = behaviour;

  const headingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    padding: '4px 12px',
    lineHeight: '16px',
    minHeight: 24,
    boxSizing: 'border-box',
    cursor: 'pointer',
    fontSize: 12,
    color: token.colorText,
  };

  return (
    <FileTreeFrame
      containerRef={behaviour.containerRef}
      selectable={selectable}
      showHeader={showHeader}
      className={className}
      onKeyDown={behaviour.onKeyDown}
      onExpandAll={behaviour.expandAll}
      onCollapseAll={behaviour.collapseAll}
    >
      {groupsNote !== undefined && (
        <div style={{ ...headingStyle, cursor: 'default' }} data-testid="git-tool-file-groups-note">
          {/* The headings' caret slot — the line starts where their titles do. */}
          <span aria-hidden style={{ flex: 'none', width: 12 }} />
          {groupsNote}
        </div>
      )}
      {groups.map((group) => {
        const key = groupRowKey(group.id);
        const open = !collapsed.has(key);
        const row: FileTreeRow = { key, kind: 'dir', depth: 0, parentKey: null, expanded: open };
        return (
          <div key={group.id} data-testid="git-tool-file-group" data-group={group.id}>
            <div
              className={isSelected(key) ? 'git-tool-row selected' : 'git-tool-row'}
              style={headingStyle}
              title={group.title}
              onClick={(event) => behaviour.onRowClick(row, event)}
              onDoubleClick={() => behaviour.onRowDoubleClick(row)}
              onContextMenu={() => behaviour.onRowContextMenu(row)}
              data-testid="git-tool-file-group-row"
              data-row-key={key}
              data-selected={isSelected(key) || undefined}
            >
              {/* The caret toggles on its own click when rows select; a plain row click selects. */}
              <span
                aria-hidden
                style={{
                  flex: 'none',
                  width: 12,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  fontSize: 9,
                  color: token.colorTextTertiary,
                }}
                onClick={
                  selectable
                    ? (event) => {
                        event.stopPropagation();
                        behaviour.toggleCollapse(key);
                      }
                    : undefined
                }
              >
                {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>
              <span
                style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {group.title}
              </span>
              <span style={{ flex: '0 0 auto', fontSize: 11, color: token.colorTextTertiary }}>
                {group.fileCount === 1
                  ? t('workbench.commitTool.oneFile')
                  : t('workbench.gitLog.filesCount', { count: group.fileCount })}
              </span>
            </div>
            {open && renderRows(group, groupScope(behaviour, group))}
          </div>
        );
      })}
    </FileTreeFrame>
  );
}

/** The groups' files by path: each group's rows as the path tree draws them, one step under its heading. */
export const PathGroupedFileTree = ({
  groups,
  groupsNote,
  loadingPath,
  onOpenFile,
  onSelectFile,
  groupByDirectory = true,
  showHeader,
  rowMenu,
  handleRef,
}: GroupedTreeProps) => {
  const models = useMemo(
    () =>
      groups.map((group): FileTreeGroupModel<FileTreeRow, readonly FileTreeNode[]> => {
        const tree = buildFileTree(group.files, groupByDirectory);
        return {
          id: group.id,
          title: group.title,
          fileCount: group.files.length,
          ...(group.base !== undefined ? { base: group.base } : {}),
          rowsOf: (collapsed) => visibleFileTreeRows(tree, collapsed),
          foldKeys: allDirKeys(tree),
          shape: tree,
        };
      }),
    [groups, groupByDirectory],
  );
  return (
    <GroupedFileTree
      groups={models}
      groupsNote={groupsNote}
      onOpenFile={onOpenFile}
      onSelectFile={onSelectFile}
      showHeader={showHeader}
      handleRef={handleRef}
      renderRows={(group, scope) => (
        <PathFileRows
          nodes={group.shape}
          scope={scope}
          depth={1}
          loadingPath={loadingPath}
          rowMenu={rowMenu === undefined ? undefined : (path) => rowMenu(path, undefined, group.base)}
        />
      )}
    />
  );
};

interface NamedGroupShape {
  sections: readonly WorkspaceFileSection[];
  files: FileTreeGroup['files'];
}

/**
 * The groups' files by what they belong to in the workbench, each group
 * on its own — nothing crosses a group. The workspace is read here, only
 * while this view is the one shown; a file the workspace holds no entity
 * for is named from the commit (`use-former-files`).
 */
export const WorkspaceGroupedFileTree = ({
  groups,
  groupsNote,
  workspaceId,
  sha,
  loadingPath,
  onOpenFile,
  onSelectFile,
  groupByDirectory = true,
  showHeader,
  rowMenu,
  handleRef,
}: GroupedTreeProps) => {
  const workspace = useListedWorkspace();
  const paths = useMemo(
    () => [...new Set(groups.flatMap((group) => group.files.map((file) => file.path)))],
    [groups],
  );
  const unnamed = useMemo(
    () => unnamedCommitFiles(workspaceFileTree(paths, workspace), () => sha),
    [paths, workspace, sha],
  );
  const former = useFormerFiles(workspaceId, unnamed);
  const models = useMemo(
    () =>
      groups.map((group): FileTreeGroupModel<NamedFileRow, NamedGroupShape> => {
        const held = workspaceFileTree(
          group.files.map((file) => file.path),
          workspace,
          former,
        );
        const sections = namedSections(held, groupByDirectory);
        return {
          id: group.id,
          title: group.title,
          fileCount: group.files.length,
          ...(group.base !== undefined ? { base: group.base } : {}),
          rowsOf: (collapsed) => visibleNamedSections(sections, collapsed).flatMap((section) => section.rows),
          foldKeys: namedFoldKeys(sections),
          shape: { sections, files: group.files },
        };
      }),
    [groups, workspace, former, groupByDirectory],
  );
  return (
    <GroupedFileTree
      groups={models}
      groupsNote={groupsNote}
      className="rules-sidebar-content"
      entityOf={namedRowEntityRef}
      onOpenFile={onOpenFile}
      onSelectFile={onSelectFile}
      showHeader={showHeader}
      handleRef={handleRef}
      renderRows={(group, scope) => (
        <div className="git-named-file-tree">
          <NamedFileRows
            sections={group.shape.sections}
            scope={scope}
            files={group.shape.files}
            loadingPath={loadingPath}
            rowMenu={rowMenu === undefined ? undefined : (path, entity) => rowMenu(path, entity, group.base)}
          />
        </div>
      )}
    />
  );
};

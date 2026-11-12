/**
 * CommitNamedRows — one git group of the Commit tree with its files
 * listed by what they belong to in the workbench (`commit-named-tree`):
 * the panels' sections, then the collections, folders and entities by
 * name, an entity's several files by part, the user's own under Files —
 * in the panels' own rows and section headers, as the Git window's
 * named tree draws them. Every row and every section carries the
 * checkbox of the files under it (tri-state); the ignored group's carry
 * none.
 *
 * The tree keeps its behaviour: this draws the rows and hands every
 * gesture back — a click, a right-click, a fold, a double-click on a
 * file. A row that stands for one file is `commit-tool-file` with its
 * path, as in the tree's other shapes. A name wears the Commit window's
 * own change colours.
 *
 * Mounted only while this shape is shown — the row faces read the
 * workspace.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isWorkspaceFilePage } from '@openheaders/ui/shared/workspace-files';
import { Checkbox, theme } from 'antd';
import type React from 'react';
import { Fragment } from 'react';
import { SectionHeader, SectionOpenerRow } from '../../../sidebar/SectionHeader';
import { isRowCaretClick, TreeNodeRow } from '../../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../../sidebar/types';
import { namedDirectoryPath } from '../named-file-tree';
import { workspaceFileEntityRef } from '../workspace-file-entity-ref';
import { useWorkspaceFileFace } from '../workspace-file-face';
import type { ChangeGroupKey, CheckAggregate, CommitMenuTarget } from './commit-model';
import { type CommitNamedRow, type CommitNamedSection, commitNamedTone } from './commit-named-tree';
import { baseName } from './commit-tree-nav';
import { FileTypeIcon } from './FileTypeIcon';
import { ignoreSourceLabel } from './ignore-source-label';
import { vcsPalette } from './vcs-colors';

export interface CommitNamedRowsProps {
  group: ChangeGroupKey;
  /** The group's rows carry checkboxes — never the ignored group's. */
  checkable: boolean;
  sections: readonly CommitNamedSection[];
  rowsByPath: ReadonlyMap<string, WorkspaceTreeWorkingChangeWire>;
  /** By key, the files under a section or under a row that holds others. */
  pathsByRowKey: ReadonlyMap<string, readonly string[]>;
  aggregateOf: (paths: readonly string[]) => CheckAggregate;
  onSetChecked: (paths: readonly string[], checked: boolean) => void;
  isSelected: (key: string) => boolean;
  onToggleFold: (key: string) => void;
  onRowClick: (key: string, event: React.MouseEvent) => void;
  onRowContextMenu: (key: string) => void;
  onOpenFile: (path: string) => void;
  /** The row inside its context menu — its own target, or the selection it sits in. */
  withMenu: (key: string, target: CommitMenuTarget, body: React.ReactElement) => React.ReactNode;
}

const noop = (): void => {};

/** Indents a group's rows under its header. */
const GROUP_INDENT = 14;

const CommitNamedRows: React.FC<CommitNamedRowsProps> = ({
  group,
  checkable,
  sections,
  rowsByPath,
  pathsByRowKey,
  aggregateOf,
  onSetChecked,
  isSelected,
  onToggleFold,
  onRowClick,
  onRowContextMenu,
  onOpenFile,
  withMenu,
}) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const t = useT();
  const face = useWorkspaceFileFace();
  const palette = vcsPalette(isDarkMode);
  const statusOf = (path: string): string | undefined => rowsByPath.get(path)?.status;
  const dim: React.CSSProperties = { flex: 'none', color: token.colorTextTertiary };

  const checkboxOf = (paths: readonly string[], testid: string): React.ReactNode => {
    if (!checkable) return undefined;
    const aggregate = aggregateOf(paths);
    return (
      <Checkbox
        checked={aggregate === 'all'}
        indeterminate={aggregate === 'some'}
        onChange={(event) => onSetChecked(paths, event.target.checked)}
        data-testid={testid}
      />
    );
  };

  /** What a file's row says beside its name: where a rename came from, which source ignores it. */
  const noteOf = (change: WorkspaceTreeWorkingChangeWire): React.ReactNode => {
    if (change.renamedFrom !== undefined) {
      return (
        <span style={dim} data-testid="commit-tool-renamed-from">
          {t('workbench.commitTool.renamedFrom', { name: baseName(change.renamedFrom) })}
        </span>
      );
    }
    if (change.ignored && change.ignoreSource !== undefined) {
      return (
        <span style={dim} data-testid="commit-tool-ignore-source">
          {ignoreSourceLabel(t, change.ignoreSource)}
        </span>
      );
    }
    return undefined;
  };

  const rowOf = (row: CommitNamedRow): React.ReactNode => {
    const { node, section } = row.named;
    const file = row.kind === 'file' ? row.named.key : undefined;
    const change = file === undefined ? undefined : rowsByPath.get(file);
    if (file !== undefined && change === undefined) return null;
    const paths = file !== undefined ? [file] : (pathsByRowKey.get(row.key) ?? []);
    const selected = isSelected(row.key);
    const tone = commitNamedTone(group, node, statusOf);
    const note = change === undefined ? undefined : noteOf(change);
    const treeNode: TreeNode = {
      id: node.id,
      kind: row.kind === 'dir' ? 'folder' : 'leaf',
      label: face.labelOf(node),
      depth: row.depth,
      expandable: row.kind === 'dir',
      icon:
        change !== undefined && node.type !== 'entity' ? (
          <FileTypeIcon path={change.path} status={change.status} symlink={change.symlink} />
        ) : (
          face.iconOf(section, node)
        ),
      ...(note !== undefined ? { badge: note } : {}),
      ...(tone !== undefined ? { labelColor: palette[tone] } : {}),
      canRename: false,
      canDelete: false,
      canAddChild: false,
    };
    const entity = row.named.entity === undefined ? undefined : workspaceFileEntityRef(section, row.named.entity);
    const named = entity !== undefined ? { entity } : {};
    const target: CommitMenuTarget =
      change !== undefined
        ? { kind: 'file', row: change, ...named }
        : node.type === 'directory'
          ? { kind: 'dir', group, path: namedDirectoryPath(node), paths }
          : { kind: 'named', group, rows: paths.flatMap((path) => rowsByPath.get(path) ?? []), ...named };
    const testid = file !== undefined ? 'file' : node.type === 'directory' ? 'dir' : 'named';
    const leading = checkboxOf(paths, `commit-tool-${testid}-check`);
    const body = (
      <div
        title={file}
        onClick={(event) => {
          if (row.kind === 'dir' && isRowCaretClick(event)) onToggleFold(row.key);
          else onRowClick(row.key, event);
        }}
        onDoubleClick={() => (file !== undefined ? onOpenFile(file) : onToggleFold(row.key))}
        onContextMenu={() => onRowContextMenu(row.key)}
        data-testid={`commit-tool-${testid}`}
        data-path={file}
        data-key={node.type === 'directory' ? namedDirectoryPath(node) : undefined}
        data-row-key={row.key}
        data-selected={selected || undefined}
      >
        {isWorkspaceFilePage(section) ? (
          <SectionOpenerRow
            title={face.sectionTitle(section)}
            node={treeNode}
            selected={selected}
            leading={leading}
            actions={note}
          />
        ) : (
          <TreeNodeRow
            node={treeNode}
            isSelected={selected}
            isFocused={selected}
            isRenaming={false}
            isExpanded={row.expanded === true}
            leading={leading}
            onClick={noop}
            onDoubleClick={noop}
            onStartRename={noop}
          />
        )}
      </div>
    );
    return <Fragment key={row.key}>{withMenu(row.key, target, body)}</Fragment>;
  };

  return (
    <div
      className="git-named-file-tree"
      style={{ paddingLeft: GROUP_INDENT }}
      data-testid={`commit-tool-named-${group}`}
    >
      {sections.map((section) => {
        const rows = section.rows.map(rowOf);
        if (isWorkspaceFilePage(section.id)) return <Fragment key={section.id}>{rows}</Fragment>;
        return (
          <Fragment key={section.id}>
            <SectionHeader
              title={face.sectionTitle(section.id)}
              expanded={section.expanded}
              onToggle={() => onToggleFold(section.key)}
              leading={checkboxOf(pathsByRowKey.get(section.key) ?? [], `commit-tool-section-${group}-${section.id}-check`)}
              testid={`commit-tool-section-${group}-${section.id}`}
            />
            {rows}
          </Fragment>
        );
      })}
    </div>
  );
};

export default CommitNamedRows;

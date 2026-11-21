/**
 * CommitNamedRow — one row of the Commit tree where the files are
 * listed by what they belong to in the workbench (`commit-named-tree`):
 * a panel's section header, or under it a collection, a folder, an
 * entity by name, an entity's file by part, a file of the user's own —
 * in the panels' own rows and section headers, as the Git window's
 * named tree draws them. Every row and every section carries the
 * checkbox of the files under it (tri-state); the ignored group's carry
 * none. A name wears the Commit window's own change colours.
 *
 * A row that stands for one file is `commit-tool-file` with its path,
 * as in the tree's other shapes. The row is given the height the model
 * places it by (`commit-tree-rows`), draws, and hands every gesture
 * back (`commit-row-scope`).
 *
 * Mounted only while this shape is shown — the row faces read the
 * workspace.
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { isWorkspaceFilePage } from '@openheaders/ui/shared/workspace-files';
import { Checkbox, Spin } from 'antd';
import type React from 'react';
import { SectionHeader, SectionOpenerRow } from '../../../sidebar/SectionHeader';
import { isRowCaretClick, TreeNodeRow } from '../../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../../sidebar/types';
import { namedDirectoryPath } from '../named-file-tree';
import { useWorkspaceFileFace } from '../workspace-file-face';
import { commitNamedTone } from './commit-named-tree';
import type { CommitRowScope } from './commit-row-scope';
import { baseName } from './commit-tree-nav';
import { type CommitTreeRow, commitTreeRowHeight } from './commit-tree-rows';
import { FileTypeIcon } from './FileTypeIcon';
import { ignoreSourceLabel } from './ignore-source-label';

export type CommitNamedTreeRow = Extract<CommitTreeRow, { draw: 'section' | 'named' }>;

export interface CommitNamedRowProps {
  row: CommitNamedTreeRow;
  scope: CommitRowScope;
}

const noop = (): void => {};

/** Indents a group's rows under its header. */
const GROUP_INDENT = 14;

const CommitNamedRow: React.FC<CommitNamedRowProps> = ({ row, scope }) => {
  const face = useWorkspaceFileFace();
  const { checkable } = scope.groupFace(row.group);
  const { t } = scope;
  const dim: React.CSSProperties = { flex: 'none', color: scope.dimColor };
  const placed = {
    'data-commit-row': row.key,
    'data-group': row.group,
    // A section's header and a page's row keep the hairline over them unless they lead their group's rows.
    className: row.lead ? 'commit-tool-named-row' : 'commit-tool-named-row commit-tool-named-row--ruled',
    style: { flex: 'none', height: commitTreeRowHeight(row), paddingLeft: GROUP_INDENT },
  };

  const checkboxOf = (testid: string): React.ReactNode => {
    if (!checkable) return undefined;
    const aggregate = scope.aggregateOf(row.key);
    return (
      <Checkbox
        checked={aggregate === 'all'}
        indeterminate={aggregate === 'some'}
        onChange={(event) => scope.onSetChecked(scope.pathsOf(row.key), event.target.checked)}
        data-testid={testid}
      />
    );
  };

  if (row.draw === 'section') {
    const { section } = row;
    return (
      <div {...placed}>
        <SectionHeader
          title={face.sectionTitle(section.id)}
          expanded={section.expanded}
          onToggle={() => scope.onToggleFold(section.key)}
          leading={checkboxOf(`commit-tool-section-${row.group}-${section.id}-check`)}
          testid={`commit-tool-section-${row.group}-${section.id}`}
        />
      </div>
    );
  }

  const named = row.nav;
  const { node, section } = named.named;
  const file = named.kind === 'file' ? named.named.key : undefined;
  const change = file === undefined ? undefined : scope.rowsByPath.get(file);
  if (file !== undefined && change === undefined) return <div {...placed} />;

  /** What a file's row says beside its name: its diff being read, where a rename came from, which source ignores it. */
  const noteOf = (of: WorkspaceTreeWorkingChangeWire): React.ReactNode => {
    if (scope.loadingPath === of.path) return <Spin size="small" />;
    if (of.renamedFrom !== undefined) {
      return (
        <span style={dim} data-testid="commit-tool-renamed-from">
          {t('workbench.commitTool.renamedFrom', { name: baseName(of.renamedFrom) })}
        </span>
      );
    }
    if (of.ignored && of.ignoreSource !== undefined) {
      return (
        <span style={dim} data-testid="commit-tool-ignore-source">
          {ignoreSourceLabel(t, of.ignoreSource)}
        </span>
      );
    }
    return undefined;
  };

  const selected = scope.isSelected(row.key);
  const tone = commitNamedTone(row.group, node, (path) => scope.rowsByPath.get(path)?.status);
  const note = change === undefined ? undefined : noteOf(change);
  const treeNode: TreeNode = {
    id: node.id,
    kind: named.kind === 'dir' ? 'folder' : 'leaf',
    label: face.labelOf(node),
    depth: named.depth,
    expandable: named.kind === 'dir',
    icon:
      change !== undefined && node.type !== 'entity' ? (
        <FileTypeIcon path={change.path} status={change.status} symlink={change.symlink} />
      ) : (
        face.iconOf(section, node)
      ),
    ...(note !== undefined ? { badge: note } : {}),
    ...(tone !== undefined ? { labelColor: scope.palette[tone] } : {}),
    canRename: false,
    canDelete: false,
    canAddChild: false,
  };
  const testid = file !== undefined ? 'file' : node.type === 'directory' ? 'dir' : 'named';
  const leading = checkboxOf(`commit-tool-${testid}-check`);
  return (
    <div
      {...placed}
      title={file}
      onClick={(event) => {
        if (named.kind === 'dir' && isRowCaretClick(event)) scope.onToggleFold(row.key);
        else scope.onRowClick(row.key, event);
      }}
      onDoubleClick={() => (file !== undefined ? scope.onOpenFile(file) : scope.onToggleFold(row.key))}
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
          isExpanded={named.expanded === true}
          leading={leading}
          onClick={noop}
          onDoubleClick={noop}
          onStartRename={noop}
        />
      )}
    </div>
  );
};

export default CommitNamedRow;

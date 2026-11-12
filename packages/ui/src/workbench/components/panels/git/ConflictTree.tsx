/**
 * ConflictTree — the merge editor's files panel for a conflicted pass,
 * drawn as the workbench's own panels draw what the files belong to:
 * the sections a surface's panel shows (REQUESTS, SPECS, RULES,
 * ENVIRONMENTS, …) with the panel's own header, one after another in
 * the surfaces' order, and under a section the collections, folders and
 * entities in the panel's own rows — the same caret, icon and name
 * (`sidebar/TreeNodeRow`, `sidebar/SectionHeader`). The surfaces
 * themselves are the strip's chips beside the panel, which mark the
 * open file's; no row here names one. `workspace-file-tree` is the
 * listing, `workspace-file-face` the names and icons.
 *
 * A row that stands for one conflicted file opens it; any other folds
 * and unfolds. A file's row ends in what it has left to answer, or a
 * check once nothing is; a folded row or section shows the count of
 * everything under it. The open file's row is unfolded to and kept in
 * view, and wears the one selection blue (`styles/panels.less`).
 *
 * Handed one `section` (a surface), it lists that surface alone — the
 * strip's flyout while the panel is shut. As a `listing` it names the
 * files and opens none — a pass's own dialogs (`PassFileTree`).
 */

import { CheckCircleFilled, WarningFilled } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { MergeFilesPanelProps } from '@openheaders/ui/shared/merge-editor';
import {
  isWorkspaceFilePage,
  type WorkspaceFileNode,
  type WorkspaceFileSection,
  type WorkspaceFileSectionId,
} from '@openheaders/ui/shared/workspace-files';
import { Tooltip, theme } from 'antd';
import { Fragment, type ReactElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionHeader, SectionOpenerRow } from '../../sidebar/SectionHeader';
import { TreeNodeRow } from '../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../sidebar/types';
import { useWorkspaceFileFace } from './workspace-file-face';

export interface ConflictTreeProps extends MergeFilesPanelProps {
  tree: readonly WorkspaceFileSection[];
  /** Name the files only: nothing is open, and a file's row opens nothing. */
  listing?: boolean;
}

const sectionKey = (id: WorkspaceFileSectionId): string => `section:${id}`;

const noop = (): void => {};

/** The file a row opens, when it stands for one. */
function fileOf(node: WorkspaceFileNode): string | undefined {
  return node.type === 'directory' ? undefined : node.file;
}

function childrenOf(node: WorkspaceFileNode): readonly WorkspaceFileNode[] {
  return node.type === 'entity' || node.type === 'directory' ? node.children : [];
}

/** Every file at or under a row. */
function filesUnder(node: WorkspaceFileNode): string[] {
  const own = fileOf(node);
  return [...(own !== undefined ? [own] : []), ...childrenOf(node).flatMap(filesUnder)];
}

const ConflictTree = ({
  tree,
  activeFileId,
  states,
  hunkCounts,
  section,
  listing = false,
  onSelect,
}: ConflictTreeProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();
  const face = useWorkspaceFileFace();
  const hostRef = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  /** The rows and the section a file sits under. */
  const trails = useMemo(() => {
    const out = new Map<string, string[]>();
    const visit = (nodes: readonly WorkspaceFileNode[], trail: string[]): void => {
      for (const node of nodes) {
        const own = fileOf(node);
        if (own !== undefined) out.set(own, trail);
        visit(childrenOf(node), [...trail, node.id]);
      }
    };
    for (const listed of tree) visit(listed.nodes, [sectionKey(listed.id)]);
    return out;
  }, [tree]);

  // The open file's row is unfolded to, then kept in view — a chip of
  // the strip, or the editor's first file, may open one out of sight.
  const reveal = useRef(false);
  useEffect(() => {
    reveal.current = true;
    const trail = trails.get(activeFileId) ?? [];
    setFolded((prev) => (trail.some((key) => prev.has(key)) ? new Set([...prev].filter((key) => !trail.includes(key))) : prev));
  }, [activeFileId, trails]);
  useEffect(() => {
    // Not before the rows above it have unfolded.
    if (!reveal.current || (trails.get(activeFileId) ?? []).some((key) => folded.has(key))) return;
    reveal.current = false;
    hostRef.current
      ?.querySelector('.rules-sidebar-item.selected, .rules-sidebar-section--selected')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeFileId, trails, folded]);

  /** A file's row opens it — except in a listing, which names files and opens none. */
  const open = (file: string): void => {
    if (!listing) onSelect(file);
  };

  const remainingOf = (files: readonly string[]): number =>
    files.reduce((sum, file) => sum + (hunkCounts?.get(file) ?? 0), 0);

  /** What a row ends in: a failed answer, what is left under it, or a check once nothing is. */
  const endOf = (files: readonly string[]): ReactNode => {
    const failed = files.map((file) => states?.get(file)).find((state) => state?.status === 'failed');
    const remaining = remainingOf(files);
    const settled = files.length > 0 && files.every((file) => states?.get(file)?.status === 'resolved');
    if (failed === undefined && remaining === 0 && !settled) return undefined;
    return (
      <span
        className="rules-sidebar-item-badge"
        style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}
      >
        {failed !== undefined ? (
          <Tooltip title={failed.error}>
            <WarningFilled style={{ color: token.colorError, fontSize: 11 }} />
          </Tooltip>
        ) : null}
        {remaining > 0 ? (
          <Tooltip title={t('shared.mergeEditor.fileList.hunksRemaining', { count: remaining })}>
            <span data-testid="git-conflict-tree-count" style={{ fontSize: 10, color: token.colorTextSecondary }}>
              {remaining}
            </span>
          </Tooltip>
        ) : null}
        {failed === undefined && settled ? (
          <CheckCircleFilled data-testid="git-conflict-tree-done" style={{ color: token.colorSuccess, fontSize: 11 }} />
        ) : null}
      </span>
    );
  };

  /** A row in the panels' own shape — nothing of theirs to rename, add or delete here. */
  const rowOf = (listed: WorkspaceFileSectionId, node: WorkspaceFileNode, depth: number, unfolded: boolean): TreeNode => {
    const holds = childrenOf(node).length > 0;
    return {
      id: node.id,
      kind: holds ? 'folder' : 'leaf',
      label: face.labelOf(node),
      depth,
      expandable: holds,
      icon: face.iconOf(listed, node),
      badge: unfolded ? undefined : endOf(filesUnder(node)),
      canRename: false,
      canDelete: false,
      canAddChild: false,
    };
  };

  const rows = (listed: WorkspaceFileSectionId, nodes: readonly WorkspaceFileNode[], depth: number): ReactNode[] =>
    nodes.flatMap((node) => {
      const own = fileOf(node);
      const unfolded = childrenOf(node).length > 0 && !folded.has(node.id);
      const row = (
        <TreeNodeRow
          key={node.id}
          node={rowOf(listed, node, depth, unfolded)}
          isSelected={own !== undefined && own === activeFileId}
          isFocused={false}
          isRenaming={false}
          isExpanded={unfolded}
          onClick={() => (own !== undefined ? open(own) : toggle(node.id))}
          onDoubleClick={noop}
          onStartRename={noop}
        />
      );
      return unfolded ? [row, ...rows(listed, childrenOf(node), depth + 1)] : [row];
    });

  const sectionOf = (listed: WorkspaceFileSection): ReactNode => {
    const title = face.sectionTitle(listed.id);
    const key = sectionKey(listed.id);
    // A page — the workspace's variables, the vault, the workspace, its trusted
    // certificates — is one file: a header-styled row, as its panel opens it.
    const [only] = listed.nodes;
    const page = isWorkspaceFilePage(listed.id) && only !== undefined ? fileOf(only) : undefined;
    if (only !== undefined && page !== undefined) {
      return (
        <SectionOpenerRow
          key={key}
          title={title}
          node={{ ...rowOf(listed.id, only, 0, false), onOpen: () => open(page) }}
          selected={page === activeFileId}
          actions={endOf([page])}
        />
      );
    }
    const unfolded = !folded.has(key);
    return (
      <Fragment key={key}>
        <SectionHeader
          title={title}
          expanded={unfolded}
          onToggle={() => toggle(key)}
          actions={unfolded ? undefined : endOf(listed.nodes.flatMap(filesUnder))}
          testid={`git-conflict-tree-section-${listed.id}`}
        />
        {unfolded ? rows(listed.id, listed.nodes, 0) : null}
      </Fragment>
    );
  };

  const flyout = section !== undefined;
  return (
    <div
      ref={hostRef}
      className={`rules-sidebar-content git-conflict-tree${listing ? ' git-conflict-tree--listing' : ''}`}
      data-testid="git-conflict-tree"
      style={
        listing
          ? { maxHeight: 220 }
          : flyout
            ? { maxHeight: 360 }
            : {
              height: '100%',
              boxSizing: 'border-box',
              padding: '4px 0',
              background: token.colorFillTertiary,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
            }
      }
    >
      {tree.filter((listed) => !flyout || listed.surface === section).map(sectionOf)}
    </div>
  );
};

export default ConflictTree;

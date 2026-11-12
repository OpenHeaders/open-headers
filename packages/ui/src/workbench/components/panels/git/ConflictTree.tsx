/**
 * ConflictTree — the merge editor's files panel for a conflicted pass,
 * drawn as the workbench's own panels draw what the files belong to:
 * the sections a surface's panel shows (REQUESTS, SPECS, RULES,
 * ENVIRONMENTS, …) with the panel's own header, one after another in
 * the surfaces' order, and under a section the collections, folders and
 * entities in the panel's own rows — the same caret, icon and name
 * (`sidebar/TreeNodeRow`, `sidebar/SectionHeader`). The surfaces
 * themselves are the strip's chips beside the panel, which mark the
 * open file's; no row here names one. `commit-conflict-tree` is the
 * listing.
 *
 * A row that stands for one conflicted file opens it; any other folds
 * and unfolds. A file's row ends in what it has left to answer, or a
 * check once nothing is; a folded row or section shows the count of
 * everything under it. The open file's row is unfolded to and kept in
 * view, and wears the one selection blue (`styles/panels.less`).
 *
 * Handed one `section` (a surface), it lists that surface alone — the
 * strip's flyout while the panel is shut. As a `listing` it names the
 * files and opens none — the step before the editor (`ConflictFilesTree`).
 */

import { CheckCircleFilled, FileTextOutlined, FolderOpenOutlined, FolderOutlined, WarningFilled } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type {
  ConflictLeafNode,
  ConflictNode,
  ConflictSection,
  ConflictSectionId,
} from '@openheaders/ui/shared/conflicts/commit-conflict-tree';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import type { MergeFilesPanelProps } from '@openheaders/ui/shared/merge-editor';
import { Tooltip, theme } from 'antd';
import { Fragment, type ReactElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildRuleIcon } from '../../shared/rule-icon';
import { scopeBadge } from '../../shared/scope-colors';
import { renderTwoToneIcon } from '../../shared/TwoToneIconPicker';
import { folderTag, graphqlTag, grpcTag, iconEl, methodTag, mqttTag, websocketTag } from '../../sidebar/icons';
import { SectionHeader, SectionOpenerRow } from '../../sidebar/SectionHeader';
import { TreeNodeRow } from '../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../sidebar/types';
import { FileTypeIcon } from './commit/FileTypeIcon';
import { conflictEntityName, conflictPartLabel } from './use-conflict-tree';

export interface ConflictTreeProps extends MergeFilesPanelProps {
  tree: readonly ConflictSection[];
  /** Name the files only: nothing is open, and a file's row opens nothing. */
  listing?: boolean;
}

const SECTION_TITLES: Readonly<Record<ConflictSectionId, MessageKey>> = {
  rules: 'workbench.sidebar.section.rules',
  templates: 'workbench.sidebar.section.templates',
  requests: 'workbench.sidebar.section.requests',
  specs: 'workbench.sidebar.section.specs',
  workflows: 'workbench.sidebar.section.workflows',
  'workspace-variables': 'workbench.sidebar.section.workspaceVariables',
  'live-variables': 'workbench.sidebar.section.liveVariables',
  environments: 'workbench.sidebar.section.environments',
  files: 'workbench.gitLog.resolve.otherFiles',
};

const QUIET = 'var(--ant-color-text-tertiary, #999)';

const sectionKey = (id: ConflictSectionId): string => `section:${id}`;

const noop = (): void => {};

/** The file a row opens, when it stands for one. */
function fileOf(node: ConflictNode): string | undefined {
  return node.type === 'directory' ? undefined : node.file;
}

function childrenOf(node: ConflictNode): readonly ConflictNode[] {
  return node.type === 'entity' || node.type === 'directory' ? node.children : [];
}

/** Every file at or under a row. */
function filesUnder(node: ConflictNode): string[] {
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
  const { rules } = useRules();
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
    const visit = (nodes: readonly ConflictNode[], trail: string[]): void => {
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

  const leafIcon = (node: ConflictLeafNode): ReactNode => {
    switch (node.type) {
      case 'request':
        return methodTag(node.method);
      case 'graphql-request':
        return graphqlTag();
      case 'grpc-request':
        return grpcTag();
      case 'websocket-request':
        return websocketTag(node.flavor);
      case 'mqtt-request':
        return mqttTag();
      case 'rule':
        return buildRuleIcon({
          ruleType: node.ruleType,
          rule: rules.find((rule) => rule.uid === node.uid),
          isActive: node.enabled,
        });
      case 'template':
        return renderTwoToneIcon(node.icon, { fontSize: 12 }) || iconEl(FileTextOutlined, QUIET);
    }
  };

  const iconOf = (listed: ConflictSectionId, node: ConflictNode): ReactNode => {
    if (node.type === 'directory') return iconEl(FolderOutlined, QUIET);
    if (node.type !== 'entity') return <FileTypeIcon path={node.file} />;
    const { entity } = node;
    switch (entity.kind) {
      case 'collection':
        return iconEl(FolderOpenOutlined, QUIET);
      case 'folder':
        return listed === 'requests' ? folderTag(FolderOutlined) : iconEl(FolderOutlined, QUIET);
      case 'node':
        return leafIcon(entity.node);
      case 'spec':
        return iconEl(FileTextOutlined, QUIET);
      case 'workflow':
        return (
          <span
            style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: QUIET, marginRight: 2 }}
          />
        );
      case 'live-variable':
        return scopeBadge('live');
      case 'environment':
        return scopeBadge('environment');
      case 'workspace-variables':
        return scopeBadge('workspace');
    }
  };

  const labelOf = (node: ConflictNode): string => {
    if (node.type === 'entity') return conflictEntityName(t, node.entity);
    if (node.type === 'part') return conflictPartLabel(t, node.part, node.name);
    return node.type === 'directory' ? node.path : node.name;
  };

  /** A row in the panels' own shape — nothing of theirs to rename, add or delete here. */
  const rowOf = (listed: ConflictSectionId, node: ConflictNode, depth: number, unfolded: boolean): TreeNode => {
    const holds = childrenOf(node).length > 0;
    return {
      id: node.id,
      kind: holds ? 'folder' : 'leaf',
      label: labelOf(node),
      depth,
      expandable: holds,
      icon: iconOf(listed, node),
      badge: unfolded ? undefined : endOf(filesUnder(node)),
      canRename: false,
      canDelete: false,
      canAddChild: false,
    };
  };

  const rows = (listed: ConflictSectionId, nodes: readonly ConflictNode[], depth: number): ReactNode[] =>
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

  const sectionOf = (listed: ConflictSection): ReactNode => {
    const title = t(SECTION_TITLES[listed.id]);
    const key = sectionKey(listed.id);
    // The workspace's variables are one page: its panel opens it from a header-styled row.
    const [only] = listed.nodes;
    const page = listed.id === 'workspace-variables' && only !== undefined ? fileOf(only) : undefined;
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

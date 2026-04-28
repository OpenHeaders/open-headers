/**
 * Left rail of the import-preview — mirrors the workspace sidebar:
 * collapsible section headers (RULES / API REQUESTS / TEMPLATES /
 * ENVIRONMENTS / LIVE WORKFLOWS / LIVE VARIABLES / WORKSPACE VARIABLES /
 * VAULT) with nested collection→folder→entity trees for the first
 * three. Each row carries a status dot (collision tone) and a
 * tabular `+a / -r` line-count chip when there's drift to review.
 *
 * Selection state lives one level up; this component just renders the
 * tree and dispatches click events.
 */

import {
  ApiOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  SisternodeOutlined,
} from '@ant-design/icons';
import type { CollisionStrategy, StrategyMap } from '@openheaders/core/workspace-export';
import { Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useSetting } from '@/workbench/settings';
import { scopeBadge } from '../../shared/scope-colors';
import { type ImportTaxonomy, type MaterialisedRow, SECTIONS, type SectionKind, strategyForRow } from './diff-sections';
import { STRATEGY_META } from './strategy-meta';

interface DiffSidebarProps {
  taxonomy: ImportTaxonomy;
  selectionKey: string | null;
  onSelect: (key: string) => void;
  lineCounts: Map<string, { added: number; removed: number }>;
  strategies: StrategyMap;
  /** Short summary line (e.g. "1 rule, 5 envs") shown at the very top
   *  of the sidebar, above the entity tree. Mirrors how a workspace
   *  sidebar surfaces its own counts header. */
  summary?: string;
}

const DiffSidebar: React.FC<DiffSidebarProps> = ({
  taxonomy,
  selectionKey,
  onSelect,
  lineCounts,
  strategies,
  summary,
}) => {
  const { token } = theme.useToken();

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({ section: s, rows: taxonomy.bySection.get(s.kind) ?? [] })).filter(
        (s) => s.rows.length > 0,
      ),
    [taxonomy],
  );

  // Sections collapsed state — default open for non-empty sections.
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsedNodes, setCollapsedNodes] = useState<ReadonlySet<string>>(() => new Set());

  // Per-row strategy chip visibility — persisted via the project's
  // settings store (registered in `schema/workspace-sharing.ts`).
  const [showStrategy, setShowStrategy] = useSetting('workspaceSharing.importPreviewShowMergeStrategy');

  const toggleSection = (kind: string): void => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const toggleNode = (key: string): void => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Same `colorBgContainer` white as the diff pane card — the
        // sidebar is a peer dock panel, not a chrome strip, so it
        // shares the surface colour with every other pane. The 6 px
        // gray gutter from the parent's `paneCardWrapper` padding is
        // what visually separates this panel from its neighbours; no
        // border-right needed.
        background: token.colorBgContainer,
        overflow: 'hidden',
        fontFeatureSettings: '"tnum" 1',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
          minHeight: 28,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: token.colorTextSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          {summary ?? ''}
        </span>
        <Tooltip title={showStrategy ? 'Hide merge strategy on rows' : 'Show merge strategy on rows'}>
          <button
            type="button"
            onClick={() => setShowStrategy(!showStrategy)}
            aria-label={showStrategy ? 'Hide merge strategy' : 'Show merge strategy'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: showStrategy ? token.colorPrimary : token.colorTextTertiary,
              padding: 0,
              fontFamily: 'inherit',
              borderRadius: 4,
            }}
          >
            {showStrategy ? (
              <EyeOutlined style={{ fontSize: 12 }} />
            ) : (
              <EyeInvisibleOutlined style={{ fontSize: 12 }} />
            )}
          </button>
        </Tooltip>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
        {sections.map(({ section, rows }) => {
          const collapsed = collapsedSections.has(section.kind);
          const totalRows = countLeafRows(rows);
          const headerIcon = sectionHeaderIcon(section.kind);
          return (
            <div key={section.kind} style={{ marginBottom: 8, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => toggleSection(section.kind)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px 6px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  color: token.colorTextTertiary,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                {collapsed ? (
                  <CaretRightOutlined style={{ fontSize: 9 }} />
                ) : (
                  <CaretDownOutlined style={{ fontSize: 9 }} />
                )}
                {headerIcon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{headerIcon}</span>}
                <span style={{ flex: 1 }}>{section.label}</span>
                <span style={{ fontWeight: 500 }}>{totalRows}</span>
              </button>
              {!collapsed &&
                rows.map((row) => (
                  <TreeRowView
                    key={row.selectionKey}
                    row={row}
                    selectionKey={selectionKey}
                    onSelect={onSelect}
                    lineCounts={lineCounts}
                    strategies={strategies}
                    collapsedNodes={collapsedNodes}
                    onToggleNode={toggleNode}
                    showStrategy={showStrategy}
                    token={token}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiffSidebar;

function countLeafRows(rows: MaterialisedRow[]): number {
  let n = 0;
  for (const r of rows) {
    if (r.rowKind === 'entity') n += 1;
    n += countLeafRows(r.children);
  }
  return n;
}

interface TreeRowViewProps {
  row: MaterialisedRow;
  selectionKey: string | null;
  onSelect: (k: string) => void;
  lineCounts: Map<string, { added: number; removed: number }>;
  strategies: StrategyMap;
  collapsedNodes: ReadonlySet<string>;
  onToggleNode: (k: string) => void;
  showStrategy: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
}

const TreeRowView: React.FC<TreeRowViewProps> = ({
  row,
  selectionKey,
  onSelect,
  lineCounts,
  strategies,
  collapsedNodes,
  onToggleNode,
  showStrategy,
  token,
}) => {
  const collapsed = collapsedNodes.has(row.selectionKey);
  const hasChildren = row.children.length > 0;
  return (
    <>
      <RowButton
        row={row}
        selected={row.selectionKey === selectionKey}
        onSelect={onSelect}
        lineCounts={lineCounts.get(row.selectionKey)}
        strategy={strategyForRow(strategies, row)}
        collapsed={collapsed}
        hasChildren={hasChildren}
        onToggle={() => onToggleNode(row.selectionKey)}
        showStrategy={showStrategy}
        token={token}
      />
      {hasChildren &&
        !collapsed &&
        row.children.map((child) => (
          <TreeRowView
            key={child.selectionKey}
            row={child}
            selectionKey={selectionKey}
            onSelect={onSelect}
            lineCounts={lineCounts}
            strategies={strategies}
            collapsedNodes={collapsedNodes}
            onToggleNode={onToggleNode}
            showStrategy={showStrategy}
            token={token}
          />
        ))}
    </>
  );
};

interface RowButtonProps {
  row: MaterialisedRow;
  selected: boolean;
  onSelect: (k: string) => void;
  lineCounts: { added: number; removed: number } | undefined;
  strategy: CollisionStrategy;
  collapsed: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  showStrategy: boolean;
  token: ReturnType<typeof theme.useToken>['token'];
}

const RowButton: React.FC<RowButtonProps> = ({
  row,
  selected,
  onSelect,
  lineCounts,
  strategy,
  collapsed,
  hasChildren,
  onToggle,
  showStrategy,
  token,
}) => {
  const meta = STRATEGY_META[strategy];
  const skipped = strategy === 'skip';
  const stateDot =
    row.state === 'no-collision'
      ? token.colorSuccess
      : row.state === 'collision-uid'
        ? token.colorPrimary
        : token.colorWarning;
  const indent = 8 + row.depth * 14;
  const iconNode = pickIcon(row, collapsed);
  const [hover, setHover] = useState(false);
  const background = selected ? token.colorPrimaryBg : hover ? token.colorFillTertiary : 'transparent';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        paddingLeft: indent,
        paddingRight: 10,
        background,
        opacity: skipped ? 0.65 : 1,
        transition: 'background 120ms',
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 22,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: token.colorTextTertiary,
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          {collapsed ? <CaretRightOutlined style={{ fontSize: 9 }} /> : <CaretDownOutlined style={{ fontSize: 9 }} />}
        </button>
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} />
      )}
      <button
        type="button"
        onClick={() => onSelect(row.selectionKey)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          padding: '4px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: skipped ? token.colorTextTertiary : token.colorText,
          fontSize: 12,
          textAlign: 'left',
        }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 7, background: stateDot, flexShrink: 0 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: token.colorTextSecondary }}>
          {iconNode}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: skipped ? 'line-through' : undefined,
          }}
        >
          {row.name}
        </span>
        {row.divergedFromExport && (
          <span title="Edited locally since this export was made" style={{ fontSize: 10, color: token.colorWarning }}>
            edited
          </span>
        )}
        {lineCounts && (lineCounts.added > 0 || lineCounts.removed > 0) && (
          <span
            style={{
              fontSize: 10,
              fontVariantNumeric: 'tabular-nums',
              color: token.colorTextTertiary,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {lineCounts.added > 0 && <span style={{ color: token.colorSuccess }}>+{lineCounts.added}</span>}
            {lineCounts.added > 0 && lineCounts.removed > 0 ? ' ' : ''}
            {lineCounts.removed > 0 && <span style={{ color: token.colorError }}>−{lineCounts.removed}</span>}
          </span>
        )}
        {showStrategy && (
          <span
            style={{
              fontSize: 10,
              color:
                meta.tone === 'warn'
                  ? token.colorWarning
                  : meta.tone === 'accent'
                    ? token.colorPrimary
                    : token.colorTextTertiary,
              flexShrink: 0,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {row.state === 'no-collision' && strategy === 'new-uid' ? 'new' : meta.label.toLowerCase()}
          </span>
        )}
      </button>
    </div>
  );
};

function pickIcon(row: MaterialisedRow, collapsed: boolean): React.ReactNode {
  if (row.rowKind === 'collection' || row.rowKind === 'folder') {
    const Icon = collapsed ? FolderOutlined : FolderOpenOutlined;
    return <Icon style={{ fontSize: 12, color: 'var(--scope-fallback-color, #888)' }} />;
  }
  // Entity row — use scope badges for variable-like entities, plain
  // file glyph for rules/requests/templates so the row reads at a
  // glance the same way it does in the workspace sidebar.
  switch (row.entityKind) {
    case 'environment':
      return scopeBadge('environment', 14);
    case 'liveVariable':
      return scopeBadge('live', 14);
    case 'liveWorkflow':
      return <SisternodeOutlined style={{ fontSize: 12 }} />;
    case 'workspaceVars':
      return scopeBadge('workspace', 14);
    case 'vault':
      return scopeBadge('vault', 14);
    default:
      return <FileOutlined style={{ fontSize: 12 }} />;
  }
}

function sectionHeaderIcon(kind: SectionKind): React.ReactNode {
  switch (kind) {
    case 'rules':
      return <FileTextOutlined style={{ fontSize: 12 }} />;
    case 'requests':
      return <ApiOutlined style={{ fontSize: 12 }} />;
    case 'liveWorkflows':
      return <SisternodeOutlined style={{ fontSize: 12 }} />;
    case 'environments':
      return scopeBadge('environment', 12);
    case 'liveVariables':
      return scopeBadge('live', 12);
    case 'workspaceVars':
      return scopeBadge('workspace', 12);
    case 'vault':
      return scopeBadge('vault', 12);
    default:
      return null;
  }
}

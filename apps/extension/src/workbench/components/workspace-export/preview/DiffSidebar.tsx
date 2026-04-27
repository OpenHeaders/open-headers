/**
 * Left rail of the diff workspace — sectioned entity tree with status
 * dots, tabular `+a / -r` line counts, and a strategy hint per row.
 * Selecting a row swaps the right pane to that entity's diff.
 */

import type { CollisionStrategy, StrategyMap } from '@openheaders/core/workspace-export';
import { theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { type MaterialisedRow, SECTIONS, type SectionDef, strategyForRow } from './diff-sections';
import { STRATEGY_META } from './strategy-meta';

interface DiffSidebarProps {
  rows: MaterialisedRow[];
  selectionKey: string | null;
  onSelect: (key: string) => void;
  lineCounts: Map<string, { added: number; removed: number }>;
  strategies: StrategyMap;
}

const DiffSidebar: React.FC<DiffSidebarProps> = ({ rows, selectionKey, onSelect, lineCounts, strategies }) => {
  const { token } = theme.useToken();

  const grouped = useMemo(() => {
    const out: { section: SectionDef; rows: MaterialisedRow[] }[] = [];
    for (const section of SECTIONS) {
      const sectionRows = rows.filter((r) => r.section.kind === section.kind);
      if (sectionRows.length === 0) continue;
      out.push({ section, rows: sectionRows });
    }
    return out;
  }, [rows]);

  return (
    <div
      style={{
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        overflowY: 'auto',
        padding: '8px 0',
        fontFeatureSettings: '"tnum" 1',
      }}
    >
      {grouped.map(({ section, rows: sectionRows }) => (
        <div key={section.kind} style={{ marginBottom: 12 }}>
          <div
            style={{
              padding: '4px 16px 6px',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: token.colorTextTertiary,
            }}
          >
            {section.label} · {sectionRows.length}
          </div>
          {sectionRows.map((row) => (
            <SidebarRow
              key={row.selectionKey}
              row={row}
              selected={row.selectionKey === selectionKey}
              onSelect={onSelect}
              lineCounts={lineCounts.get(row.selectionKey)}
              strategy={strategyForRow(strategies, row)}
              token={token}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default DiffSidebar;

const SidebarRow: React.FC<{
  row: MaterialisedRow;
  selected: boolean;
  onSelect: (k: string) => void;
  lineCounts: { added: number; removed: number } | undefined;
  strategy: CollisionStrategy;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ row, selected, onSelect, lineCounts, strategy, token }) => {
  const stateDot =
    row.state === 'no-collision'
      ? token.colorSuccess
      : row.state === 'collision-uid'
        ? token.colorPrimary
        : token.colorWarning;
  const meta = STRATEGY_META[strategy];
  const skipped = strategy === 'skip';
  return (
    <button
      type="button"
      onClick={() => onSelect(row.selectionKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 16px',
        fontSize: 12,
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        outline: 'none',
        background: selected ? token.colorPrimaryBg : 'transparent',
        color: skipped ? token.colorTextTertiary : token.colorText,
        fontFamily: 'inherit',
        opacity: skipped ? 0.65 : 1,
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = token.colorFillTertiary;
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: 7,
          background: stateDot,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
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
          }}
        >
          {lineCounts.added > 0 && <span style={{ color: token.colorSuccess }}>+{lineCounts.added}</span>}
          {lineCounts.added > 0 && lineCounts.removed > 0 ? ' ' : ''}
          {lineCounts.removed > 0 && <span style={{ color: token.colorError }}>−{lineCounts.removed}</span>}
        </span>
      )}
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
        }}
      >
        {row.state === 'no-collision' && strategy === 'new-uid' ? 'new' : meta.label.toLowerCase()}
      </span>
    </button>
  );
};

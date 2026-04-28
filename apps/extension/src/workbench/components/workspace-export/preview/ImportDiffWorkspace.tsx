/**
 * Five-region diff workspace for the import-preview modal — mirrors the
 * IDE workspace shell pattern with activity bars on both edges:
 *
 *   ┌────┬───────────┬──────────────────┬───────────┬────┐
 *   │ ▣ │ Sidebar    │  Diff pane       │ Advanced  │ ⚙ │
 *   │ rl │ (entities) │  (Monaco diff)   │ (toggles) │ rl │
 *   └────┴───────────┴──────────────────┴───────────┴────┘
 *
 * The activity rails are reused from the workspace's `ActivityBar`
 * (compact / icons-only ⇒ 36 px wide). Each rail has one tool-window
 * icon: the left rail toggles the entity tree, the right rail toggles
 * the Advanced panel. Identical interaction model to the workspace
 * shell — click the icon to show / hide its panel — just scoped to
 * the modal and without dock-and-drop.
 *
 * The middle three regions remain an `Allotment`, so the user can
 * still resize sidebar ⇄ diff ⇄ advanced. Sidebar visibility is now
 * controlled by the rail rather than by snap-to-zero, so closing it
 * collapses the pane out of the layout entirely (no leftover handle).
 */

import { AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import {
  type CollisionStrategy,
  type DiffResult,
  type StrategyMap,
  serializeEntityYaml,
} from '@openheaders/core/workspace-export';
import { Allotment, LayoutPriority } from 'allotment';
import { Empty, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import ActivityBar, { type ActivityBarItem } from '@/workbench/components/ActivityBar';
import AdvancedPanel, { type AdvancedPanelProps } from './AdvancedPanel';
import DiffPane from './DiffPane';
import DiffSidebar from './DiffSidebar';
import { buildTaxonomy, type MaterialisedRow, strategyForRow } from './diff-sections';
import { diffLineCounts } from './diff-stats';

// Sidebar sizing — mirrors the workspace shell's pattern in
// `useResponsiveLayout.ts`: 20% of viewport, clamped 180–400px,
// `proportionalLayout: false` + `LayoutPriority` so the diff pane
// (high priority) absorbs every extra pixel and the sidebar stays at
// its preferred width regardless of modal-width changes.
const SIDEBAR_MIN_PX = 180;
const SIDEBAR_MAX_PX = 400;
const SIDEBAR_PREFERRED_PX = (() => {
  if (typeof window === 'undefined') return 280;
  const target = Math.round(window.innerWidth * 0.2);
  return Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, target));
})();

interface ImportDiffWorkspaceProps {
  diff: DiffResult;
  /** The (possibly decrypted) incoming envelope — used to resolve the
   *  incoming side of singleton rows. */
  incomingEntities: {
    workspaceVars: unknown;
    vault: unknown;
  };
  strategies: StrategyMap;
  onChangeStrategy: (kind: keyof StrategyMap, uid: string, value: CollisionStrategy) => void;
  /** When provided, an Advanced panel is rendered as a third column
   *  with a collapse handle. Omit to render only the two-pane layout. */
  advanced?: Omit<AdvancedPanelProps, 'open' | 'onToggle'>;
  /** Short summary line passed straight through to the sidebar's header
   *  (e.g. "1 rule, 5 envs"). */
  summary?: string;
}

const ImportDiffWorkspace: React.FC<ImportDiffWorkspaceProps> = ({
  diff,
  incomingEntities,
  strategies,
  onChangeStrategy,
  advanced,
  summary,
}) => {
  const { token } = theme.useToken();

  const taxonomy = useMemo(() => buildTaxonomy(diff, incomingEntities), [diff, incomingEntities]);
  const allRows = taxonomy.allRows;

  const [selectionKey, setSelectionKey] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Default-select the first interesting row (first collision; falls
  // back to the first row regardless of state).
  useEffect(() => {
    if (selectionKey && allRows.some((r) => r.selectionKey === selectionKey)) return;
    const firstCollision = allRows.find((r) => r.state !== 'no-collision' && r.rowKind === 'entity');
    const firstAny = allRows.find((r) => r.rowKind === 'entity');
    setSelectionKey(firstCollision?.selectionKey ?? firstAny?.selectionKey ?? null);
  }, [allRows, selectionKey]);

  const yamlByKey = useMemo(() => {
    const out = new Map<string, { targetYaml: string; incomingYaml: string }>();
    for (const row of allRows) {
      out.set(row.selectionKey, {
        targetYaml: row.target ? serializeEntityYaml(row.entityKind, row.target) : '',
        incomingYaml: row.entity ? serializeEntityYaml(row.entityKind, row.entity) : '',
      });
    }
    return out;
  }, [allRows]);

  const lineCountsByKey = useMemo(() => {
    const out = new Map<string, ReturnType<typeof diffLineCounts>>();
    for (const row of allRows) {
      const pair = yamlByKey.get(row.selectionKey);
      if (!pair) continue;
      out.set(row.selectionKey, diffLineCounts(pair.targetYaml, pair.incomingYaml));
    }
    return out;
  }, [allRows, yamlByKey]);

  const selectedRow: MaterialisedRow | null = useMemo(
    () => allRows.find((r) => r.selectionKey === selectionKey) ?? null,
    [allRows, selectionKey],
  );

  // ── Activity-bar items ──────────────────────────────────────────────
  const leftItems: ActivityBarItem[] = useMemo(
    () => [
      {
        key: 'entities',
        icon: <AppstoreOutlined />,
        label: 'Entities',
        enabled: true,
        active: sidebarOpen,
        focused: false,
        tooltip: sidebarOpen ? 'Hide entities panel' : 'Show entities panel',
        onActivate: () => setSidebarOpen((v) => !v),
      },
    ],
    [sidebarOpen],
  );

  const rightItems: ActivityBarItem[] = useMemo(
    () =>
      advanced
        ? [
            {
              key: 'advanced',
              icon: <SettingOutlined />,
              label: 'Advanced',
              enabled: true,
              active: advancedOpen,
              focused: false,
              tooltip: advancedOpen ? 'Hide advanced panel' : 'Show advanced panel',
              onActivate: () => setAdvancedOpen((v) => !v),
            },
          ]
        : [],
    [advanced, advancedOpen],
  );

  if (allRows.length === 0) {
    return <Empty description="Nothing to import" style={{ padding: 32 }} />;
  }

  const showAdvanced = !!(advanced && advancedOpen);

  // Activity rails sit at the OUTER edges of this component (flush
  // with the modal's left/right body edges). The sash-resizable
  // sidebar / diff / advanced panes live inside an inner rounded
  // white card with a 3 px gutter on top/bottom and on the central-
  // card sides — same `.rules-dock-body` margin pattern as the
  // workspace shell. With rails outside the card, the card's rounded
  // corners are unobstructed (previously the gray rails covered the
  // corner area, hiding the rounding).
  //
  // The inline `--focus-border: transparent` cascade kills allotment's
  // default blue (#007fd4) sash-hover highlight inside this subtree,
  // matching the workspace's neutral resize handles. Scoped via
  // inline style instead of a global CSS rule so the workspace's own
  // dock layout keeps its hover affordance untouched.
  return (
    <div
      style={
        {
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          '--focus-border': 'transparent',
        } as React.CSSProperties
      }
    >
      <ActivityBar
        side="left"
        topItems={leftItems}
        labelsVisible={false}
        // Labels stay icons-only inside the modal; the right-click
        // toggle is wired but no-ops since there is nothing to persist.
        onToggleLabels={() => undefined}
      />
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, padding: 3 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            background: token.colorBgContainer,
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Allotment
            proportionalLayout={false}
            onVisibleChange={(index, visible) => {
              if (index === 0) setSidebarOpen(visible);
              else if (index === 2) setAdvancedOpen(visible);
            }}
          >
            <Allotment.Pane
              preferredSize={SIDEBAR_PREFERRED_PX}
              minSize={SIDEBAR_MIN_PX}
              maxSize={SIDEBAR_MAX_PX}
              priority={LayoutPriority.Low}
              visible={sidebarOpen}
              snap
            >
              <DiffSidebar
                taxonomy={taxonomy}
                selectionKey={selectionKey}
                onSelect={setSelectionKey}
                lineCounts={lineCountsByKey}
                strategies={strategies}
                summary={summary}
              />
            </Allotment.Pane>
            <Allotment.Pane priority={LayoutPriority.High} minSize={360}>
              <DiffPane
                row={selectedRow}
                yaml={selectedRow ? yamlByKey.get(selectedRow.selectionKey) : undefined}
                currentStrategy={selectedRow ? strategyForRow(strategies, selectedRow) : 'skip'}
                onChangeStrategy={(s) => {
                  if (!selectedRow) return;
                  const uidKey = selectedRow.section.singleton
                    ? 'singleton'
                    : ((selectedRow.entity as { uid: string })?.uid ?? '');
                  onChangeStrategy(selectedRow.section.strategyKey, uidKey, s);
                }}
              />
            </Allotment.Pane>
            <Allotment.Pane preferredSize={360} minSize={260} priority={LayoutPriority.Low} visible={showAdvanced} snap>
              {advanced && <AdvancedPanel {...advanced} open={advancedOpen} onToggle={() => setAdvancedOpen(false)} />}
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
      {advanced ? (
        <ActivityBar side="right" topItems={rightItems} labelsVisible={false} onToggleLabels={() => undefined} />
      ) : null}
    </div>
  );
};

export default ImportDiffWorkspace;

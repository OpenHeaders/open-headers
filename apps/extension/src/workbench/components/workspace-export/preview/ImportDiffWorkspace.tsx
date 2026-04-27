/**
 * Three-column diff workspace for the import-preview modal.
 *
 *   ┌──────────────────┬──────────────────────────┬──────────────────┐
 *   │  Sidebar         │  Diff pane               │  Advanced (opt)  │
 *   │  (entity tree)   │  (Monaco DiffEditor)     │  (toggles)       │
 *   └──────────────────┴──────────────────────────┴──────────────────┘
 *
 * Sidebar mirrors the workspace sidebar (sections + nested
 * collection→folder→entity trees) so the user navigates the export
 * with the same mental model they already use. Diff pane shows target
 * vs incoming for the selected node, serialized through canonical
 * field-order so the diff highlights real drift, not key-order churn.
 * Advanced is a togglable third column — collapsed by default,
 * expanding it reveals the §5.5 override toggles inline so the user
 * can flip them and watch the diff respond live.
 */

import {
  type CollisionStrategy,
  type DiffResult,
  type StrategyMap,
  serializeEntityYaml,
} from '@openheaders/core/workspace-export';
import { Allotment } from 'allotment';
import { Empty, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import AdvancedPanel, { type AdvancedPanelProps } from './AdvancedPanel';
import DiffPane from './DiffPane';
import DiffSidebar from './DiffSidebar';
import { buildTaxonomy, type MaterialisedRow, strategyForRow } from './diff-sections';
import { diffLineCounts } from './diff-stats';

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
}

const ImportDiffWorkspace: React.FC<ImportDiffWorkspaceProps> = ({
  diff,
  incomingEntities,
  strategies,
  onChangeStrategy,
  advanced,
}) => {
  const { token } = theme.useToken();

  const taxonomy = useMemo(() => buildTaxonomy(diff, incomingEntities), [diff, incomingEntities]);
  const allRows = taxonomy.allRows;

  const [selectionKey, setSelectionKey] = useState<string | null>(null);
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

  if (allRows.length === 0) {
    return <Empty description="Nothing to import" style={{ padding: 32 }} />;
  }

  const showAdvanced = !!(advanced && advancedOpen);

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        overflow: 'hidden',
        background: token.colorBgContainer,
      }}
    >
      <Allotment>
        <Allotment.Pane preferredSize="30%" minSize={220}>
          <DiffSidebar
            taxonomy={taxonomy}
            selectionKey={selectionKey}
            onSelect={setSelectionKey}
            lineCounts={lineCountsByKey}
            strategies={strategies}
          />
        </Allotment.Pane>
        <Allotment.Pane preferredSize="70%" minSize={360}>
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
            advancedTrigger={
              advanced
                ? { open: advancedOpen, onToggle: () => setAdvancedOpen((v) => !v), activeCount: advanced.activeCount }
                : null
            }
          />
        </Allotment.Pane>
        <Allotment.Pane preferredSize={360} minSize={260} visible={showAdvanced}>
          {advanced && <AdvancedPanel {...advanced} open={advancedOpen} onToggle={() => setAdvancedOpen(false)} />}
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};

export default ImportDiffWorkspace;

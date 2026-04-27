/**
 * Two-pane diff workspace for the import-preview modal.
 *
 * Left rail (DiffSidebar) = entity tree grouped by section. Right pane
 * (DiffPane) = Monaco DiffEditor comparing target vs incoming serialized
 * through the same canonical field-order so the diff highlights actual
 * content drift, not key-order churn. Strategy lives at the row level
 * via a segmented control.
 *
 * This file owns: row materialisation, YAML serialization, line-count
 * memoization, default selection, and the strategy-change plumbing back
 * up to the parent. Visual concerns live in `DiffSidebar` / `DiffPane`.
 */

import {
  type CollisionStrategy,
  type DiffResult,
  type StrategyMap,
  serializeEntityYaml,
} from '@openheaders/core/workspace-export';
import { Empty, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import DiffPane from './DiffPane';
import DiffSidebar from './DiffSidebar';
import { type MaterialisedRow, rowsForSection, SECTIONS, strategyForRow } from './diff-sections';
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
}

const ImportDiffWorkspace: React.FC<ImportDiffWorkspaceProps> = ({
  diff,
  incomingEntities,
  strategies,
  onChangeStrategy,
}) => {
  const { token } = theme.useToken();

  const allRows = useMemo<MaterialisedRow[]>(() => {
    const out: MaterialisedRow[] = [];
    for (const section of SECTIONS) {
      const rows = rowsForSection(section, diff);
      // Patch in incoming for singletons (rowsForSection doesn't see the envelope).
      for (const r of rows) {
        if (section.singleton) {
          r.entity = section.kind === 'workspaceVars' ? incomingEntities.workspaceVars : incomingEntities.vault;
        }
        out.push(r);
      }
    }
    return out;
  }, [diff, incomingEntities]);

  const [selectionKey, setSelectionKey] = useState<string | null>(null);

  // Default-select the first interesting row (first collision; falls
  // back to the first row regardless of state).
  useEffect(() => {
    if (selectionKey && allRows.some((r) => r.selectionKey === selectionKey)) return;
    const firstCollision = allRows.find((r) => r.state !== 'no-collision');
    const fallback = allRows[0];
    setSelectionKey(firstCollision?.selectionKey ?? fallback?.selectionKey ?? null);
  }, [allRows, selectionKey]);

  const yamlByKey = useMemo(() => {
    const out = new Map<string, { targetYaml: string; incomingYaml: string }>();
    for (const row of allRows) {
      out.set(row.selectionKey, {
        targetYaml: row.target ? serializeEntityYaml(row.section.entityKind, row.target) : '',
        incomingYaml: row.entity ? serializeEntityYaml(row.section.entityKind, row.entity) : '',
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

  const selectedRow = useMemo(
    () => allRows.find((r) => r.selectionKey === selectionKey) ?? null,
    [allRows, selectionKey],
  );

  if (allRows.length === 0) {
    return <Empty description="Nothing to import" style={{ padding: 32 }} />;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        height: '100%',
        minHeight: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        overflow: 'hidden',
        background: token.colorBgContainer,
      }}
    >
      <DiffSidebar
        rows={allRows}
        selectionKey={selectionKey}
        onSelect={setSelectionKey}
        lineCounts={lineCountsByKey}
        strategies={strategies}
      />
      <DiffPane
        row={selectedRow}
        yaml={selectedRow ? yamlByKey.get(selectedRow.selectionKey) : undefined}
        currentStrategy={selectedRow ? strategyForRow(strategies, selectedRow) : 'skip'}
        onChangeStrategy={(s) => {
          if (!selectedRow) return;
          const uidKey = selectedRow.section.singleton ? 'singleton' : (selectedRow.entity as { uid: string }).uid;
          onChangeStrategy(selectedRow.section.strategyKey, uidKey, s);
        }}
      />
    </div>
  );
};

export default ImportDiffWorkspace;

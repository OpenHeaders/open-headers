/**
 * Two-pane diff workspace for the import-preview modal.
 *
 * Left rail = entity tree grouped by section (Rules / API Requests /
 * Templates / Environments / Variables / Live / Collections / Folders).
 * Each row shows a status dot, the entity's name, and a `+a / -r`
 * line-count chip for collision rows. Right pane = Monaco DiffEditor
 * comparing the target's existing entity (left) against what the
 * envelope carries (right), serialized through the same canonical
 * field-order so the diff highlights actual content drift, not
 * key-order churn.
 *
 * Strategy lives at the row level — each row carries its own segmented
 * control under the entity name. The pane also surfaces a concise
 * "what does this strategy mean" line so the user doesn't have to
 * memorise the matrix from §2.1.
 *
 * Visual posture: minimal chrome, tabular-nums everywhere, one accent
 * color, segmented controls instead of dropdowns. Apple HIG over
 * Bootstrap.
 */

import { useTheme } from '@context/ThemeContext';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import {
  type CollisionStrategy,
  type DiffEntry,
  type DiffResult,
  type DiffSingleton,
  type SerializableEntityKind,
  type StrategyMap,
  serializeEntityYaml,
} from '@openheaders/core/workspace-export';
import { Empty, Segmented, Tag, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RequestSummary from '../RequestSummary';
import RuleSummary from '../RuleSummary';
import { diffLineCounts } from './diff-stats';
import { STRATEGY_META } from './strategy-meta';

const { Text } = Typography;

// ── Section taxonomy ──────────────────────────────────────────────

type SectionKind =
  | 'rules'
  | 'requests'
  | 'templates'
  | 'environments'
  | 'workspaceVars'
  | 'vault'
  | 'liveWorkflows'
  | 'liveVariables'
  | 'collections-rules'
  | 'collections-requests'
  | 'collections-templates'
  | 'folders-rules'
  | 'folders-requests'
  | 'folders-templates';

interface SectionDef {
  kind: SectionKind;
  /** Short label used in the sidebar header. */
  label: string;
  /** Maps the row back to a `StrategyMap` key. */
  strategyKey: keyof StrategyMap;
  /** Type discriminator for the per-entity YAML serializer. */
  entityKind: SerializableEntityKind;
  /** True for the two singleton rows (workspaceVars / vault). */
  singleton?: boolean;
}

const SECTIONS: SectionDef[] = [
  { kind: 'rules', label: 'Rules', strategyKey: 'rules', entityKind: 'rule' },
  { kind: 'requests', label: 'API Requests', strategyKey: 'requests', entityKind: 'request' },
  { kind: 'templates', label: 'Templates', strategyKey: 'templates', entityKind: 'template' },
  { kind: 'environments', label: 'Environments', strategyKey: 'environments', entityKind: 'environment' },
  {
    kind: 'workspaceVars',
    label: 'Workspace Variables',
    strategyKey: 'workspaceVars',
    entityKind: 'workspaceVars',
    singleton: true,
  },
  { kind: 'vault', label: 'Vault', strategyKey: 'vault', entityKind: 'vault', singleton: true },
  { kind: 'liveWorkflows', label: 'Live Workflows', strategyKey: 'liveWorkflows', entityKind: 'liveWorkflow' },
  { kind: 'liveVariables', label: 'Live Variables', strategyKey: 'liveVariables', entityKind: 'liveVariable' },
  {
    kind: 'collections-rules',
    label: 'Rule Collections',
    strategyKey: 'collections',
    entityKind: 'collection',
  },
  {
    kind: 'collections-requests',
    label: 'API Request Collections',
    strategyKey: 'collections',
    entityKind: 'collection',
  },
  {
    kind: 'collections-templates',
    label: 'Template Collections',
    strategyKey: 'collections',
    entityKind: 'collection',
  },
  { kind: 'folders-rules', label: 'Rule Folders', strategyKey: 'folders', entityKind: 'folder' },
  { kind: 'folders-requests', label: 'API Request Folders', strategyKey: 'folders', entityKind: 'folder' },
  { kind: 'folders-templates', label: 'Template Folders', strategyKey: 'folders', entityKind: 'folder' },
];

// ── Row materialisation ───────────────────────────────────────────

interface MaterialisedRow {
  section: SectionDef;
  /** Stable React + selection key — `<section>:<uid>` or `<section>` for singletons. */
  selectionKey: string;
  /** Display name. Singletons get a static label. */
  name: string;
  /** Type-discriminated entity blob the YAML serializer + summaries consume. */
  entity: unknown;
  /** Target-side counterpart (only present on collisions). */
  target: unknown;
  state: 'no-collision' | 'collision-uid' | 'collision-name';
  divergedFromExport: boolean;
  defaultStrategy: CollisionStrategy;
  allowedStrategies: readonly CollisionStrategy[];
}

function pathTreePrefix(entity: unknown): string {
  if (!entity || typeof entity !== 'object') return '';
  const path = (entity as { path?: string }).path ?? '';
  return path.split('/')[0] ?? '';
}

function rowsForSection(section: SectionDef, diff: DiffResult): MaterialisedRow[] {
  const wrap = <T extends { uid: string; name: string }>(
    entries: DiffEntry<T>[],
    pathFilter?: (e: T) => boolean,
  ): MaterialisedRow[] =>
    entries
      .filter((e) => (pathFilter ? pathFilter(e.entity) : true))
      .map((e) => ({
        section,
        selectionKey: `${section.kind}:${e.entity.uid}`,
        name: e.entity.name,
        entity: e.entity,
        target: e.matchedTarget ?? null,
        state: e.state,
        divergedFromExport: !!e.divergedFromExport,
        defaultStrategy: e.defaultStrategy,
        allowedStrategies: e.allowedStrategies,
      }));

  switch (section.kind) {
    case 'rules':
      return wrap(diff.rules);
    case 'requests':
      return wrap(diff.requests);
    case 'templates':
      return wrap(diff.templates);
    case 'environments':
      return wrap(diff.environments);
    case 'liveWorkflows':
      return wrap(diff.liveWorkflows);
    case 'liveVariables':
      return wrap(diff.liveVariables);
    case 'collections-rules':
      return wrap(diff.collections, (c) => pathTreePrefix(c) === 'rules');
    case 'collections-requests':
      return wrap(diff.collections, (c) => pathTreePrefix(c) === 'requests');
    case 'collections-templates':
      return wrap(diff.collections, (c) => pathTreePrefix(c) === 'templates');
    case 'folders-rules':
      return wrap(diff.folders, (f) => pathTreePrefix(f) === 'rules');
    case 'folders-requests':
      return wrap(diff.folders, (f) => pathTreePrefix(f) === 'requests');
    case 'folders-templates':
      return wrap(diff.folders, (f) => pathTreePrefix(f) === 'templates');
    case 'workspaceVars': {
      const s: DiffSingleton<unknown> = diff.workspaceVars as DiffSingleton<unknown>;
      if (!s.targetHasContent && (diff.workspaceVars as DiffSingleton<{ variables: unknown[] }>) === undefined)
        return [];
      return [singletonRow(section, diff.workspaceVars, 'Workspace variables', diff)];
    }
    case 'vault': {
      const s: DiffSingleton<unknown> = diff.vault as DiffSingleton<unknown>;
      if (!s.targetHasContent && diff.vault.state === 'no-collision') return [];
      return [singletonRow(section, diff.vault, 'Vault', diff)];
    }
  }
}

function singletonRow(
  section: SectionDef,
  singleton: DiffSingleton<unknown>,
  label: string,
  _diff: DiffResult,
): MaterialisedRow {
  return {
    section,
    selectionKey: section.kind,
    name: label,
    entity: null, // resolved at render time from the envelope (parent passes incoming)
    target: singleton.target ?? null,
    state: singleton.state,
    divergedFromExport: false,
    defaultStrategy: singleton.defaultStrategy,
    allowedStrategies: singleton.allowedStrategies,
  };
}

// ── Public component ──────────────────────────────────────────────

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
  const { isDarkMode } = useTheme();

  const allRows = useMemo<MaterialisedRow[]>(() => {
    const out: MaterialisedRow[] = [];
    for (const section of SECTIONS) {
      const rows = rowsForSection(section, diff);
      // Patch in incoming for singletons (rowsForSection doesn't know
      // the envelope; it only sees the diff result).
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
      <Sidebar
        rows={allRows}
        selectionKey={selectionKey}
        onSelect={setSelectionKey}
        lineCounts={lineCountsByKey}
        strategies={strategies}
        token={token}
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
        token={token}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default ImportDiffWorkspace;

function strategyForRow(strategies: StrategyMap, row: MaterialisedRow): CollisionStrategy {
  const bucket = strategies[row.section.strategyKey] as Record<string, CollisionStrategy> | undefined;
  if (!bucket) return row.defaultStrategy;
  if (row.section.singleton) return bucket.singleton ?? row.defaultStrategy;
  return bucket[(row.entity as { uid: string }).uid] ?? row.defaultStrategy;
}

// ── Sidebar ───────────────────────────────────────────────────────

interface SidebarProps {
  rows: MaterialisedRow[];
  selectionKey: string | null;
  onSelect: (key: string) => void;
  lineCounts: Map<string, { added: number; removed: number }>;
  strategies: StrategyMap;
  token: ReturnType<typeof theme.useToken>['token'];
}

const Sidebar: React.FC<SidebarProps> = ({ rows, selectionKey, onSelect, lineCounts, strategies, token }) => {
  // Group rows by section in their authoritative order.
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

// ── Diff pane ─────────────────────────────────────────────────────

interface DiffPaneProps {
  row: MaterialisedRow | null;
  yaml: { targetYaml: string; incomingYaml: string } | undefined;
  currentStrategy: CollisionStrategy;
  onChangeStrategy: (s: CollisionStrategy) => void;
  token: ReturnType<typeof theme.useToken>['token'];
  isDarkMode: boolean;
}

const DiffPane: React.FC<DiffPaneProps> = ({ row, yaml, currentStrategy, onChangeStrategy, token, isDarkMode }) => {
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  const onMount = useCallback((editor: monaco.editor.IStandaloneDiffEditor, _m: Monaco) => {
    editorRef.current = editor;
  }, []);

  if (!row) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text type="secondary">Select an entity from the list to see what's changing.</Text>
      </div>
    );
  }

  const meta = STRATEGY_META[currentStrategy];
  const segmentedOptions = row.allowedStrategies.map((s) => ({
    label: STRATEGY_META[s].label,
    value: s,
  }));

  const isNew = row.state === 'no-collision';
  const showsDiff = !isNew && yaml && yaml.targetYaml !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div
        style={{
          padding: '14px 20px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Text strong style={{ fontSize: 15 }}>
            {row.name}
          </Text>
          <Tag style={{ fontSize: 10, margin: 0, fontWeight: 500 }}>{row.section.label}</Tag>
          {isNew && (
            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
              new on the target
            </Tag>
          )}
          {row.divergedFromExport && (
            <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>
              edited locally since export
            </Tag>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Segmented
            size="small"
            value={currentStrategy}
            onChange={(v) => onChangeStrategy(v as CollisionStrategy)}
            options={segmentedOptions}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {meta.description}
          </Text>
        </div>
        {row.section.entityKind === 'rule' && row.entity ? (
          <div style={{ marginTop: 2 }}>
            <RuleSummary rule={row.entity as never} />
          </div>
        ) : row.section.entityKind === 'request' && row.entity ? (
          <div style={{ marginTop: 2 }}>
            <RequestSummary request={row.entity as never} />
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {showsDiff ? (
          <DiffEditor
            original={yaml?.targetYaml ?? ''}
            modified={yaml?.incomingYaml ?? ''}
            language="yaml"
            theme={isDarkMode ? 'oh-dark' : 'oh-light'}
            onMount={onMount}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              folding: false,
              lineNumbers: 'on',
              renderOverviewRuler: false,
              scrollbar: { useShadows: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              renderLineHighlight: 'none',
              hideUnchangedRegions: { enabled: true, contextLineCount: 2 },
            }}
          />
        ) : (
          <div
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: token.colorTextTertiary,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isNew
                ? 'This entity is new — nothing on the target side to compare against.'
                : 'Nothing to diff — both sides are empty.'}
            </Text>
            {row.entity && yaml?.incomingYaml ? (
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  width: '100%',
                  maxHeight: 320,
                  overflow: 'auto',
                  background: token.colorBgLayout,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  color: token.colorText,
                }}
              >
                {yaml.incomingYaml}
              </pre>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

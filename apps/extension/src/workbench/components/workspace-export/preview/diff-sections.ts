/**
 * Section taxonomy + row materialisation for the import-preview's
 * two-pane diff workspace. Lives separate from the React components so
 * the sidebar / pane / parent can all share the same shape without
 * importing React.
 */

import type {
  CollisionStrategy,
  DiffEntry,
  DiffResult,
  DiffSingleton,
  SerializableEntityKind,
  StrategyMap,
} from '@openheaders/core/workspace-export';

export type SectionKind =
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

export interface SectionDef {
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

export const SECTIONS: SectionDef[] = [
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
  { kind: 'collections-rules', label: 'Rule Collections', strategyKey: 'collections', entityKind: 'collection' },
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

export interface MaterialisedRow {
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

export function rowsForSection(section: SectionDef, diff: DiffResult): MaterialisedRow[] {
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
      if (!diff.workspaceVars.targetHasContent && diff.workspaceVars.state === 'no-collision') return [];
      return [singletonRow(section, diff.workspaceVars, 'Workspace variables')];
    }
    case 'vault': {
      if (!diff.vault.targetHasContent && diff.vault.state === 'no-collision') return [];
      return [singletonRow(section, diff.vault, 'Vault')];
    }
  }
}

function singletonRow(section: SectionDef, singleton: DiffSingleton<unknown>, label: string): MaterialisedRow {
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

export function strategyForRow(strategies: StrategyMap, row: MaterialisedRow): CollisionStrategy {
  const bucket = strategies[row.section.strategyKey] as Record<string, CollisionStrategy> | undefined;
  if (!bucket) return row.defaultStrategy;
  if (row.section.singleton) return bucket.singleton ?? row.defaultStrategy;
  return bucket[(row.entity as { uid: string }).uid] ?? row.defaultStrategy;
}

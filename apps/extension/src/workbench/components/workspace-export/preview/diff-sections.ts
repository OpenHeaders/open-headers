/**
 * Section taxonomy for the import-preview's left sidebar — mirrors the
 * workspace sidebar (Rules / API Requests / Templates with nested
 * collection→folder→entity trees, plus flat Environments / Live*,
 * plus Workspace Variables and Vault as singletons).
 *
 * Pure data assembly: no React. Builds a tree structure from the
 * envelope's flat collection/folder/entity arrays via path-prefix
 * matching, so the sidebar can render the same hierarchy the user
 * already navigates in the main workspace tab.
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
  | 'environments'
  | 'liveWorkflows'
  | 'liveVariables'
  | 'workspaceVars'
  | 'vault';

export interface SectionDef {
  kind: SectionKind;
  /** Uppercase header label — matches the workspace sidebar. */
  label: string;
  /** Bucket key under `StrategyMap` for non-singletons. */
  strategyKey: keyof StrategyMap;
  /** True for the two singleton rows (workspaceVars / vault). */
  singleton?: boolean;
  /** True when the section renders as a collection→folder→entity tree
   *  (Rules / API Requests). False for flat-list sections. */
  hierarchical?: boolean;
}

export const SECTIONS: SectionDef[] = [
  { kind: 'rules', label: 'RULES', strategyKey: 'rules', hierarchical: true },
  { kind: 'requests', label: 'API REQUESTS', strategyKey: 'requests', hierarchical: true },
  { kind: 'environments', label: 'ENVIRONMENTS', strategyKey: 'environments' },
  { kind: 'liveWorkflows', label: 'LIVE WORKFLOWS', strategyKey: 'liveWorkflows' },
  { kind: 'liveVariables', label: 'LIVE VARIABLES', strategyKey: 'liveVariables' },
  { kind: 'workspaceVars', label: 'WORKSPACE VARIABLES', strategyKey: 'workspaceVars', singleton: true },
  { kind: 'vault', label: 'VAULT', strategyKey: 'vault', singleton: true },
];

const SECTIONS_BY_KIND = new Map(SECTIONS.map((s) => [s.kind, s]));

/**
 * Single-row representation that the sidebar renders. Tree rows nest
 * via `children`; flat-list rows leave children empty. Selection is
 * keyed by `selectionKey` so multiple sections can share a strategy
 * bucket without collision (e.g. a rule and a request can both have
 * the same uid prefix).
 */
export interface MaterialisedRow {
  section: SectionDef;
  /** Stable React + selection key. */
  selectionKey: string;
  /** Display name. */
  name: string;
  /** What the row represents — drives icon + indent semantics. */
  rowKind: 'collection' | 'folder' | 'entity';
  /** Type discriminator for the per-entity YAML serializer. */
  entityKind: SerializableEntityKind;
  /** Type-discriminated entity blob the YAML serializer + summaries consume. */
  entity: unknown;
  /** Target-side counterpart (only present on collisions). */
  target: unknown;
  state: 'no-collision' | 'collision-uid' | 'collision-name';
  divergedFromExport: boolean;
  defaultStrategy: CollisionStrategy;
  allowedStrategies: readonly CollisionStrategy[];
  children: MaterialisedRow[];
  /** Indent depth — 0 for top-level under a section. */
  depth: number;
}

export interface ImportTaxonomy {
  /** Maps section.kind → top-level rows the sidebar should render. */
  bySection: Map<SectionKind, MaterialisedRow[]>;
  /** Flattened (depth-first) — used by yaml/line-count memoization
   *  and default-selection lookup. */
  allRows: MaterialisedRow[];
}

interface IncomingSingletons {
  workspaceVars: unknown;
  vault: unknown;
}

/**
 * Top entry point — assemble the full taxonomy in one pass.
 */
export function buildTaxonomy(diff: DiffResult, incoming: IncomingSingletons): ImportTaxonomy {
  const bySection = new Map<SectionKind, MaterialisedRow[]>();
  for (const s of SECTIONS) bySection.set(s.kind, []);

  const allRows: MaterialisedRow[] = [];
  const collect = (row: MaterialisedRow): void => {
    allRows.push(row);
    for (const c of row.children) collect(c);
  };

  // ── Hierarchical sections (Rules / API Requests) ────────────────
  // Templates aren't a top-level section — they're collections nested
  // under Rules (and later API Requests). Pull `templates/` collections
  // into the rules tree alongside rule collections; recipients see them
  // as siblings to rule collections, matching the user's mental model.
  const hierarchicalConfigs: Array<{
    kind: SectionKind;
    treePrefixes: ReadonlyArray<'rules' | 'requests' | 'templates'>;
  }> = [
    { kind: 'rules', treePrefixes: ['rules', 'templates'] },
    { kind: 'requests', treePrefixes: ['requests'] },
  ];
  for (const { kind, treePrefixes } of hierarchicalConfigs) {
    const section = SECTIONS_BY_KIND.get(kind);
    if (!section) continue;
    const tree: MaterialisedRow[] = [];
    for (const prefix of treePrefixes) {
      tree.push(...buildTreeForPrefix(section, prefix, diff));
    }
    bySection.set(kind, tree);
    for (const r of tree) collect(r);
  }

  // ── Flat sections ────────────────────────────────────────────────
  const flatConfigs: Array<{
    kind: SectionKind;
    entityKind: SerializableEntityKind;
    entries: DiffEntry<{ uid: string; name: string }>[];
  }> = [
    {
      kind: 'environments',
      entityKind: 'environment',
      entries: diff.environments as unknown as DiffEntry<{ uid: string; name: string }>[],
    },
    {
      kind: 'liveWorkflows',
      entityKind: 'liveWorkflow',
      entries: diff.liveWorkflows as unknown as DiffEntry<{ uid: string; name: string }>[],
    },
    {
      kind: 'liveVariables',
      entityKind: 'liveVariable',
      entries: diff.liveVariables as unknown as DiffEntry<{ uid: string; name: string }>[],
    },
  ];
  for (const { kind, entityKind, entries } of flatConfigs) {
    const section = SECTIONS_BY_KIND.get(kind);
    if (!section) continue;
    const rows = entries.map<MaterialisedRow>((e) => ({
      section,
      selectionKey: `${kind}:${e.entity.uid}`,
      name: e.entity.name,
      rowKind: 'entity',
      entityKind,
      entity: e.entity,
      target: e.matchedTarget ?? null,
      state: e.state,
      divergedFromExport: !!e.divergedFromExport,
      defaultStrategy: e.defaultStrategy,
      allowedStrategies: e.allowedStrategies,
      children: [],
      depth: 0,
    }));
    bySection.set(kind, rows);
    for (const r of rows) collect(r);
  }

  // ── Singletons ──────────────────────────────────────────────────
  const wsVarsSection = SECTIONS_BY_KIND.get('workspaceVars');
  if (wsVarsSection) {
    const row = singletonRow(
      wsVarsSection,
      diff.workspaceVars,
      'Workspace Variables',
      'workspaceVars',
      incoming.workspaceVars,
    );
    if (row) {
      bySection.set('workspaceVars', [row]);
      collect(row);
    }
  }
  const vaultSection = SECTIONS_BY_KIND.get('vault');
  if (vaultSection) {
    const row = singletonRow(vaultSection, diff.vault, 'Vault', 'vault', incoming.vault);
    if (row) {
      bySection.set('vault', [row]);
      collect(row);
    }
  }

  return { bySection, allRows };
}

function buildTreeForPrefix(
  section: SectionDef,
  treePrefix: 'rules' | 'requests' | 'templates',
  diff: DiffResult,
): MaterialisedRow[] {
  const allCollections = diff.collections.filter((c) => topSegment(c.entity.path) === treePrefix);
  const allFolders = diff.folders.filter((f) => topSegment(f.entity.path) === treePrefix);
  const entities = entriesForTree(treePrefix, diff);

  // Top-level collections live at path `<tree>/<slug>`.
  const topCollections = allCollections.filter((c) => pathDepth(c.entity.path) === 2);

  return topCollections.map((c) =>
    materialiseContainer(section, c, 'collection', allFolders, entities, allCollections, 0),
  );
}

interface EntityArrays {
  entityKind: SerializableEntityKind;
  list: DiffEntry<{ uid: string; name: string; path: string }>[];
}

function entriesForTree(treePrefix: 'rules' | 'requests' | 'templates', diff: DiffResult): EntityArrays {
  if (treePrefix === 'rules') {
    return { entityKind: 'rule', list: diff.rules as unknown as EntityArrays['list'] };
  }
  if (treePrefix === 'requests') {
    return { entityKind: 'request', list: diff.requests as unknown as EntityArrays['list'] };
  }
  return { entityKind: 'template', list: diff.templates as unknown as EntityArrays['list'] };
}

/**
 * Materialise a collection or folder + recurse into its descendants.
 * `containerKind` discriminates the row's icon + selection-key prefix.
 */
function materialiseContainer(
  section: SectionDef,
  entry: DiffEntry<{ uid: string; name: string; path: string }>,
  containerKind: 'collection' | 'folder',
  allFolders: DiffEntry<{ uid: string; name: string; path: string }>[],
  entities: EntityArrays,
  allCollections: DiffEntry<{ uid: string; name: string; path: string }>[],
  depth: number,
): MaterialisedRow {
  const containerPath = entry.entity.path;
  const childFolders = allFolders.filter((f) => parentPath(f.entity.path) === containerPath);
  const childEntities = entities.list.filter((e) => parentPath(e.entity.path) === containerPath);

  const children: MaterialisedRow[] = [];
  for (const f of childFolders) {
    children.push(materialiseContainer(section, f, 'folder', allFolders, entities, allCollections, depth + 1));
  }
  for (const e of childEntities) {
    children.push({
      section,
      selectionKey: `${section.kind}:${e.entity.uid}`,
      name: e.entity.name,
      rowKind: 'entity',
      entityKind: entities.entityKind,
      entity: e.entity,
      target: e.matchedTarget ?? null,
      state: e.state,
      divergedFromExport: !!e.divergedFromExport,
      defaultStrategy: e.defaultStrategy,
      allowedStrategies: e.allowedStrategies,
      children: [],
      depth: depth + 1,
    });
  }

  const containerStrategyKey = containerKind === 'collection' ? 'collections' : 'folders';
  return {
    section: { ...section, strategyKey: containerStrategyKey },
    selectionKey: `${section.kind}:${containerKind}:${entry.entity.uid}`,
    name: entry.entity.name,
    rowKind: containerKind,
    entityKind: containerKind,
    entity: entry.entity,
    target: entry.matchedTarget ?? null,
    state: entry.state,
    divergedFromExport: !!entry.divergedFromExport,
    defaultStrategy: entry.defaultStrategy,
    allowedStrategies: entry.allowedStrategies,
    children,
    depth,
  };
}

function singletonRow(
  section: SectionDef,
  singleton: DiffSingleton<unknown>,
  label: string,
  entityKind: SerializableEntityKind,
  incoming: unknown,
): MaterialisedRow | null {
  if (!singleton.targetHasContent && singleton.state === 'no-collision' && !incoming) return null;
  return {
    section,
    selectionKey: section.kind,
    name: label,
    rowKind: 'entity',
    entityKind,
    entity: incoming ?? null,
    target: singleton.target ?? null,
    state: singleton.state,
    divergedFromExport: false,
    defaultStrategy: singleton.defaultStrategy,
    allowedStrategies: singleton.allowedStrategies,
    children: [],
    depth: 0,
  };
}

// ── Path helpers ────────────────────────────────────────────────────

function topSegment(path: string): string {
  return path.split('/')[0] ?? '';
}

function pathDepth(path: string): number {
  return path.split('/').length;
}

function parentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '' : path.slice(0, idx);
}

// ── Strategy helpers ────────────────────────────────────────────────

export function strategyForRow(strategies: StrategyMap, row: MaterialisedRow): CollisionStrategy {
  const bucket = strategies[row.section.strategyKey] as Record<string, CollisionStrategy> | undefined;
  if (!bucket) return row.defaultStrategy;
  if (row.section.singleton) return bucket.singleton ?? row.defaultStrategy;
  if (row.rowKind === 'entity') {
    const uid = (row.entity as { uid?: string })?.uid;
    if (uid && bucket[uid]) return bucket[uid];
    return row.defaultStrategy;
  }
  // collection / folder: keyed by container's uid
  const uid = (row.entity as { uid?: string })?.uid;
  if (uid && bucket[uid]) return bucket[uid];
  return row.defaultStrategy;
}

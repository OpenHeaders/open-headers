/**
 * Workspace-export gatherer — reads chrome.storage and composes a
 * `BuildWorkspaceExportInput` for the pure builder in
 * `@openheaders/core/workspace-export`.
 *
 * Lives in modules/ alongside `workspace-orchestrator.ts` for the same
 * reason that file does — message-handler can import it without
 * tripping the modules/* → background/background.ts circular edge.
 *
 * The gatherer reads from chrome.storage (not in-memory stores) so it
 * works for the active workspace AND for non-active workspaces. Same
 * pattern as `duplicateWorkspace`. Vault is gathered into the input
 * regardless of include mode — the builder enforces `vaultMode`
 * defaults to `'omitted'` and discards what it doesn't ship.
 *
 * Tree affiliation: the runtime keeps three parallel collection trees
 * (`rules/...`, `requests/...`, `templates/...`) with their own
 * collection + folder arrays. The export envelope flattens them into
 * single `entities.collections` / `entities.folders` arrays; the path
 * prefix preserves which tree each entry belonged to (the YAML
 * serializer keeps `path` for that reason — see
 * `packages/core/src/workspace-export/yaml.ts` header).
 */

import type { V5 } from '@openheaders/core/types';
import type { BuildWorkspaceExportInput } from '@openheaders/core/workspace-export';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { getWorkspace } from './workspace-store';

/**
 * Per-entity-type uid lists for a `selection` scope. Collections and
 * folders are *expanders*: picking one pulls in every descendant
 * folder/entity plus the parent containers needed for `collectionId` /
 * `folderId` and tree-prefix paths to resolve at import time. Picking a
 * leaf entity (rule / request / template / env / live-*) ships exactly
 * that entity — recipients see missing-deps in the preview if the
 * referenced collection/env/workflow isn't already in their workspace
 * (design §2.3).
 *
 * Transitive dependency expansion (envs / workflows / collection-vars
 * referenced by a selected rule's template strings) is a separate
 * concern — handled by the export-side "Strict literal" toggle in PR 5
 * Advanced rather than baked into the gatherer.
 */
export interface ExportSelection {
  rules?: readonly string[];
  requests?: readonly string[];
  templates?: readonly string[];
  environments?: readonly string[];
  liveWorkflows?: readonly string[];
  liveVariables?: readonly string[];
  collections?: readonly string[];
  folders?: readonly string[];
}

export type ExportGatherScope =
  | { kind: 'workspace' }
  | {
      kind: 'selection';
      selection: ExportSelection;
      /**
       * Strict-literal mode (design §5.5): when `true`, ship exactly the
       * uids the caller picked — no descendant or parent-container
       * expansion. Recipients see missing-deps in the preview if a
       * referenced collection / folder isn't in their workspace. Default
       * is `false` (expand-to-deps so the import stands on its own).
       */
      strictLiteral?: boolean;
    };

interface GatherOptions {
  appVersion: string;
  /** Caller's resolved current platform — Chrome/Firefox/Edge/Safari/Electron. */
  platform: BuildWorkspaceExportInput['source']['platform'];
  /** Caller's resolved app — `'extension' | 'desktop'`. */
  app: BuildWorkspaceExportInput['source']['app'];
}

interface GatherResult {
  /** Ready for `buildWorkspaceExport(...)`. */
  input: BuildWorkspaceExportInput;
}

/**
 * Folder records as persisted carry no `order` field; the exporter
 * leaves them as-is (the codec's `FolderSchema` declares `order` as
 * optional, so the envelope schema accepts the persisted shape
 * verbatim).
 */
function toExportFolders(folders: PersistedLocalFolder[]): V5.Folder[] {
  return folders;
}

interface ExpandedSelection {
  rules: Set<string>;
  requests: Set<string>;
  templates: Set<string>;
  environments: Set<string>;
  liveWorkflows: Set<string>;
  liveVariables: Set<string>;
  collections: Set<string>;
  folders: Set<string>;
}

interface SelectionSources {
  collections: readonly V5.Collection[];
  folders: readonly V5.Folder[];
  rules: readonly V5.Rule[];
  requests: readonly V5.Request[];
  templates: readonly V5.Template[];
}

/**
 * Resolve a user-picked `ExportSelection` into the concrete uid sets the
 * gatherer should ship. Collections and folders expand to descendant
 * folders/entities AND parent containers needed for the importer's path
 * + uid binding to resolve.
 */
function expandSelection(selection: ExportSelection, src: SelectionSources): ExpandedSelection {
  const rules = new Set<string>(selection.rules ?? []);
  const requests = new Set<string>(selection.requests ?? []);
  const templates = new Set<string>(selection.templates ?? []);
  const environments = new Set<string>(selection.environments ?? []);
  const liveWorkflows = new Set<string>(selection.liveWorkflows ?? []);
  const liveVariables = new Set<string>(selection.liveVariables ?? []);
  const collections = new Set<string>(selection.collections ?? []);
  const folders = new Set<string>(selection.folders ?? []);

  // Each entity's `path` is the slash-joined hierarchy
  // (`<tree>/<collection-slug>[/<folder-slug>...]`). Tree affiliation +
  // ancestry resolve from path — no separate `collectionId` /
  // `folderId` fields on the persisted shape.
  const pathStartsAt = (entityPath: string, ancestor: string): boolean =>
    entityPath === ancestor || entityPath.startsWith(`${ancestor}/`);

  for (const cid of selection.collections ?? []) {
    const col = src.collections.find((c) => c.uid === cid);
    if (!col) continue;
    const colPath = col.path;
    const tree = colPath.split('/')[0];
    for (const f of src.folders) {
      if (pathStartsAt(f.path, colPath) && f.path !== colPath) folders.add(f.uid);
    }
    if (tree === 'rules') {
      for (const r of src.rules) if (pathStartsAt(r.path, colPath)) rules.add(r.uid);
    } else if (tree === 'requests') {
      for (const r of src.requests) if (pathStartsAt(r.path, colPath)) requests.add(r.uid);
    } else if (tree === 'templates') {
      for (const t of src.templates) if (pathStartsAt(t.path, colPath)) templates.add(t.uid);
    }
  }

  for (const fid of selection.folders ?? []) {
    const folder = src.folders.find((f) => f.uid === fid);
    if (!folder) continue;
    const folderPath = folder.path;
    const tree = folderPath.split('/')[0];
    // Parent collection (path = `<tree>/<collection-slug>`) so the
    // recipient can resolve the folder's chain. Walk up the path and
    // match by-path against the collection list.
    const segs = folderPath.split('/');
    if (segs.length >= 2) {
      const parentColPath = `${segs[0]}/${segs[1]}`;
      const parentCol = src.collections.find((c) => c.path === parentColPath);
      if (parentCol) collections.add(parentCol.uid);
    }
    for (const f2 of src.folders) {
      if (pathStartsAt(f2.path, folderPath) && f2.path !== folderPath) folders.add(f2.uid);
    }
    if (tree === 'rules') {
      for (const r of src.rules) if (pathStartsAt(r.path, folderPath)) rules.add(r.uid);
    } else if (tree === 'requests') {
      for (const r of src.requests) if (pathStartsAt(r.path, folderPath)) requests.add(r.uid);
    } else if (tree === 'templates') {
      for (const t of src.templates) if (pathStartsAt(t.path, folderPath)) templates.add(t.uid);
    }
  }

  return { rules, requests, templates, environments, liveWorkflows, liveVariables, collections, folders };
}

/**
 * Strict-literal counterpart to `expandSelection`: ship exactly the uids
 * the caller picked, with no descendant or parent-container expansion.
 * The recipient sees missing-deps for any unresolved references.
 */
function literalSelection(selection: ExportSelection): ExpandedSelection {
  return {
    rules: new Set<string>(selection.rules ?? []),
    requests: new Set<string>(selection.requests ?? []),
    templates: new Set<string>(selection.templates ?? []),
    environments: new Set<string>(selection.environments ?? []),
    liveWorkflows: new Set<string>(selection.liveWorkflows ?? []),
    liveVariables: new Set<string>(selection.liveVariables ?? []),
    collections: new Set<string>(selection.collections ?? []),
    folders: new Set<string>(selection.folders ?? []),
  };
}

/**
 * Collect all collections/folders/etc for `scope`. PR 1 only handles
 * `'workspace'` and `'selection-rule'` (single rule). `'collection'`
 * and multi-select selection scopes land in PR 5.
 */
export async function gatherWorkspaceExport(
  workspaceId: string,
  scope: ExportGatherScope,
  opts: GatherOptions,
): Promise<GatherResult | null> {
  const meta = getWorkspace(workspaceId);
  if (!meta) return null;

  const k = wsKeys(workspaceId);
  const src = await extensionStorage.getMany({
    rules: k.rules,
    collections: k.collections,
    folders: k.folders,
    requests: k.requests,
    requestCollections: k.requestCollections,
    requestFolders: k.requestFolders,
    templates: k.templates,
    templateCollections: k.templateCollections,
    templateFolders: k.templateFolders,
    environments: k.environments,
    workspaceVars: k.workspaceVars,
    liveWorkflows: k.liveWorkflows,
    liveVariables: k.liveVariables,
    defaultEnvironmentId: k.defaultEnvironmentId,
  });

  const allRules: V5.Rule[] = src.rules ?? [];
  const allRequests: V5.Request[] = src.requests ?? [];
  const allTemplates: V5.Template[] = src.templates ?? [];
  const allEnvironments: V5.Environment[] = src.environments ?? [];
  const allLiveWorkflows: V5.LiveWorkflow[] = src.liveWorkflows ?? [];
  const allLiveVariables: V5.LiveVariable[] = src.liveVariables ?? [];

  // Three parallel trees flatten into single arrays in the envelope.
  // Path prefix (`rules/...` / `requests/...` / `templates/...`)
  // preserves tree affiliation for the importer (PR 2).
  const allCollections: V5.Collection[] = [
    ...((src.collections ?? []) as V5.Collection[]),
    ...((src.requestCollections ?? []) as V5.Collection[]),
    ...((src.templateCollections ?? []) as V5.Collection[]),
  ];
  const allFolders: V5.Folder[] = [
    ...toExportFolders(src.folders ?? []),
    ...toExportFolders(src.requestFolders ?? []),
    ...toExportFolders(src.templateFolders ?? []),
  ];

  let rules: V5.Rule[];
  let requests: V5.Request[];
  let templates: V5.Template[];
  let environments: V5.Environment[];
  let collections: V5.Collection[];
  let folders: V5.Folder[];
  let liveWorkflows: V5.LiveWorkflow[];
  let liveVariables: V5.LiveVariable[];
  let envelopeScope: BuildWorkspaceExportInput['scope'];

  if (scope.kind === 'workspace') {
    rules = allRules;
    requests = allRequests;
    templates = allTemplates;
    environments = allEnvironments;
    collections = allCollections;
    folders = allFolders;
    liveWorkflows = allLiveWorkflows;
    liveVariables = allLiveVariables;
    envelopeScope = 'workspace';
  } else {
    const picked = scope.strictLiteral
      ? literalSelection(scope.selection)
      : expandSelection(scope.selection, {
          collections: allCollections,
          folders: allFolders,
          rules: allRules,
          requests: allRequests,
          templates: allTemplates,
        });
    if (
      picked.rules.size === 0 &&
      picked.requests.size === 0 &&
      picked.templates.size === 0 &&
      picked.environments.size === 0 &&
      picked.liveWorkflows.size === 0 &&
      picked.liveVariables.size === 0 &&
      picked.collections.size === 0 &&
      picked.folders.size === 0
    ) {
      return null;
    }
    rules = allRules.filter((r) => picked.rules.has(r.uid));
    requests = allRequests.filter((r) => picked.requests.has(r.uid));
    templates = allTemplates.filter((t) => picked.templates.has(t.uid));
    environments = allEnvironments.filter((e) => picked.environments.has(e.uid));
    liveWorkflows = allLiveWorkflows.filter((w) => picked.liveWorkflows.has(w.uid));
    liveVariables = allLiveVariables.filter((v) => picked.liveVariables.has(v.uid));
    collections = allCollections.filter((c) => picked.collections.has(c.uid));
    folders = allFolders.filter((f) => picked.folders.has(f.uid));
    envelopeScope = 'selection';
  }

  const input: BuildWorkspaceExportInput = {
    exportedAt: new Date().toISOString(),
    source: {
      app: opts.app,
      appVersion: opts.appVersion,
      platform: opts.platform,
      workspaceLabel: meta.name,
    },
    scope: envelopeScope,
    workspace: {
      uid: meta.id,
      name: meta.name,
      ...(meta.description !== undefined ? { description: meta.description } : {}),
      ...(meta.color !== undefined ? { color: meta.color } : {}),
      ...(meta.icon !== undefined ? { icon: meta.icon } : {}),
      ...(src.defaultEnvironmentId ? { defaultEnvironmentId: src.defaultEnvironmentId } : {}),
    },
    entities: {
      collections,
      folders,
      rules,
      requests,
      templates,
      environments,
      workspaceVars: src.workspaceVars ?? { schemaVersion: 5, version: 1, variables: [] },
      liveWorkflows,
      liveVariables,
    },
  };

  return { input };
}

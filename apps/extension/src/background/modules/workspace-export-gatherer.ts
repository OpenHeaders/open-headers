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

export type ExportGatherScope = { kind: 'workspace' } | { kind: 'selection-rule'; ruleUid: string };

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
    // selection-rule: just the one rule. Transitive-dep expansion (the
    // env / collection / vault entries the rule references) lands in
    // PR 5's Advanced "expand to dependencies" toggle. For PR 1 we
    // ship the literal rule only — recipients see "missing dep" hints
    // in PR 2's preview.
    const target = allRules.find((r) => r.uid === scope.ruleUid);
    if (!target) return null;
    rules = [target];
    requests = [];
    templates = [];
    environments = [];
    collections = [];
    folders = [];
    liveWorkflows = [];
    liveVariables = [];
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

/**
 * Parity materialization — the write half of migration ladder rung 3
 * (MIGRATION_PLAN.md §3.3). The pull returns raw payloads attributed
 * to their vendor workspaces; everything here rides the standard
 * import path: `parsePostman` / `parsePostmanEnvironment`, entities
 * minted with the same core batch builders + `applySyncRequest` route
 * the Workbench and MCP write paths use, and one aggregated import
 * report PER WORKSPACE (per-collection path prefixes, every drop/skip
 * with a reason) recorded in that workspace's ring — its `sourceHash`
 * is the re-import diff anchor.
 *
 * Workspace parity: 1 vendor workspace = 1 Open Headers workspace,
 * carrying the vendor workspace's EXACT name — no prefixes, no
 * suffixes. A re-pull finds the counterpart by the `importedFrom`
 * provenance stamped at creation (vendor + vendor workspace id), so
 * renames are safe and a user-created workspace sharing the name is
 * never touched. An item listed by several vendor workspaces (shared
 * collections) materializes into each counterpart.
 *
 * Re-pull semantics (per workspace): a COMPLETE pull refreshes each
 * pulled workspace — the previous import's entities are tombstoned
 * first (through the same sync path, so the Activity Feed carries
 * revertible deletes and the report records the replacement). A
 * labeled PARTIAL pull appends without wiping — a half-pull never
 * destroys a complete previous import.
 */

import {
  createReport,
  hashImportSource,
  type ImportReport,
  type PostmanImportedWorkspace,
  type PostmanImportSummary,
  type PostmanPullResult,
  type PulledCollection,
  type PulledEnvironment,
  type PullWorkspaceSummary,
  parsePostman,
  parsePostmanEnvironment,
  recordDrop,
  recordTransform,
} from '@openheaders/core/import';
import { EnvironmentSchema, RequestSchema } from '@openheaders/core/schemas';
import {
  computeInverseSpec,
  ENVIRONMENT_ENTITY_TYPE,
  type MutationBatch,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import {
  buildAddEnvironmentBatch,
  buildDeleteEnvironmentBatch,
} from '@openheaders/core/sync-builders/mutations/env-mutations';
import { buildDeleteRequestCollectionBatch } from '@openheaders/core/sync-builders/mutations/request-collection-mutations';
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderEntityBatch,
} from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import {
  buildAddBatch as buildAddRequestBatch,
  buildDeleteBatch as buildDeleteRequestBatch,
} from '@openheaders/core/sync-builders/mutations/request-mutations';
import { buildDeleteResponseExampleBatch } from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Collection, Environment, Request, Variable } from '@openheaders/core/types';
import { generateUid, logger, toFolderName } from '@openheaders/core/utils';
import { recordImportReport } from '@openheaders/oracle/entity/import-reports-store';
import { makeOracleInverseAccess, rememberPriorForMutation } from '@openheaders/oracle/sync';
import {
  applySyncRequest,
  getOracleForWorkspace,
  getOrCreateWorkspaceService,
  nextSwMutatorContextForWorkspace,
  releaseWorkspaceService,
} from '@openheaders/oracle/sync/service';
import { createWorkspace, listWorkspaces } from '@openheaders/oracle/workspace/extension-workspace-store';
import * as v from 'valibot';

const SCOPE = 'migration-materialize';

/** Envelope attribution for every entity the migration mints. */
export const MIGRATION_SURFACE_ID = 'migration';

/** `importedFrom.vendor` value stamped on Postman-pull counterparts. */
export const POSTMAN_VENDOR_ID = 'postman';

export interface LandingWorkspaceRef {
  id: string;
  name: string;
}

export interface MaterializePostmanPullOptions {
  /**
   * Counterpart-workspace seam — production finds by `importedFrom`
   * provenance or creates the exact-name counterpart via the workspace
   * store; tests point it at prepared workspace ids.
   */
  ensureWorkspaceFor?: (workspace: PullWorkspaceSummary) => Promise<LandingWorkspaceRef>;
}

/**
 * Reuse the counterpart an earlier pull minted for this vendor
 * workspace (matched by provenance, so renames are safe); mint it
 * fresh — exact vendor name, provenance stamped — on the first pull.
 */
async function findOrCreateVendorWorkspace(workspace: PullWorkspaceSummary): Promise<LandingWorkspaceRef> {
  const existing = listWorkspaces().find(
    (ws) => ws.importedFrom?.vendor === POSTMAN_VENDOR_ID && ws.importedFrom.workspaceId === workspace.id,
  );
  if (existing) return { id: existing.id, name: existing.name };
  const created = await createWorkspace(
    { name: workspace.name, importedFrom: { vendor: POSTMAN_VENDOR_ID, workspaceId: workspace.id } },
    { surfaceId: MIGRATION_SURFACE_ID },
  );
  return { id: created.id, name: created.name };
}

/**
 * Stash pre-apply state + inverse specs so the Activity Feed classifies
 * migration writes with a working Revert — same speculative capture the
 * MCP write path performs for its agent-minted batches.
 */
function capturePriorsForActivity(batch: MutationBatch): void {
  for (const env of batch.mutations) {
    const oracle = getOracleForWorkspace(env.workspaceId);
    const prior = oracle ? oracle.materializeOne(env.body.type, env.body.id) : null;
    const access = makeOracleInverseAccess({
      oracle,
      entityType: env.body.type,
      entityId: env.body.id,
      prior,
    });
    const spec = computeInverseSpec(env.body, access);
    const inverse = spec === null ? null : { mutatorVersion: env.mutatorVersion, spec };
    rememberPriorForMutation(env.mutationId, env.workspaceId, prior, inverse);
  }
}

async function applyMigrationMutation(batch: MutationBatch, sideEffects: SideEffectIntent[]): Promise<void> {
  if (batch.mutations.length === 0) return;
  capturePriorsForActivity(batch);
  const response = await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects });
  if (!response.ok) {
    const detail = response.failure?.detail ?? response.failure?.status ?? 'apply failed';
    throw new Error(`mutation rejected: ${detail}`);
  }
}

function mergeSubReport(target: ImportReport, sub: ImportReport, prefix: string): void {
  for (const d of sub.drops) recordDrop(target, { ...d, path: `${prefix}${d.path}` });
  for (const t of sub.transforms) recordTransform(target, { ...t, path: `${prefix}${t.path}` });
}

/**
 * One stable string per workspace for the re-import diff: the same
 * vendor workspace re-pulled must hash identically regardless of pull
 * order, so items sort by kind+id before concatenation.
 */
function pullSourceText(collections: readonly PulledCollection[], environments: readonly PulledEnvironment[]): string {
  return [...collections, ...environments]
    .map((item) => ({ key: `${item.item}:${item.id}`, json: item.json }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => `${item.key}\n${item.json}`)
    .join('\n');
}

function failureReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The entity types a pull mints — plus response examples, which users
 * may have saved under imported requests. Listed child-first so the
 * refresh tombstones descendants before their parents, mirroring the
 * workbench's own collection-delete cascade.
 */
const REPLACED_ENTITY_TYPES = [
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
] as const;

const REPLACED_ENTITY_TYPE_SET: ReadonlySet<string> = new Set(REPLACED_ENTITY_TYPES);

interface PriorImportEntity {
  type: string;
  id: string;
}

function buildDeleteForReplacedEntity(
  entity: PriorImportEntity,
  ctx: MutatorContext,
): { batch: MutationBatch; sideEffects: SideEffectIntent[] } {
  switch (entity.type) {
    case RESPONSE_EXAMPLE_ENTITY_TYPE:
      return buildDeleteResponseExampleBatch(entity.id, ctx);
    case REQUEST_ENTITY_TYPE:
      return buildDeleteRequestBatch(entity.id, ctx);
    case REQUEST_FOLDER_ENTITY_TYPE:
      return { batch: buildDeleteRequestFolderEntityBatch(entity.id, ctx), sideEffects: [] };
    case REQUEST_COLLECTION_ENTITY_TYPE:
      return buildDeleteRequestCollectionBatch(entity.id, ctx);
    case ENVIRONMENT_ENTITY_TYPE:
      return buildDeleteEnvironmentBatch({ envId: entity.id }, ctx);
    default:
      throw new Error(`no delete builder for entity type "${entity.type}"`);
  }
}

/**
 * Refresh half of the re-pull semantics: tombstone the previous
 * import's entities child-first through the standard sync path (priors
 * captured, so the Activity Feed classifies the deletes with working
 * Revert) and record ONE transform naming what was replaced. Per-entity
 * failures drop with reasons and leave that entity alongside the fresh
 * pull — the refresh never aborts the import.
 */
async function replacePriorImport(
  prior: readonly PriorImportEntity[],
  report: ImportReport,
  mintCtx: MutatorContextMinter,
): Promise<void> {
  const countOf = (type: string): number => prior.filter((entity) => entity.type === type).length;
  for (const type of REPLACED_ENTITY_TYPES) {
    for (const entity of prior.filter((candidate) => candidate.type === type)) {
      const ctx = mintCtx();
      if (!ctx) throw new Error('landing workspace is not loaded on this host');
      try {
        const { batch, sideEffects } = buildDeleteForReplacedEntity(entity, ctx);
        await applyMigrationMutation(batch, sideEffects);
      } catch (err) {
        recordDrop(report, {
          path: `pull.replaced.${entity.type}["${entity.id}"]`,
          reason: `Failed to remove a previously imported ${entity.type} — it remains alongside this pull: ${failureReason(err)}`,
          tracking: 'PERMANENT: write-path failure',
        });
      }
    }
  }
  recordTransform(report, {
    path: 'pull',
    from: `previous import (${countOf(REQUEST_COLLECTION_ENTITY_TYPE)} collections, ${countOf(ENVIRONMENT_ENTITY_TYPE)} environments, ${countOf(REQUEST_ENTITY_TYPE)} requests)`,
    to: 'replaced by this pull',
    reason:
      'A complete re-pull refreshes the landing workspace: the previous import was removed first. The deletions are revertible from the Activity Feed.',
  });
}

type MutatorContextMinter = () => ReturnType<typeof nextSwMutatorContextForWorkspace>;

function contextMinter(workspaceId: string): MutatorContextMinter {
  return () => nextSwMutatorContextForWorkspace(workspaceId, { surfaceId: MIGRATION_SURFACE_ID });
}

/**
 * Materialize one pulled collection: the request collection (carrying
 * the collection variables), its folder tree depth-first so parents
 * exist, then every request under its folder's reconstructed path.
 * Returns the number of requests minted.
 */
async function materializeCollection(
  json: string,
  index: number,
  report: ImportReport,
  mintCtx: MutatorContextMinter,
): Promise<{ collections: number; requests: number }> {
  const parsed = parsePostman(json);
  mergeSubReport(report, parsed.report, `pull.collections[${index}].`);

  const collectionUid = generateUid();
  const collection: Collection = {
    schemaVersion: 5,
    uid: collectionUid,
    path: `requests/${toFolderName(parsed.collectionName, collectionUid)}`,
    name: parsed.collectionName,
    variables: parsed.collectionVariables.map((cv) => ({
      uid: generateUid(),
      name: cv.name,
      value: cv.value,
      type: cv.type,
    })),
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const collectionCtx = mintCtx();
  if (!collectionCtx) throw new Error('landing workspace is not loaded on this host');
  await applyMigrationMutation(seedRequestCollection(collection, collectionCtx), []);

  // Folder tree — depth-first so every parent exists before its
  // children; the map carries both the parent ref (folder membership)
  // and the reconstructed path (request placement).
  const folderMap = new Map<string, { type: 'request-collection' | 'request-folder'; uid: string; path: string }>();
  folderMap.set('', { type: 'request-collection', uid: collectionUid, path: collection.path });
  const sortedFolders = [...parsed.folders].sort((a, b) => a.path.length - b.path.length);
  for (const folder of sortedFolders) {
    const parentKey = folder.path.slice(0, -1).join('/');
    const parent = folderMap.get(parentKey);
    const folderName = folder.path[folder.path.length - 1];
    if (!parent || !folderName) continue;
    const folderUid = generateUid();
    const ctx = mintCtx();
    if (!ctx) throw new Error('landing workspace is not loaded on this host');
    try {
      const intent = buildCreateRequestFolderBatch(
        { folderUid, parent: { type: parent.type, uid: parent.uid }, name: folderName },
        ctx,
      );
      await applyMigrationMutation(intent.batch, intent.sideEffects);
      folderMap.set(folder.path.join('/'), {
        type: 'request-folder',
        uid: folderUid,
        path: `${parent.path}/${toFolderName(folderName, folderUid)}`,
      });
    } catch (err) {
      recordDrop(report, {
        path: `pull.collections[${index}].folders["${folder.path.join('/')}"]`,
        reason: `Failed to create folder "${folderName}" — its requests land at the collection root: ${failureReason(err)}`,
        tracking: 'PERMANENT: write-path failure',
      });
    }
  }

  let requests = 0;
  for (let r = 0; r < parsed.requests.length; r++) {
    const entry = parsed.requests[r];
    if (!entry) continue;
    const parentPath = folderMap.get(entry.folderPath.join('/'))?.path ?? collection.path;
    const uid = generateUid();
    const name = entry.request.name.trim() || 'Untitled Request';
    const candidate = v.safeParse(RequestSchema, {
      method: entry.request.method,
      url: entry.request.url,
      headers: entry.request.headers,
      params: entry.request.params,
      auth: entry.request.auth,
      body: entry.request.body,
      name,
      schemaVersion: 5,
      uid,
      path: `${parentPath}/${toFolderName(name, uid)}`,
    });
    if (!candidate.success) {
      recordDrop(report, {
        path: `pull.collections[${index}].requests[${r}]`,
        reason: `Request "${name}" did not fit the canonical request shape — skipped.`,
        tracking: 'PERMANENT: write-path validation',
      });
      continue;
    }
    const ctx = mintCtx();
    if (!ctx) throw new Error('landing workspace is not loaded on this host');
    try {
      const payload = buildAddRequestBatch(candidate.output as Request, ctx);
      await applyMigrationMutation(payload.batch, payload.sideEffects);
      requests++;
    } catch (err) {
      recordDrop(report, {
        path: `pull.collections[${index}].requests[${r}]`,
        reason: `Failed to create request "${name}": ${failureReason(err)}`,
        tracking: 'PERMANENT: write-path failure',
      });
    }
  }
  return { collections: 1, requests };
}

async function materializeEnvironment(
  json: string,
  index: number,
  report: ImportReport,
  mintCtx: MutatorContextMinter,
): Promise<number> {
  const parsed = parsePostmanEnvironment(json);
  mergeSubReport(report, parsed.report, `pull.environments[${index}].`);
  const variables: Variable[] = parsed.variables.map((row) => ({
    uid: generateUid(),
    name: row.name,
    value: row.value,
    type: row.type,
  }));
  const environment: Environment = v.parse(EnvironmentSchema, {
    schemaVersion: 5,
    uid: generateUid(),
    name: parsed.name,
    variables,
  });
  const ctx = mintCtx();
  if (!ctx) throw new Error('landing workspace is not loaded on this host');
  const payload = buildAddEnvironmentBatch({ environment }, ctx);
  await applyMigrationMutation(payload.batch, payload.sideEffects);
  return 1;
}

/**
 * Land one vendor workspace's pulled items in its counterpart through
 * the standard import path. Per-item parse/write failures drop with
 * reasons and the run continues; only a missing counterpart workspace
 * aborts this workspace's leg. The aggregated report is recorded in
 * the counterpart's ring even when every item dropped — a run is
 * never silent.
 */
async function materializeWorkspacePull(
  workspace: PullWorkspaceSummary,
  result: PostmanPullResult,
  target: LandingWorkspaceRef,
): Promise<PostmanImportedWorkspace> {
  const wsCollections = result.collections
    .map((pulled, index) => ({ pulled, index }))
    .filter(({ pulled }) => pulled.workspaceIds.includes(workspace.id));
  const wsEnvironments = result.environments
    .map((pulled, index) => ({ pulled, index }))
    .filter(({ pulled }) => pulled.workspaceIds.includes(workspace.id));

  const report: ImportReport = createReport('postman-pull', 0);
  report.sourceHash = await hashImportSource(
    pullSourceText(
      wsCollections.map(({ pulled }) => pulled),
      wsEnvironments.map(({ pulled }) => pulled),
    ),
  );

  // The pull's own skips carry into the report of every workspace they
  // concern (unattributed skips concern the whole run) so each
  // workspace's end-of-run document tells its whole story.
  for (let i = 0; i < result.skipped.length; i++) {
    const skip = result.skipped[i];
    if (!skip) continue;
    if (skip.workspaceIds !== undefined && !skip.workspaceIds.includes(workspace.id)) continue;
    recordDrop(report, {
      path: `pull.skipped[${i}].${skip.item}["${skip.name ?? skip.id}"]`,
      reason: skip.reason,
      tracking: 'PERMANENT: pull-run skip',
    });
  }

  const service = getOrCreateWorkspaceService(target.id);
  let collections = 0;
  let environments = 0;
  let requests = 0;
  try {
    const mintCtx = contextMinter(target.id);
    await service.hydrated;
    const prior = service.oracle
      .materializeAll()
      .filter((entity) => REPLACED_ENTITY_TYPE_SET.has(entity.type))
      .map((entity) => ({ type: entity.type, id: entity.id }));
    if (prior.length > 0) {
      if (result.outcome === 'complete') {
        await replacePriorImport(prior, report, mintCtx);
      } else {
        recordTransform(report, {
          path: 'pull',
          from: 'previous import',
          to: 'kept alongside this pull',
          reason:
            'The run stopped early, so the previous import was kept — a partial pull never replaces it. Duplicates may appear until a complete re-pull.',
        });
      }
    }
    for (const { pulled, index } of wsCollections) {
      try {
        const outcome = await materializeCollection(pulled.json, index, report, mintCtx);
        collections += outcome.collections;
        requests += outcome.requests;
      } catch (err) {
        recordDrop(report, {
          path: `pull.collections[${index}]["${pulled.name ?? pulled.id}"]`,
          reason: `Collection was not imported: ${failureReason(err)}`,
          tracking: 'PERMANENT: write-path failure',
        });
      }
    }
    for (const { pulled, index } of wsEnvironments) {
      try {
        environments += await materializeEnvironment(pulled.json, index, report, mintCtx);
      } catch (err) {
        recordDrop(report, {
          path: `pull.environments[${index}]["${pulled.name ?? pulled.id}"]`,
          reason: `Environment was not imported: ${failureReason(err)}`,
          tracking: 'PERMANENT: write-path failure',
        });
      }
    }
  } finally {
    releaseWorkspaceService(target.id);
  }

  report.summary = { ...report.summary, imported: requests + environments };
  await recordImportReport(report, target.id);

  return {
    workspaceId: target.id,
    workspaceName: target.name,
    collections,
    environments,
    requests,
    drops: report.summary.dropped,
  };
}

/**
 * Land a pull result with workspace parity: every pulled vendor
 * workspace materializes into its own counterpart (exact name, found
 * or minted by provenance), each with its own report and per-workspace
 * refresh semantics. One workspace's failure drops its leg and the
 * run continues to the rest.
 */
export async function materializePostmanPull(
  result: PostmanPullResult,
  options: MaterializePostmanPullOptions = {},
): Promise<PostmanImportSummary> {
  const ensure = options.ensureWorkspaceFor ?? findOrCreateVendorWorkspace;
  const workspaces: PostmanImportedWorkspace[] = [];
  let failures = 0;
  for (const workspace of result.workspaces) {
    try {
      const target = await ensure(workspace);
      workspaces.push(await materializeWorkspacePull(workspace, result, target));
    } catch (err) {
      failures++;
      logger.warn(SCOPE, `workspace "${workspace.name}" was not imported: ${failureReason(err)}`);
    }
  }
  if (workspaces.length === 0 && failures > 0) {
    throw new Error('No workspace could be imported — every leg of the run failed.');
  }
  return {
    workspaces,
    collections: workspaces.reduce((sum, ws) => sum + ws.collections, 0),
    environments: workspaces.reduce((sum, ws) => sum + ws.environments, 0),
    requests: workspaces.reduce((sum, ws) => sum + ws.requests, 0),
    drops: workspaces.reduce((sum, ws) => sum + ws.drops, 0),
  };
}

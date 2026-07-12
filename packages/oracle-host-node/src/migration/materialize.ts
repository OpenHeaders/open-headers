/**
 * Landing-workspace materialization — the write half of migration
 * ladder rung 3 (MIGRATION_PLAN.md §3.3, S5-addendum UX). The pull
 * returns raw payloads; everything here rides the standard import
 * path: `parsePostman` / `parsePostmanEnvironment`, entities minted
 * with the same core batch builders + `applySyncRequest` route the
 * Workbench and MCP write paths use, and ONE aggregated import report
 * (per-collection path prefixes, every drop/skip with a reason)
 * recorded in the landing workspace's ring — its `sourceHash` is the
 * re-import diff anchor.
 *
 * The pull lands in a dedicated "Imported from Postman" workspace:
 * isolation from whatever the user is actively doing, whole-migration
 * undo = delete the workspace. Found by exact name so a re-pull diffs
 * against the prior run's report; auto-created when absent — the
 * import never blocks on structure.
 */

import {
  createReport,
  hashImportSource,
  type ImportReport,
  type PostmanImportSummary,
  type PostmanPullResult,
  parsePostman,
  parsePostmanEnvironment,
  recordDrop,
  recordTransform,
} from '@openheaders/core/import';
import { EnvironmentSchema, RequestSchema } from '@openheaders/core/schemas';
import { computeInverseSpec, type MutationBatch, type SideEffectIntent } from '@openheaders/core/sync';
import { buildAddEnvironmentBatch } from '@openheaders/core/sync-builders/mutations/env-mutations';
import { buildCreateRequestFolderBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildAddBatch as buildAddRequestBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Collection, Environment, Request, Variable } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
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

/** Envelope attribution for every entity the migration mints. */
export const MIGRATION_SURFACE_ID = 'migration';

export const POSTMAN_LANDING_WORKSPACE_NAME = 'Imported from Postman';

export interface LandingWorkspaceRef {
  id: string;
  name: string;
}

export interface MaterializePostmanPullOptions {
  /**
   * Landing-workspace seam — production find-or-creates the dedicated
   * workspace via the workspace store; tests point it at a prepared
   * workspace id.
   */
  ensureLandingWorkspace?: () => Promise<LandingWorkspaceRef>;
}

/**
 * Reuse the workspace an earlier pull landed in (exact-name match) so
 * the re-import diff anchors to the same report ring; mint it fresh on
 * the first run.
 */
async function findOrCreateLandingWorkspace(): Promise<LandingWorkspaceRef> {
  const existing = listWorkspaces().find((ws) => ws.name === POSTMAN_LANDING_WORKSPACE_NAME);
  if (existing) return { id: existing.id, name: existing.name };
  const created = await createWorkspace({ name: POSTMAN_LANDING_WORKSPACE_NAME }, { surfaceId: MIGRATION_SURFACE_ID });
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
 * One stable string per run for the re-import diff: the same account
 * re-pulled must hash identically regardless of pull order, so items
 * sort by kind+id before concatenation.
 */
function pullSourceText(result: PostmanPullResult): string {
  return [...result.collections, ...result.environments]
    .map((item) => ({ key: `${item.item}:${item.id}`, json: item.json }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => `${item.key}\n${item.json}`)
    .join('\n');
}

function failureReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
 * Land a pull result in the dedicated workspace through the standard
 * import path. Per-item parse/write failures drop with reasons and the
 * run continues; only a missing landing workspace aborts. The
 * aggregated report is recorded in the landing workspace's ring even
 * when every item dropped — a run is never silent.
 */
export async function materializePostmanPull(
  result: PostmanPullResult,
  options: MaterializePostmanPullOptions = {},
): Promise<PostmanImportSummary> {
  const ensure = options.ensureLandingWorkspace ?? findOrCreateLandingWorkspace;
  const landing = await ensure();

  const report: ImportReport = createReport('postman-pull', 0);
  report.sourceHash = await hashImportSource(pullSourceText(result));

  // The pull's own skips carry into the aggregated report so the one
  // end-of-run document tells the whole story.
  for (let i = 0; i < result.skipped.length; i++) {
    const skip = result.skipped[i];
    if (!skip) continue;
    recordDrop(report, {
      path: `pull.skipped[${i}].${skip.item}["${skip.name ?? skip.id}"]`,
      reason: skip.reason,
      tracking: 'PERMANENT: pull-run skip',
    });
  }

  getOrCreateWorkspaceService(landing.id);
  let collections = 0;
  let environments = 0;
  let requests = 0;
  try {
    const mintCtx = contextMinter(landing.id);
    for (let i = 0; i < result.collections.length; i++) {
      const pulled = result.collections[i];
      if (!pulled) continue;
      try {
        const outcome = await materializeCollection(pulled.json, i, report, mintCtx);
        collections += outcome.collections;
        requests += outcome.requests;
      } catch (err) {
        recordDrop(report, {
          path: `pull.collections[${i}]["${pulled.name ?? pulled.id}"]`,
          reason: `Collection was not imported: ${failureReason(err)}`,
          tracking: 'PERMANENT: write-path failure',
        });
      }
    }
    for (let i = 0; i < result.environments.length; i++) {
      const pulled = result.environments[i];
      if (!pulled) continue;
      try {
        environments += await materializeEnvironment(pulled.json, i, report, mintCtx);
      } catch (err) {
        recordDrop(report, {
          path: `pull.environments[${i}]["${pulled.name ?? pulled.id}"]`,
          reason: `Environment was not imported: ${failureReason(err)}`,
          tracking: 'PERMANENT: write-path failure',
        });
      }
    }
  } finally {
    releaseWorkspaceService(landing.id);
  }

  report.summary = { ...report.summary, imported: requests + environments };
  await recordImportReport(report, landing.id);

  return {
    workspaceId: landing.id,
    workspaceName: landing.name,
    collections,
    environments,
    requests,
    drops: report.summary.dropped,
  };
}

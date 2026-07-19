/**
 * Workspace-tree runtime — the Node host's live binding layer
 * (GIT_PLAN.md §10 Phase 2, the S4 engine wiring). One instance per
 * host process, installed by the daemon spine:
 *
 *   - binding registry: `OH.workspaceTreeBindings` (host-local — a
 *     binding is a statement about this machine's filesystem);
 *   - snapshot provider: the bound workspace's `wsKeys` slots +
 *     workspace meta → `WorkspaceTreeState`, with the sidecar's
 *     unknown-field rows riding along (the S3 unknown-rows loop);
 *   - rung 1: every committed envelope for a bound workspace schedules
 *     a debounced materialize (§3.2 — materialize is always on);
 *   - rung 2: bind-open runs the MANDATORY cold-boot tree-wins sweep
 *     (S3 §11.2), and the filesystem watcher schedules the same sweep
 *     for live external edits;
 *   - §8 single actor: per binding, sweeps and materialize passes run
 *     on ONE promise chain — they never interleave.
 *
 * A bound workspace holds its sync service resident (refcount) for the
 * binding's lifetime: virtual batches and snapshot reads need the
 * oracle live even when no surface has the workspace open.
 */

import { OH, type WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import type { MutatorContext } from '@openheaders/core/sync';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Workspace } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import type { TreeIssue, WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  type WorkspaceServiceState,
} from '@openheaders/oracle/sync/service';
import { getWorkspace, listWorkspaces } from '@openheaders/oracle/workspace/extension-workspace-store';
import { type BindWorkspaceTreeResult, bindWorkspaceTree, probeWorkspaceTree, unbindWorkspaceTree } from './bind';
import { WorkspaceTreeMaterializer } from './materializer';
import { readTreeUnknownFields } from './sidecar';
import { type SweepWorkspaceTreeResult, sweepWorkspaceTree } from './sweep';
import { WorkspaceTreeWatcher } from './watcher';

const SCOPE = 'workspace-tree-runtime';

/** Surface attribution for tree-authored virtual batches. */
const TREE_SURFACE_ID = 'tree';

const MATERIALIZE_DEBOUNCE_MS = 500;

export type BindWorkspaceTreeRpcResult =
  | { ok: true; initialized: boolean; sweep: SweepWorkspaceTreeResult | null }
  | { ok: false; reason: 'unknown-workspace' | 'already-bound' }
  | Exclude<BindWorkspaceTreeResult, { ok: true }>;

export interface WorkspaceTreeRuntime {
  /** Reopen persisted bindings; call once after the sync engine boots. */
  start(): Promise<void>;
  /** Rung-1 feed — call on every committed envelope (host hook). */
  onSyncEvent(event: OracleSyncBroadcastEvent): void;
  bind(workspaceId: string, rootDir: string): Promise<BindWorkspaceTreeRpcResult>;
  unbind(workspaceId: string): Promise<{ ok: boolean }>;
  probe(rootDir: string): ReturnType<typeof probeWorkspaceTree>;
  list(): WorkspaceTreeBindingRecord[];
  /** Latest sweep issues per bound workspace — the quarantine seam's surface. */
  issues(workspaceId: string): TreeIssue[];
  dispose(): Promise<void>;
}

interface OpenBinding {
  record: WorkspaceTreeBindingRecord;
  service: WorkspaceServiceState;
  materializer: WorkspaceTreeMaterializer;
  watcher: WorkspaceTreeWatcher;
  /** §8 single actor — every sweep + materialize pass chains here. */
  chain: Promise<void>;
  materializeTimer: NodeJS.Timeout | null;
  issues: TreeIssue[];
  closed: boolean;
}

export interface WorkspaceTreeRuntimeOptions {
  /** Stable engine-instance identity for the `.oh/lock` file. */
  hostId: string;
}

export function createWorkspaceTreeRuntime(options: WorkspaceTreeRuntimeOptions): WorkspaceTreeRuntime {
  const open = new Map<string, OpenBinding>();
  let records: WorkspaceTreeBindingRecord[] = [];
  let disposed = false;

  const persistRecords = async (): Promise<void> => {
    await hostStorage.set(OH.workspaceTreeBindings, records);
  };

  /** The workspace entity the manifest carries — meta + the synced default-env pointer. */
  const workspaceEntity = async (workspaceId: string): Promise<Workspace | null> => {
    const meta = getWorkspace(workspaceId);
    if (!meta) return null;
    const defaultEnvironmentId = await hostStorage.get(wsKeys(workspaceId).defaultEnvironmentId);
    return {
      schemaVersion: 5,
      uid: meta.id,
      name: meta.name,
      ...(meta.description !== undefined ? { description: meta.description } : {}),
      ...(defaultEnvironmentId ? { defaultEnvironmentId } : {}),
      orgId: meta.orgId,
    };
  };

  const buildSnapshot = async (workspaceId: string): Promise<WorkspaceTreeState> => {
    const workspace = await workspaceEntity(workspaceId);
    if (!workspace) throw new Error(`workspace ${workspaceId} is gone`);
    const k = wsKeys(workspaceId);
    const src = await hostStorage.getMany({
      rules: k.rules,
      collections: k.collections,
      folders: k.folders,
      requests: k.requests,
      grpcRequests: k.grpcRequests,
      websocketRequests: k.websocketRequests,
      requestCollections: k.requestCollections,
      requestFolders: k.requestFolders,
      templates: k.templates,
      templateCollections: k.templateCollections,
      templateFolders: k.templateFolders,
      environments: k.environments,
      workspaceVars: k.workspaceVars,
      vault: k.vault,
      specs: k.specs,
      liveWorkflows: k.liveWorkflows,
      liveVariables: k.liveVariables,
    });
    return {
      workspace,
      rules: src.rules ?? [],
      collections: src.collections ?? [],
      folders: src.folders ?? [],
      requests: src.requests ?? [],
      grpcRequests: src.grpcRequests ?? [],
      websocketRequests: src.websocketRequests ?? [],
      requestCollections: src.requestCollections ?? [],
      requestFolders: src.requestFolders ?? [],
      templates: src.templates ?? [],
      templateCollections: src.templateCollections ?? [],
      templateFolders: src.templateFolders ?? [],
      environments: src.environments ?? [],
      workspaceVariables: src.workspaceVars ?? null,
      vault: src.vault ?? null,
      specs: src.specs ?? [],
      liveWorkflows: src.liveWorkflows ?? [],
      liveVariables: src.liveVariables ?? [],
    };
  };

  const enqueue = (binding: OpenBinding, op: () => Promise<void>): void => {
    binding.chain = binding.chain.then(op, op).catch((err: unknown) => {
      logger.warn(SCOPE, `tree op failed for ${binding.record.rootDir}`, err);
    });
  };

  const applyAll = async (service: WorkspaceServiceState, batches: EmissionBatch[]): Promise<void> => {
    for (const { label, batch, sideEffects } of batches) {
      const result = await service.oracle.apply(batch, sideEffects);
      if (!result.ok) {
        logger.warn(SCOPE, `tree batch ${label} rejected (${result.failure?.status ?? 'unknown'})`);
      }
    }
  };

  const runSweep = async (binding: OpenBinding): Promise<SweepWorkspaceTreeResult | null> => {
    if (binding.closed) return null;
    const { service, record } = binding;
    await service.hydrated;
    const snapshot = await buildSnapshot(record.workspaceId);
    const result = await sweepWorkspaceTree({
      rootDir: record.rootDir,
      workspaceUid: record.workspaceId,
      snapshot,
      nextCtx: (): MutatorContext => service.context.next({ surfaceId: TREE_SURFACE_ID }),
      liveSetEntries: (entityType, id, setPath) =>
        service.oracle
          .liveOrderedSetItems(entityType, id, setPath)
          .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      apply: (batches) => applyAll(service, batches),
    });
    if (result.ok) {
      binding.issues = result.issues;
      if (result.applied > 0 || result.changed > 0 || result.removed > 0) {
        logger.info(
          SCOPE,
          `sweep ${record.rootDir}: ${result.applied} batches (${result.changed} changed, ${result.removed} removed, ${result.issues.length} issues)`,
        );
      }
    } else {
      binding.issues = result.issues;
      logger.warn(SCOPE, `sweep refused for ${record.rootDir}: ${result.reason}`);
    }
    return result;
  };

  const scheduleMaterialize = (binding: OpenBinding): void => {
    if (binding.closed) return;
    if (binding.materializeTimer) clearTimeout(binding.materializeTimer);
    binding.materializeTimer = setTimeout(() => {
      binding.materializeTimer = null;
      enqueue(binding, async () => {
        await binding.materializer.flush();
      });
    }, MATERIALIZE_DEBOUNCE_MS);
  };

  const openBinding = async (record: WorkspaceTreeBindingRecord): Promise<OpenBinding> => {
    const service = getOrCreateWorkspaceService(record.workspaceId);
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: record.rootDir,
      readSnapshot: async () => ({
        state: await buildSnapshot(record.workspaceId),
        unknowns: await readTreeUnknownFields(record.rootDir),
      }),
      log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
    });
    let binding: OpenBinding;
    const watcher = new WorkspaceTreeWatcher({
      rootDir: record.rootDir,
      onQuiescence: () =>
        enqueue(binding, async () => {
          await runSweep(binding);
          await binding.materializer.flush();
        }),
      log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
    });
    binding = {
      record,
      service,
      materializer,
      watcher,
      chain: Promise.resolve(),
      materializeTimer: null,
      issues: [],
      closed: false,
    };
    open.set(record.workspaceId, binding);
    watcher.start();
    return binding;
  };

  const closeBinding = async (binding: OpenBinding): Promise<void> => {
    binding.closed = true;
    binding.watcher.dispose();
    if (binding.materializeTimer) {
      clearTimeout(binding.materializeTimer);
      binding.materializeTimer = null;
    }
    binding.materializer.dispose();
    await binding.chain;
    open.delete(binding.record.workspaceId);
    releaseWorkspaceService(binding.record.workspaceId);
  };

  return {
    async start(): Promise<void> {
      records = (await hostStorage.get(OH.workspaceTreeBindings)) ?? [];
      for (const record of records) {
        const workspace = await workspaceEntity(record.workspaceId);
        if (!workspace) {
          logger.warn(SCOPE, `binding for unknown workspace ${record.workspaceId} skipped (${record.rootDir})`);
          continue;
        }
        const bound = await bindWorkspaceTree({
          rootDir: record.rootDir,
          workspace,
          knownWorkspaceUids: listWorkspaces()
            .map((ws) => ws.id)
            .filter((id) => id !== record.workspaceId),
          hostId: options.hostId,
        });
        if (!bound.ok) {
          logger.warn(SCOPE, `re-bind refused for ${record.rootDir}: ${bound.reason}`);
          continue;
        }
        try {
          const binding = await openBinding(record);
          // §11.2 MANDATORY cold-boot tree-wins sweep, then a materialize
          // pass so engine-side changes made while unbound land on disk.
          enqueue(binding, async () => {
            await runSweep(binding);
            await binding.materializer.flush();
          });
        } catch (err) {
          logger.warn(SCOPE, `binding open failed for ${record.rootDir}`, err);
        }
      }
    },

    onSyncEvent(event: OracleSyncBroadcastEvent): void {
      if (disposed) return;
      const binding = open.get(event.envelope.workspaceId);
      if (binding) scheduleMaterialize(binding);
    },

    async bind(workspaceId: string, rootDir: string): Promise<BindWorkspaceTreeRpcResult> {
      if (records.some((record) => record.workspaceId === workspaceId)) {
        return { ok: false, reason: 'already-bound' };
      }
      const workspace = await workspaceEntity(workspaceId);
      if (!workspace) return { ok: false, reason: 'unknown-workspace' };
      const bound = await bindWorkspaceTree({
        rootDir,
        workspace,
        knownWorkspaceUids: listWorkspaces()
          .map((ws) => ws.id)
          .filter((id) => id !== workspaceId),
        hostId: options.hostId,
      });
      if (!bound.ok) return bound;

      const record: WorkspaceTreeBindingRecord = { workspaceId, rootDir };
      records = [...records, record];
      await persistRecords();
      const binding = await openBinding(record);

      // The same open ritual as start(): tree wins first, then the
      // engine materializes what the tree lacks.
      let sweep: SweepWorkspaceTreeResult | null = null;
      enqueue(binding, async () => {
        sweep = await runSweep(binding);
        await binding.materializer.flush();
      });
      await binding.chain;
      return { ok: true, initialized: bound.initialized, sweep };
    },

    async unbind(workspaceId: string): Promise<{ ok: boolean }> {
      const binding = open.get(workspaceId);
      if (binding) await closeBinding(binding);
      const record = records.find((entry) => entry.workspaceId === workspaceId);
      records = records.filter((entry) => entry.workspaceId !== workspaceId);
      await persistRecords();
      if (record) await unbindWorkspaceTree(record.rootDir, options.hostId);
      return { ok: record !== undefined };
    },

    probe(rootDir: string): ReturnType<typeof probeWorkspaceTree> {
      return probeWorkspaceTree(rootDir);
    },

    list(): WorkspaceTreeBindingRecord[] {
      return [...records];
    },

    issues(workspaceId: string): TreeIssue[] {
      return open.get(workspaceId)?.issues ?? [];
    },

    async dispose(): Promise<void> {
      disposed = true;
      for (const binding of [...open.values()]) {
        await closeBinding(binding);
        await unbindWorkspaceTree(binding.record.rootDir, options.hostId);
      }
    },
  };
}

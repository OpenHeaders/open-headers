/**
 * Workspace-tree runtime — composition root (GIT_PLAN.md §10 Phase 2,
 * the S4 engine wiring). One instance per host process, installed by
 * the daemon spine. The behavior lives in the focused pass modules:
 *
 *   - `core.ts`      — OpenBinding + RuntimeCtx seam + constants
 *   - `snapshot.ts`  — workspace snapshot assembly + batch applicator
 *   - `status.ts`    — §9 status authority (compute/read/publish)
 *   - `watermark.ts` — §16 per-branch sync watermark + detector
 *   - `sweep.ts`     — rung-2 tree-wins sweep + op-hold + materialize
 *   - `commit.ts`    — commit pass + identity + cadence machinery
 *   - `sync.ts`      — fetch/pull/push/auto-push/§16 resolution
 *   - `branches.ts`  — switch/create/delete/update/merge (§6 + IDE bar)
 *   - `history.ts`   — log/refs/diff/compare/console reads (§9)
 *   - `lifecycle.ts` — binding open/close wiring
 *
 * This file owns what is genuinely global: the binding-record
 * registry, the audit-ring git runner, the availability probe, and the
 * `WorkspaceTreeRuntime` interface implementation delegating into the
 * passes through one shared `RuntimeCtx`.
 */

import { OH, type WorkspaceTreeBindingRecord } from '@openheaders/core/storage';
import { logger } from '@openheaders/core/utils';
import type { TreeIssue } from '@openheaders/core/workspace-tree';
import { hostStorage } from '@openheaders/oracle/storage';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import { listWorkspaces } from '@openheaders/oracle/workspace/extension-workspace-store';
import {
  createGitExec,
  type GitAuditRow,
  type GitAvailability,
  type GitRunner,
  isWorkspaceRepo,
  probeGitAvailability,
  pushHeadToNewBranch,
} from '../../git';
import { bindWorkspaceTree, probeWorkspaceTree, unbindWorkspaceTree } from '../bind';
import type { ForcePushChoice } from '../force-push';
import type { SweepWorkspaceTreeResult } from '../sweep';
import type { SwitchDirtyAction } from '../switch';
import {
  runCreateBranch,
  runDeleteBranch,
  runMergeBranch,
  runSwitchBranch,
  runUpdateBranch,
  syncLogBranch,
} from './branches';
import {
  applyCadenceTimers,
  drainIntents,
  enqueueAutoCommit,
  resolveContributors,
  runCommit,
  scheduleAutoCommit,
  syntheticIdentity,
} from './commit';
import {
  FETCH_FOCUS_MIN_MS,
  GIT_CONSOLE_CAP,
  MAX_PENDING_INTENTS,
  type OpenBinding,
  type RuntimeCtx,
  SCOPE,
} from './core';
import { runCompareRefs, runFileDiff, runFileLog, runGitConsole, runListRefs, runWorkspaceLog } from './history';
import { closeBinding, openBinding } from './lifecycle';
import { applyAll, buildSnapshot, workspaceEntity } from './snapshot';
import { notBoundStatus, publishGitStatus, readGitStatus } from './status';
import { appendIssues, heldByGitOperation, refreshIssuesFromDisk, runSweep, scheduleMaterialize } from './sweep';
import { enqueueFetch, maybeAutoPush, runFetchAll, runPull, runPush, runResolveForcePush } from './sync';
import type {
  BindWorkspaceTreeRpcResult,
  CommitWorkspaceTreeRpcResult,
  CompareRefsRpcResult,
  CreateBranchOptions,
  CreateBranchRpcResult,
  DeleteBranchRpcResult,
  FetchWorkspaceTreeRpcResult,
  MergeBranchRpcResult,
  PullWorkspaceTreeRpcResult,
  PushWorkspaceTreeRpcResult,
  ResolveForcePushRpcResult,
  SwitchBranchRpcResult,
  UpdateBranchRpcResult,
  WorkspaceTreeChangesRpcResult,
  WorkspaceTreeCommitCadence,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeGitConsoleRpcResult,
  WorkspaceTreeGitStatusRpcResult,
  WorkspaceTreeLogFilters,
  WorkspaceTreeLogRpcResult,
  WorkspaceTreeRefsRpcResult,
  WorkspaceTreeRuntime,
  WorkspaceTreeRuntimeOptions,
  WorkspaceTreeUserCommitInput,
  WorkspaceTreeUserCommitRpcResult,
} from './types';
import { runListChanges, runUserCommit, runWorkingFileDiff, validateUserCommitInput } from './user-commit';
import { detectForcePush, recordWatermark, watermarkFor } from './watermark';

export type {
  BindWorkspaceTreeRpcResult,
  CommitWorkspaceTreeRpcResult,
  CompareRefsRpcResult,
  CreateBranchOptions,
  CreateBranchRpcResult,
  DeleteBranchRpcResult,
  FetchWorkspaceTreeRpcResult,
  MergeBranchRpcResult,
  PullWorkspaceTreeRpcResult,
  PushWorkspaceTreeRpcResult,
  ResolveForcePushRpcResult,
  SwitchBranchRpcResult,
  UpdateBranchRpcResult,
  WorkspaceTreeChangesRpcResult,
  WorkspaceTreeCommitCadence,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeGitConsoleRpcResult,
  WorkspaceTreeGitStatusRpcResult,
  WorkspaceTreeLogFilters,
  WorkspaceTreeLogRpcResult,
  WorkspaceTreeRefsRpcResult,
  WorkspaceTreeRuntime,
  WorkspaceTreeRuntimeOptions,
  WorkspaceTreeUserCommitInput,
  WorkspaceTreeUserCommitRpcResult,
} from './types';

export function createWorkspaceTreeRuntime(options: WorkspaceTreeRuntimeOptions): WorkspaceTreeRuntime {
  const open = new Map<string, OpenBinding>();
  let records: WorkspaceTreeBindingRecord[] = [];
  let disposed = false;

  // Read-only console feed (§9, IDE-log Console tab): the last N audit
  // rows of the REAL git plane, host-global, filtered per binding at
  // read time. Injected runners (tests, the fault suite) bypass
  // `createGitExec`, so their commands never reach the feed — the
  // console mirrors what actually ran on the user's repo.
  const consoleRows: GitAuditRow[] = [];
  const gitRun: GitRunner =
    options.gitRunner ??
    createGitExec({
      audit: (row) => {
        logger.info(SCOPE, `git ${row.args.join(' ')} → ${row.code} (${row.durationMs}ms)`);
        consoleRows.push(row);
        if (consoleRows.length > GIT_CONSOLE_CAP) consoleRows.splice(0, consoleRows.length - GIT_CONSOLE_CAP);
      },
    });

  // Availability is a property of the machine, probed once per process
  // (missing git ⇒ the git plane disables itself loudly, §7 — bindings
  // and the tree plane keep working untouched).
  let gitAvailability: Promise<GitAvailability> | null = null;

  const persistRecords = async (): Promise<void> => {
    await hostStorage.set(OH.workspaceTreeBindings, records);
  };

  const ctx: RuntimeCtx = {
    options,
    open,
    gitRun,
    consoleRows,
    ensureGitAvailability: (cwd) => {
      gitAvailability ??= probeGitAvailability(gitRun, cwd);
      return gitAvailability;
    },
    enqueue: (binding, op) => {
      binding.chain = binding.chain.then(op, op).catch((err: unknown) => {
        logger.warn(SCOPE, `tree op failed for ${binding.record.rootDir}`, err);
      });
    },
    buildSnapshot,
    applyAll,
    /** Patch one binding's persisted record (cadence, toggles, the §16 watermark) and keep the open binding in step. */
    updateBindingRecord: async (workspaceId, patch) => {
      const record = records.find((entry) => entry.workspaceId === workspaceId);
      if (!record) return null;
      const next: WorkspaceTreeBindingRecord = { ...record, ...patch };
      records = records.map((entry) => (entry.workspaceId === workspaceId ? next : entry));
      await persistRecords();
      const binding = open.get(workspaceId);
      if (binding) binding.record = next;
      return next;
    },
    readGitStatus: (binding) => readGitStatus(ctx, binding),
    publishGitStatus: (binding) => publishGitStatus(ctx, binding),
    runSweep: (binding) => runSweep(ctx, binding),
    scheduleMaterialize: (binding) => scheduleMaterialize(ctx, binding),
    heldByGitOperation: (binding) => heldByGitOperation(ctx, binding),
    appendIssues,
    refreshIssuesFromDisk,
    syntheticIdentity,
    drainIntents,
    resolveContributors: (binding) => resolveContributors(ctx, binding),
    runCommit: (binding, messageOverride) => runCommit(ctx, binding, messageOverride),
    scheduleAutoCommit: (binding) => scheduleAutoCommit(ctx, binding),
    applyCadenceTimers: (binding) => applyCadenceTimers(ctx, binding),
    enqueueAutoCommit: (binding, trigger) => enqueueAutoCommit(ctx, binding, trigger),
    watermarkFor,
    recordWatermark: (binding, sha) => recordWatermark(ctx, binding, sha),
    detectForcePush: (binding, branch, upstream) => detectForcePush(ctx, binding, branch, upstream),
    enqueueFetch: (binding, trigger) => enqueueFetch(ctx, binding, trigger),
    maybeAutoPush: (binding) => maybeAutoPush(ctx, binding),
    syncLogBranch: (binding) => syncLogBranch(ctx, binding),
  };

  /** Run a gesture pass on the binding's chain and answer its result. */
  const onChain = async <T>(binding: OpenBinding, fallback: T, pass: () => Promise<T>): Promise<T> => {
    let result: T = fallback;
    ctx.enqueue(binding, async () => {
      result = await pass();
    });
    await binding.chain;
    return result;
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
          const binding = await openBinding(ctx, record);
          // §11.2 MANDATORY cold-boot tree-wins sweep, then a materialize
          // pass so engine-side changes made while unbound land on disk.
          ctx.enqueue(binding, async () => {
            await ctx.runSweep(binding);
            await binding.materializer.flush();
            await ctx.publishGitStatus(binding);
          });
        } catch (err) {
          logger.warn(SCOPE, `binding open failed for ${record.rootDir}`, err);
        }
      }
    },

    onSyncEvent(event: OracleSyncBroadcastEvent): void {
      if (disposed) return;
      const binding = open.get(event.envelope.workspaceId);
      if (!binding) return;
      ctx.scheduleMaterialize(binding);
      const { body, origin } = event.envelope;
      if (binding.intents.length < MAX_PENDING_INTENTS) {
        binding.intents.push({ kind: body.kind, entityType: body.type, entityId: body.id });
      }
      // §23.6: the ingest-stamped credential userId — absent on
      // locally-minted batches (the operator's own work needs no entry).
      if (origin.userId !== undefined) binding.contributors.add(origin.userId);
      ctx.scheduleAutoCommit(binding);
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
      const binding = await openBinding(ctx, record);

      // The same open ritual as start(): tree wins first, then the
      // engine materializes what the tree lacks.
      let sweep: SweepWorkspaceTreeResult | null = null;
      ctx.enqueue(binding, async () => {
        sweep = await ctx.runSweep(binding);
        await binding.materializer.flush();
        await ctx.publishGitStatus(binding);
      });
      await binding.chain;
      return { ok: true, initialized: bound.initialized, sweep };
    },

    async unbind(workspaceId: string): Promise<{ ok: boolean }> {
      const binding = open.get(workspaceId);
      if (binding) await closeBinding(ctx, binding);
      const record = records.find((entry) => entry.workspaceId === workspaceId);
      records = records.filter((entry) => entry.workspaceId !== workspaceId);
      await persistRecords();
      if (record) {
        await unbindWorkspaceTree(record.rootDir, options.hostId);
        options.onGitStatus?.(workspaceId, notBoundStatus());
      }
      return { ok: record !== undefined };
    },

    probe(rootDir: string): ReturnType<typeof probeWorkspaceTree> {
      return probeWorkspaceTree(rootDir);
    },

    async commit(workspaceId: string, message?: string): Promise<CommitWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<CommitWorkspaceTreeRpcResult>(
        binding,
        { ok: false, reason: 'commit-failed', detail: 'commit pass did not run' },
        async () => {
          const result = await ctx.runCommit(binding, message);
          if (result.ok && result.committed) await ctx.maybeAutoPush(binding);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async pull(workspaceId: string): Promise<PullWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<PullWorkspaceTreeRpcResult>(
        binding,
        { ok: false, reason: 'fetch-failed', detail: 'pull pass did not run' },
        async () => {
          const result = await runPull(ctx, binding);
          if (result.ok && !result.upToDate) await ctx.maybeAutoPush(binding);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async push(workspaceId: string): Promise<PushWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<PushWorkspaceTreeRpcResult>(
        binding,
        { ok: false, reason: 'push-failed', detail: 'push pass did not run' },
        async () => {
          const result = await runPush(ctx, binding);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async pushNewBranch(workspaceId: string, branch: string): Promise<PushWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<PushWorkspaceTreeRpcResult>(
        binding,
        { ok: false, reason: 'push-failed', detail: 'push pass did not run' },
        async () => {
          const availability = await ctx.ensureGitAvailability(binding.record.rootDir);
          if (!availability.available) return { ok: false, reason: 'git-unavailable' };
          if (!(await isWorkspaceRepo(gitRun, binding.record.rootDir))) return { ok: false, reason: 'not-a-repo' };
          const result = await pushHeadToNewBranch(gitRun, binding.record.rootDir, branch);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async setAutoPushOnCommit(workspaceId: string, autoPushOnCommit: boolean): Promise<{ ok: boolean }> {
      const next = await ctx.updateBindingRecord(workspaceId, { autoPushOnCommit });
      if (next === null) return { ok: false };
      const binding = open.get(workspaceId);
      if (binding) await ctx.publishGitStatus(binding);
      return { ok: true };
    },

    async resolveForcePush(workspaceId: string, choice: ForcePushChoice): Promise<ResolveForcePushRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<ResolveForcePushRpcResult>(
        binding,
        { ok: false, reason: 'fetch-failed', detail: 'resolution pass did not run' },
        async () => {
          const result = await runResolveForcePush(ctx, binding, choice);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async switchBranch(
      workspaceId: string,
      branch: string,
      dirtyAction?: SwitchDirtyAction,
    ): Promise<SwitchBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<SwitchBranchRpcResult>(
        binding,
        { ok: false, reason: 'checkout-failed', detail: 'switch pass did not run' },
        async () => {
          const result = await runSwitchBranch(ctx, binding, branch, dirtyAction);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async createBranch(
      workspaceId: string,
      branch: string,
      createOptions?: CreateBranchOptions,
    ): Promise<CreateBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<CreateBranchRpcResult>(
        binding,
        { ok: false, reason: 'create-failed', detail: 'create pass did not run' },
        async () => {
          const result = await runCreateBranch(ctx, binding, branch, createOptions);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async deleteBranch(workspaceId: string, branch: string): Promise<DeleteBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<DeleteBranchRpcResult>(
        binding,
        { ok: false, reason: 'delete-failed', detail: 'delete pass did not run' },
        async () => {
          const result = await runDeleteBranch(ctx, binding, branch);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async updateBranch(workspaceId: string, branch: string): Promise<UpdateBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<UpdateBranchRpcResult>(
        binding,
        { ok: false, reason: 'update-failed', detail: 'update pass did not run' },
        async () => {
          const result = await runUpdateBranch(ctx, binding, branch);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async fetch(workspaceId: string): Promise<FetchWorkspaceTreeRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<FetchWorkspaceTreeRpcResult>(
        binding,
        { ok: false, reason: 'fetch-failed', detail: 'fetch pass did not run' },
        async () => {
          const result = await runFetchAll(ctx, binding);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    async mergeBranch(workspaceId: string, ref: string): Promise<MergeBranchRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      return onChain<MergeBranchRpcResult>(
        binding,
        { ok: false, reason: 'commit-failed', detail: 'merge pass did not run' },
        async () => {
          const result = await runMergeBranch(ctx, binding, ref);
          if (result.ok && !result.upToDate) await ctx.maybeAutoPush(binding);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    notifyAppFocus(): void {
      if (disposed) return;
      for (const binding of open.values()) {
        if (Date.now() - binding.lastFetchAt < FETCH_FOCUS_MIN_MS) continue;
        ctx.enqueueFetch(binding, 'focus');
      }
    },

    async gitStatus(workspaceId: string): Promise<WorkspaceTreeGitStatusRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return notBoundStatus();
      return ctx.readGitStatus(binding);
    },

    log(
      workspaceId: string,
      limit?: number,
      ref?: string,
      filters?: WorkspaceTreeLogFilters,
    ): Promise<WorkspaceTreeLogRpcResult> {
      return runWorkspaceLog(ctx, workspaceId, limit, ref, filters);
    },

    fileLog(workspaceId: string, filePath: string, limit?: number): Promise<WorkspaceTreeLogRpcResult> {
      return runFileLog(ctx, workspaceId, filePath, limit);
    },

    changes(workspaceId: string, includeIgnored?: boolean): Promise<WorkspaceTreeChangesRpcResult> {
      return runListChanges(ctx, workspaceId, includeIgnored);
    },

    workingFileDiff(workspaceId: string, filePath: string): Promise<WorkspaceTreeFileDiffRpcResult> {
      return runWorkingFileDiff(ctx, workspaceId, filePath);
    },

    async userCommit(
      workspaceId: string,
      input: WorkspaceTreeUserCommitInput,
    ): Promise<WorkspaceTreeUserCommitRpcResult> {
      const binding = open.get(workspaceId);
      if (!binding) return { ok: false, reason: 'not-bound' };
      const valid = validateUserCommitInput(input);
      if (!valid.ok) return { ok: false, reason: valid.reason };
      return onChain<WorkspaceTreeUserCommitRpcResult>(
        binding,
        { ok: false, reason: 'commit-failed', detail: 'commit pass did not run' },
        async () => {
          const result = await runUserCommit(ctx, binding, input);
          if (result.ok && result.committed) await ctx.maybeAutoPush(binding);
          await ctx.publishGitStatus(binding);
          return result;
        },
      );
    },

    listRefs(workspaceId: string): Promise<WorkspaceTreeRefsRpcResult> {
      return runListRefs(ctx, workspaceId);
    },

    compareRefs(workspaceId: string, ref: string): Promise<CompareRefsRpcResult> {
      return runCompareRefs(ctx, workspaceId, ref);
    },

    fileDiff(workspaceId: string, sha: string, filePath: string): Promise<WorkspaceTreeFileDiffRpcResult> {
      return runFileDiff(ctx, workspaceId, sha, filePath);
    },

    gitConsole(workspaceId: string): Promise<WorkspaceTreeGitConsoleRpcResult> {
      return runGitConsole(ctx, workspaceId);
    },

    async setCommitCadence(workspaceId: string, cadence: WorkspaceTreeCommitCadence): Promise<{ ok: boolean }> {
      const next = await ctx.updateBindingRecord(workspaceId, { commitCadence: cadence });
      if (next === null) return { ok: false };
      const binding = open.get(workspaceId);
      if (binding) {
        ctx.applyCadenceTimers(binding);
        await ctx.publishGitStatus(binding);
      }
      return { ok: true };
    },

    async setBypassHooks(workspaceId: string, bypassHooks: boolean): Promise<{ ok: boolean }> {
      const next = await ctx.updateBindingRecord(workspaceId, { bypassHooks });
      if (next === null) return { ok: false };
      const binding = open.get(workspaceId);
      if (binding) await ctx.publishGitStatus(binding);
      return { ok: true };
    },

    notifyAppBlur(): void {
      if (disposed) return;
      for (const binding of open.values()) {
        if ((binding.record.commitCadence ?? 'off') === 'on-blur') ctx.enqueueAutoCommit(binding, 'blur');
      }
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
        await closeBinding(ctx, binding);
        await unbindWorkspaceTree(binding.record.rootDir, options.hostId);
      }
    },
  };
}

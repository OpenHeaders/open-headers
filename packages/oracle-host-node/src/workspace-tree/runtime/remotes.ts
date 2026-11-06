/**
 * Workspace-tree runtime — the Git Remotes dialog's verbs: list the
 * configured remotes, add one, update one (a rename and/or a new
 * fetch url, in that order), remove one. The reads and the writes
 * share the availability / repo guards; the verb wiring runs every
 * write on the per-binding chain and publishes a status frame after,
 * so the rail's remote folders and the upstream counts follow on
 * their own. Names and urls are re-checked by the plumbing.
 */

import { logger } from '@openheaders/core/utils';
import {
  addRemote,
  isWorkspaceRepo,
  listRemotes,
  type RemoteOpResult,
  removeRemote,
  renameRemote,
  setRemoteUrl,
} from '../../git';
import { type OpenBinding, type RuntimeCtx, SCOPE } from './core';
import type { WorkspaceTreeRemoteOpRpcResult, WorkspaceTreeRemotePatch, WorkspaceTreeRemotesRpcResult } from './types';

type Guarded = { ok: true; rootDir: string } | { ok: false; reason: 'git-unavailable' | 'not-a-repo' };

async function guard(ctx: RuntimeCtx, binding: OpenBinding): Promise<Guarded> {
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  return { ok: true, rootDir };
}

const opResult = (result: RemoteOpResult): WorkspaceTreeRemoteOpRpcResult =>
  result.ok
    ? { ok: true }
    : { ok: false, reason: result.reason, ...(result.detail !== undefined ? { detail: result.detail } : {}) };

/** The dialog's list — a pure read. */
export async function runListRemotes(ctx: RuntimeCtx, binding: OpenBinding): Promise<WorkspaceTreeRemotesRpcResult> {
  const guarded = await guard(ctx, binding);
  if (!guarded.ok) return guarded;
  const remotes = await listRemotes(ctx.gitRun, guarded.rootDir);
  if (remotes === null) return { ok: false, reason: 'list-failed' };
  return { ok: true, remotes };
}

/** One Add pass. */
export async function runAddRemote(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  name: string,
  url: string,
): Promise<WorkspaceTreeRemoteOpRpcResult> {
  const guarded = await guard(ctx, binding);
  if (!guarded.ok) return guarded;
  const result = await addRemote(ctx.gitRun, guarded.rootDir, name, url);
  if (result.ok) logger.info(SCOPE, `remote ${name} added for ${guarded.rootDir}`);
  return opResult(result);
}

/** One Edit pass — the rename first (so the url lands on the new name), then the url; the first refusal stops it. */
export async function runUpdateRemote(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  name: string,
  patch: WorkspaceTreeRemotePatch,
): Promise<WorkspaceTreeRemoteOpRpcResult> {
  const guarded = await guard(ctx, binding);
  if (!guarded.ok) return guarded;
  let current = name;
  if (patch.name !== undefined && patch.name !== name) {
    const renamed = await renameRemote(ctx.gitRun, guarded.rootDir, name, patch.name);
    if (!renamed.ok) return opResult(renamed);
    current = patch.name;
  }
  if (patch.url !== undefined) {
    const set = await setRemoteUrl(ctx.gitRun, guarded.rootDir, current, patch.url);
    if (!set.ok) return opResult(set);
  }
  logger.info(SCOPE, `remote ${name} updated for ${guarded.rootDir}`);
  return { ok: true };
}

/** One Remove pass. */
export async function runRemoveRemote(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  name: string,
): Promise<WorkspaceTreeRemoteOpRpcResult> {
  const guarded = await guard(ctx, binding);
  if (!guarded.ok) return guarded;
  const result = await removeRemote(ctx.gitRun, guarded.rootDir, name);
  if (result.ok) logger.info(SCOPE, `remote ${name} removed for ${guarded.rootDir}`);
  return opResult(result);
}

/**
 * `oh.workspaceTree.*` RPC dispatch — the one verb→runtime mapping,
 * shared by every admission posture that fronts the runtime: the
 * daemon spine's local `dispatchRpc` (the caller is the operator by
 * construction) and the admin console's gated wire channel
 * (`oh.daemon.workspaceTree.dispatch`, `daemon.admin`-gated in the
 * peer plane). One implementation, so a verb change can never drift
 * between the local and remote Git surfaces.
 *
 * Refusals return typed reasons the Git card renders as its dialogs;
 * verbs this host does not implement (e.g. the desktop-only native
 * `pickFolder`) answer the uniform `__error` shape so callers degrade
 * with intent.
 */

import type { WorkspaceTreeCommitCadence, WorkspaceTreeRuntime } from './runtime';

const COMMIT_CADENCE_VALUES: WorkspaceTreeCommitCadence[] = [
  'off',
  'auto',
  'on-blur',
  'every-5m',
  'every-15m',
  'every-30m',
];

export function parseCommitCadence(value: unknown): WorkspaceTreeCommitCadence {
  return COMMIT_CADENCE_VALUES.find((cadence) => cadence === value) ?? 'off';
}

/** True when `type` names a workspace-tree channel this dispatcher owns. */
export function ownsWorkspaceTreeRpc(type: unknown): type is string {
  return typeof type === 'string' && type.startsWith('oh.workspaceTree.');
}

export async function dispatchWorkspaceTreeRpc(
  runtime: WorkspaceTreeRuntime | null,
  type: string,
  message: Record<string, unknown>,
): Promise<unknown> {
  // Workspace-tree bindings (the git-sync plan §9 — the settings Git card's
  // host side); refusals return typed reasons the card renders as its
  // four dialogs.
  if (type === 'oh.workspaceTree.bind') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const rootDir = typeof message.rootDir === 'string' ? message.rootDir : '';
    if (!workspaceId || !rootDir || runtime === null) {
      return { ok: false, reason: 'unknown-workspace' };
    }
    return await runtime.bind(workspaceId, rootDir);
  }
  if (type === 'oh.workspaceTree.unbind') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false };
    return await runtime.unbind(workspaceId);
  }
  if (type === 'oh.workspaceTree.probe') {
    const rootDir = typeof message.rootDir === 'string' ? message.rootDir : '';
    if (!rootDir || runtime === null) return { present: false };
    return await runtime.probe(rootDir);
  }
  if (type === 'oh.workspaceTree.list') {
    const bindings = runtime?.list() ?? [];
    return {
      bindings: bindings.map((record) => ({
        ...record,
        issues: runtime?.issues(record.workspaceId) ?? [],
      })),
    };
  }
  // Phase 3 git plane (the git-sync plan §9/§10): the explicit Commit
  // gesture, the git slot feed, and the cadence toggle. The runtime
  // serializes commit passes on the per-binding chain (§8 single
  // actor).
  if (type === 'oh.workspaceTree.commit') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    const commitMessage = typeof message.message === 'string' ? message.message : undefined;
    return await runtime.commit(workspaceId, commitMessage);
  }
  if (type === 'oh.workspaceTree.gitStatus') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) {
      return {
        bound: false,
        git: { available: false, reason: 'missing' },
        repo: false,
        branch: null,
        branches: [],
        dirtyFiles: null,
        userIndexBusy: false,
        suggestedMessage: '',
        cadence: 'off',
        bypassHooks: false,
        upstream: null,
        ahead: null,
        behind: null,
        autoPushOnCommit: false,
        forcePush: null,
      };
    }
    return await runtime.gitStatus(workspaceId);
  }
  // Phase 4 pull (§11.4): fetch → mutator merge → two-parent commit,
  // serialized on the same per-binding chain.
  if (type === 'oh.workspaceTree.pull') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.pull(workspaceId);
  }
  // Phase 5 push + safety (§3.2 / §16 / §8.2): the explicit Push
  // gesture, the read-only-remote new-branch affordance, the
  // auto-push opt-in, and the force-push trichotomy resolution.
  if (type === 'oh.workspaceTree.push') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.push(workspaceId);
  }
  if (type === 'oh.workspaceTree.pushNewBranch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const branch = typeof message.branch === 'string' ? message.branch.trim() : '';
    if (!workspaceId || !branch || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.pushNewBranch(workspaceId, branch);
  }
  if (type === 'oh.workspaceTree.setAutoPushOnCommit') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false };
    return await runtime.setAutoPushOnCommit(workspaceId, message.autoPushOnCommit === true);
  }
  if (type === 'oh.workspaceTree.resolveForcePush') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const choice = message.choice;
    if (!workspaceId || runtime === null || (choice !== 'abandon' && choice !== 'rescue' && choice !== 'reapply')) {
      return { ok: false, reason: 'not-bound' };
    }
    return await runtime.resolveForcePush(workspaceId, choice);
  }
  if (type === 'oh.workspaceTree.setCommitCadence') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const cadence = parseCommitCadence(message.cadence);
    if (!workspaceId || runtime === null) return { ok: false };
    return await runtime.setCommitCadence(workspaceId, cadence);
  }
  if (type === 'oh.workspaceTree.setBypassHooks') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false };
    return await runtime.setBypassHooks(workspaceId, message.bypassHooks === true);
  }
  // Phase 6 branches (§6): switch/create/merge gestures — reached only
  // through an operator-posture dispatch plane (local caller, or the
  // `daemon.admin`-gated wire channel), which IS the §6 admin gating.
  if (type === 'oh.workspaceTree.switchBranch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const branch = typeof message.branch === 'string' ? message.branch.trim() : '';
    const dirtyAction = message.dirtyAction;
    if (!workspaceId || !branch || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.switchBranch(
      workspaceId,
      branch,
      dirtyAction === 'commit' || dirtyAction === 'stash' || dirtyAction === 'discard' ? dirtyAction : undefined,
    );
  }
  if (type === 'oh.workspaceTree.createBranch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const branch = typeof message.branch === 'string' ? message.branch.trim() : '';
    if (!workspaceId || !branch || runtime === null) return { ok: false, reason: 'not-bound' };
    const from = typeof message.from === 'string' && message.from.length > 0 ? message.from : undefined;
    return await runtime.createBranch(workspaceId, branch, {
      ...(from !== undefined ? { from } : {}),
      checkout: message.checkout !== false,
      overwrite: message.overwrite === true,
    });
  }
  if (type === 'oh.workspaceTree.deleteBranch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const branch = typeof message.branch === 'string' ? message.branch.trim() : '';
    if (!workspaceId || !branch || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.deleteBranch(workspaceId, branch);
  }
  if (type === 'oh.workspaceTree.updateBranch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const branch = typeof message.branch === 'string' ? message.branch.trim() : '';
    if (!workspaceId || !branch || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.updateBranch(workspaceId, branch);
  }
  if (type === 'oh.workspaceTree.fetch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.fetch(workspaceId);
  }
  if (type === 'oh.workspaceTree.mergeBranch') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const ref = typeof message.ref === 'string' ? message.ref.trim() : '';
    if (!workspaceId || !ref || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.mergeBranch(workspaceId, ref);
  }
  // Phase 7 history view (§9 / the data-plane topologies design §7.1): pure
  // repo reads — the workspace timeline and the per-path blame answer.
  if (type === 'oh.workspaceTree.log') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.log(
      workspaceId,
      typeof message.limit === 'number' ? message.limit : undefined,
      typeof message.ref === 'string' && message.ref.length > 0 ? message.ref : undefined,
      {
        ...(typeof message.author === 'string' && message.author.length > 0 ? { author: message.author } : {}),
        ...(message.authorMe === true ? { authorMe: true } : {}),
        ...(typeof message.since === 'string' && message.since.length > 0 ? { since: message.since } : {}),
        ...(typeof message.until === 'string' && message.until.length > 0 ? { until: message.until } : {}),
        ...(Array.isArray(message.paths) && message.paths.every((path): path is string => typeof path === 'string')
          ? { paths: message.paths }
          : {}),
        ...(message.noMerges === true ? { noMerges: true } : {}),
        ...(message.firstParent === true ? { firstParent: true } : {}),
        ...(message.topoOrder === true ? { topoOrder: true } : {}),
        ...(message.allRefs === true ? { allRefs: true } : {}),
      },
    );
  }
  if (type === 'oh.workspaceTree.listRefs') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.listRefs(workspaceId);
  }
  if (type === 'oh.workspaceTree.compareRefs') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const ref = typeof message.ref === 'string' ? message.ref.trim() : '';
    if (!workspaceId || !ref || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.compareRefs(workspaceId, ref);
  }
  if (type === 'oh.workspaceTree.fileDiff') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const sha = typeof message.sha === 'string' ? message.sha : '';
    const filePath = typeof message.path === 'string' ? message.path : '';
    if (!workspaceId || !sha || !filePath || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.fileDiff(workspaceId, sha, filePath);
  }
  // Commit tool window (§9): the changes-tree read, the working-tree
  // diff, and the user-driven pathspec commit (Amend carve-out with
  // typed refusals; the user's real index is never touched).
  if (type === 'oh.workspaceTree.changes') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.changes(workspaceId, message.includeIgnored === true);
  }
  if (type === 'oh.workspaceTree.workingFileDiff') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const filePath = typeof message.path === 'string' ? message.path : '';
    if (!workspaceId || !filePath || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.workingFileDiff(workspaceId, filePath);
  }
  if (type === 'oh.workspaceTree.userCommit') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const commitMessage = typeof message.message === 'string' ? message.message : '';
    const paths =
      Array.isArray(message.paths) && message.paths.every((path): path is string => typeof path === 'string')
        ? message.paths
        : null;
    if (!workspaceId || paths === null || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.userCommit(workspaceId, {
      message: commitMessage,
      paths,
      ...(message.amend === true ? { amend: true } : {}),
      ...(message.signOff === true ? { signOff: true } : {}),
      ...(message.bypassHooks === true ? { bypassHooks: true } : {}),
    });
  }
  if (type === 'oh.workspaceTree.ignorePath') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const filePath = typeof message.path === 'string' ? message.path : '';
    const target = message.target;
    if (!workspaceId || !filePath || runtime === null || (target !== 'gitignore' && target !== 'exclude')) {
      return { ok: false, reason: 'not-bound' };
    }
    return await runtime.ignorePath(workspaceId, filePath, target);
  }
  if (type === 'oh.workspaceTree.unignorePath') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const filePath = typeof message.path === 'string' ? message.path : '';
    const target = message.target;
    if (!workspaceId || !filePath || runtime === null || (target !== 'gitignore' && target !== 'exclude')) {
      return { ok: false, reason: 'not-bound' };
    }
    return await runtime.unignorePath(workspaceId, filePath, target);
  }
  if (type === 'oh.workspaceTree.fileLog') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const filePath = typeof message.path === 'string' ? message.path : '';
    if (!workspaceId || !filePath || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.fileLog(workspaceId, filePath, typeof message.limit === 'number' ? message.limit : undefined);
  }
  if (type === 'oh.workspaceTree.gitConsole') {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    if (!workspaceId || runtime === null) return { ok: false, reason: 'not-bound' };
    return await runtime.gitConsole(workspaceId);
  }
  if (type === 'oh.workspaceTree.appBlur') {
    runtime?.notifyAppBlur();
    return { ok: runtime !== null };
  }
  if (type === 'oh.workspaceTree.appFocus') {
    runtime?.notifyAppFocus();
    return { ok: runtime !== null };
  }
  return { __error: `host: RPC '${type}' is not implemented` };
}

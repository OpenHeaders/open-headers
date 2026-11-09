/**
 * useGitBranchActions — the branch verbs ONE implementation, shared by
 * every surface that offers them (the Git window's ref rail, the top
 * bar's branch widget): Checkout (the wrapped switch with the §6.2
 * dirty prompt; a remote-tracking row checks out its local branch or
 * creates the tracking branch), New Branch from… (the dialog), Merge
 * into Current (the Phase 4 machinery on a local or remote-tracking
 * ref — never raw `git merge`), Update (fast-forward a NON-current
 * branch from its upstream), Update Project (pull the current branch),
 * Push (the Push window over the current branch), Fetch, Delete
 * with the Restore toast, and Manage Remotes (the Git Remotes dialog).
 * Mutations go through the bridge and come back as
 * `workspaceTreeGitStatus` frames — nothing here refetches by hand.
 * The hook owns the dialogs' state and hands back their elements for
 * the caller to mount inside its own container.
 */

import {
  hostBridge,
  type WorkspaceTreeDeleteBranchWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { App as AntApp, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isFullCommitSha } from '../log-neighbors';
import PushCommitsModal from '../push/PushCommitsModal';
import PushRejectedModal from '../push/PushRejectedModal';
import CreateBranchModal from '../rail/CreateBranchModal';
import RemotesModal from '../remotes/RemotesModal';
import SwitchBranchModal, { type SwitchBranchPrompt, type SwitchDirtyChoice } from '../rail/SwitchBranchModal';

export interface GitBranchActionsOptions {
  workspaceId: string;
  /** The checked-out branch; null on a detached or unborn HEAD. */
  currentRef: string | null;
  /** The known refs — a start point that resolves here rides the verb by name (a full sha by itself); otherwise HEAD. */
  refs: readonly WorkspaceTreeRefWire[];
  /** The element the dialogs center over; null = the document body. */
  container: HTMLElement | null;
  /** A local branch was deleted — the caller drops any selection or scope naming it. */
  onBranchDeleted?: (branch: string) => void;
}

export interface GitBranchBusy {
  switching: boolean;
  merge: boolean;
  update: boolean;
  fetch: boolean;
  pull: boolean;
  push: boolean;
}

export interface GitBranchActions {
  checkout: (branch: string) => void;
  checkoutRemote: (ref: string) => void;
  /** The New Branch dialog anchored at a ref name or a full commit sha; null = the current branch. */
  newBranchFrom: (ref: string | null) => void;
  mergeIntoCurrent: (ref: string) => void;
  updateBranch: (branch: string) => void;
  deleteBranch: (branch: string) => void;
  fetch: () => void;
  pull: () => void;
  push: () => void;
  /** The Git Remotes dialog. */
  manageRemotes: () => void;
  busy: GitBranchBusy;
  /** The New Branch, dirty-switch, Push and Remotes dialogs — mount once in the caller's tree. */
  dialogs: React.ReactNode;
}

/** `origin/feature/x` → `feature/x`: the local name a remote-tracking checkout creates. */
export function localNameOfRemoteRef(ref: string): string {
  const cut = ref.indexOf('/');
  return cut === -1 ? ref : ref.slice(cut + 1);
}

export function useGitBranchActions(options: GitBranchActionsOptions): GitBranchActions {
  const { workspaceId, currentRef, refs, container, onBranchDeleted } = options;
  const t = useT();
  const { token } = theme.useToken();
  const { notification } = AntApp.useApp();

  const [createFrom, setCreateFrom] = useState<string | null>(null);
  const [switchPrompt, setSwitchPrompt] = useState<SwitchBranchPrompt | null>(null);
  const [switching, setSwitching] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [fetchBusy, setFetchBusy] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [pushRejected, setPushRejected] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);

  const failure = (err: unknown): string => (err instanceof Error ? err.message : String(err));

  // Checkout (§6): the wrapped switch; a dirty tree answers `dirty`
  // with the count and the §6.2 prompt re-enters the verb with the
  // user's choice. The status frame moves the star.
  const switchTo = async (branch: string, dirtyAction?: SwitchDirtyChoice): Promise<void> => {
    if (switching) return;
    setSwitching(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.switchBranch', {
        workspaceId,
        branch,
        ...(dirtyAction !== undefined ? { dirtyAction } : {}),
      });
      if (result.ok) {
        setSwitchPrompt(null);
        if (result.switched) {
          notification.info({ title: t('workbench.gitLog.switch.checkedOut', { branch }), duration: 5 });
        }
      } else if (result.reason === 'dirty') {
        setSwitchPrompt({ branch, dirtyFiles: result.dirtyFiles ?? 0 });
      } else {
        setSwitchPrompt(null);
        notification.error({
          title: t('workbench.gitLog.switch.failed', { branch, detail: result.detail ?? result.reason }),
        });
      }
    } catch (err) {
      setSwitchPrompt(null);
      notification.error({ title: t('workbench.gitLog.switch.failed', { branch, detail: failure(err) }) });
    } finally {
      setSwitching(false);
    }
  };

  // A remote-tracking row: the reference checks out the local branch of the
  // same name when it exists, otherwise creates it tracking the remote.
  const checkoutRemote = async (ref: string): Promise<void> => {
    const local = localNameOfRemoteRef(ref);
    if (refs.some((row) => row.kind === 'local' && row.name === local)) {
      await switchTo(local);
      return;
    }
    try {
      const result = await hostBridge.call('oh.workspaceTree.createBranch', {
        workspaceId,
        branch: local,
        from: ref,
        checkout: true,
      });
      if (result.ok) {
        notification.info({
          title: t('workbench.gitLog.createBranch.checkedOut', { branch: result.branch, from: ref }),
          duration: 5,
        });
      } else {
        notification.error({
          title: t('workbench.gitLog.createBranch.failed', { detail: result.detail ?? result.reason }),
        });
      }
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.createBranch.failed', { detail: failure(err) }) });
    }
  };

  // Merge into Current (§6): the Phase 4 machinery on a local or
  // remote-tracking ref — never raw `git merge`. A no-base merge
  // (shallow clone, unrelated histories) says why, like pull's toast.
  const mergeIntoCurrent = async (ref: string): Promise<void> => {
    if (mergeBusy) return;
    setMergeBusy(true);
    const branch = currentRef ?? 'HEAD';
    try {
      const result = await hostBridge.call('oh.workspaceTree.mergeBranch', { workspaceId, ref });
      if (!result.ok) {
        notification.error({
          title: t('workbench.gitLog.merge.failed', { ref, detail: result.detail ?? result.reason }),
        });
      } else if (result.upToDate) {
        notification.info({ title: t('workbench.gitLog.merge.upToDate', { ref, branch }), duration: 5 });
      } else if (result.history !== undefined) {
        notification.warning({
          title: t(
            result.history === 'shallow' ? 'workbench.gitLog.merge.doneShallow' : 'workbench.gitLog.merge.doneUnrelated',
            { ref, branch },
          ),
          duration: 8,
        });
      } else {
        notification.success({
          title: t('workbench.gitLog.merge.done', { ref, branch, sha: result.sha.slice(0, 8) }),
          duration: 5,
        });
      }
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.merge.failed', { ref, detail: failure(err) }) });
    } finally {
      setMergeBusy(false);
    }
  };

  const updateBranch = async (branch: string): Promise<void> => {
    if (updateBusy) return;
    setUpdateBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.updateBranch', { workspaceId, branch });
      if (!result.ok) {
        notification.error({
          title:
            result.reason === 'no-upstream'
              ? t('workbench.gitLog.updateBranch.noUpstream', { branch })
              : t('workbench.gitLog.updateBranch.failed', { branch, detail: result.detail ?? result.reason }),
        });
      }
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.updateBranch.failed', { branch, detail: failure(err) }) });
    } finally {
      setUpdateBusy(false);
    }
  };

  const deleteBranch = async (branch: string): Promise<void> => {
    let result: WorkspaceTreeDeleteBranchWire;
    try {
      result = await hostBridge.call('oh.workspaceTree.deleteBranch', { workspaceId, branch });
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.deleteBranch.failed', { detail: failure(err) }) });
      return;
    }
    if (!result.ok) {
      notification.error({
        title: t('workbench.gitLog.deleteBranch.failed', { detail: result.detail ?? result.reason }),
      });
      return;
    }
    onBranchDeleted?.(branch);
    const key = `git-branch-deleted-${branch}`;
    notification.info({
      key,
      title: t('workbench.gitLog.deleteBranch.deleted', { branch }),
      duration: 8,
      btn: (
        <button
          type="button"
          onClick={() => {
            notification.destroy(key);
            void hostBridge.call('oh.workspaceTree.createBranch', {
              workspaceId,
              branch,
              from: result.sha,
              checkout: false,
            });
          }}
          data-testid="git-tool-restore-branch"
          style={{
            border: 'none',
            background: 'transparent',
            color: token.colorPrimary,
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
          }}
        >
          {t('workbench.gitLog.deleteBranch.restore')}
        </button>
      ),
    });
  };

  const fetch = async (): Promise<void> => {
    if (fetchBusy) return;
    setFetchBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.fetch', { workspaceId });
      if (!result.ok) {
        notification.error({
          title:
            result.reason === 'no-remote'
              ? t('workbench.gitLog.fetch.noRemote')
              : t('workbench.gitLog.fetch.failed', { detail: result.detail ?? result.reason }),
        });
      }
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.fetch.failed', { detail: failure(err) }) });
    } finally {
      setFetchBusy(false);
    }
  };

  // Update Project — the current branch's pull (§3.4: a no-base pull
  // says why every remote file was treated as changed). Answers whether
  // the pull landed, for the Push Rejected prompt's pull-then-push.
  const pull = async (): Promise<boolean> => {
    if (pullBusy) return false;
    setPullBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.pull', { workspaceId });
      if (!result.ok) {
        notification.error({
          title:
            result.reason === 'force-push'
              ? t('workbench.commitTool.errors.historyRewritten')
              : t('workbench.commitTool.menu.pullFailed', { detail: result.detail ?? result.reason }),
        });
        return false;
      } else if (!result.upToDate && result.history !== undefined) {
        notification.warning({
          title: t(
            result.history === 'shallow'
              ? 'workbench.commitTool.menu.pullDoneShallow'
              : 'workbench.commitTool.menu.pullDoneUnrelated',
          ),
          duration: 8,
        });
      } else {
        notification.success({
          title: t(result.upToDate ? 'workbench.commitTool.menu.pullUpToDate' : 'workbench.commitTool.menu.pullDone'),
          duration: 5,
        });
      }
      return true;
    } catch (err) {
      notification.error({ title: t('workbench.commitTool.menu.pullFailed', { detail: failure(err) }) });
      return false;
    } finally {
      setPullBusy(false);
    }
  };

  // Push the current branch — the Push window's confirm (§8.2 / §16
  // typed refusals): a non-fast-forward raises the Push Rejected
  // prompt (Merge = pull, then push again), a rewrite points at the
  // banner, a read-only remote names the Commit window's
  // Push-as-New-Branch recovery.
  const pushNow = async (): Promise<void> => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const result = await hostBridge.call('oh.workspaceTree.push', { workspaceId });
      if (result.ok) {
        notification.success({
          title: t(result.pushed ? 'workbench.commitTool.pushed' : 'workbench.commitTool.nothingToPush'),
          duration: 5,
        });
        return;
      }
      if (result.reason === 'rejected') {
        setPushRejected(true);
        return;
      }
      const failed = t('workbench.commitTool.errors.pushFailed');
      const why =
        result.reason === 'no-permission'
          ? t('workbench.gitBranch.pushNoPermission')
          : result.reason === 'force-push'
            ? t('workbench.commitTool.errors.historyRewritten')
            : (result.detail ?? result.reason);
      notification.error({ title: failed, description: why });
    } catch (err) {
      notification.error({ title: t('workbench.commitTool.errors.pushFailed'), description: failure(err) });
    } finally {
      setPushBusy(false);
    }
  };

  const dialogs = (
    <>
      <CreateBranchModal
        workspaceId={workspaceId}
        from={createFrom}
        fromRef={
          createFrom !== null && (isFullCommitSha(createFrom) || refs.some((ref) => ref.name === createFrom))
            ? createFrom
            : // The unborn current branch (or HEAD itself) resolves
              // nowhere yet — anchor the create at HEAD.
              undefined
        }
        container={container}
        onClose={() => setCreateFrom(null)}
        onCreated={(branch, from, checkedOut) => {
          if (checkedOut) {
            notification.info({
              title: t('workbench.gitLog.createBranch.checkedOut', { branch, from }),
              duration: 5,
            });
          }
        }}
      />
      <SwitchBranchModal
        prompt={switchPrompt}
        busy={switching}
        container={container}
        onChoose={(choice) => {
          if (switchPrompt !== null) void switchTo(switchPrompt.branch, choice);
        }}
        onClose={() => setSwitchPrompt(null)}
      />
      <PushCommitsModal workspaceId={workspaceId} open={pushOpen} onClose={() => setPushOpen(false)} onConfirm={pushNow} />
      <PushRejectedModal
        open={pushRejected}
        branch={currentRef ?? 'HEAD'}
        onCancel={() => setPushRejected(false)}
        onMerge={() => {
          setPushRejected(false);
          void pull().then((landed) => (landed ? pushNow() : undefined));
        }}
      />
      <RemotesModal workspaceId={workspaceId} open={remotesOpen} container={container} onClose={() => setRemotesOpen(false)} />
    </>
  );

  return {
    checkout: (branch) => void switchTo(branch),
    checkoutRemote: (ref) => void checkoutRemote(ref),
    newBranchFrom: (ref) => setCreateFrom(ref ?? currentRef ?? 'HEAD'),
    mergeIntoCurrent: (ref) => void mergeIntoCurrent(ref),
    updateBranch: (branch) => void updateBranch(branch),
    deleteBranch: (branch) => void deleteBranch(branch),
    fetch: () => void fetch(),
    pull: () => void pull(),
    push: () => setPushOpen(true),
    manageRemotes: () => setRemotesOpen(true),
    busy: {
      switching,
      merge: mergeBusy,
      update: updateBusy,
      fetch: fetchBusy,
      pull: pullBusy,
      push: pushBusy,
    },
    dialogs,
  };
}

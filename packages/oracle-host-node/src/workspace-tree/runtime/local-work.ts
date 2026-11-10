/**
 * Workspace-tree runtime — uncommitted work across a pass that lands
 * another commit's work on the branch (a pick, a revert, a pull, a
 * branch merge). The pass decides WHICH files hold work that has to be
 * committed first (`../pass-writes.ts`); this is the runtime's half:
 * whether that may happen without asking, the commit itself, and what
 * becomes of the pending draft.
 */

import { type CommitIntent, commitWorkspaceTree, composeCommitMessage, countDirtyFiles } from '../../git';
import type { LocalWorkDeps } from '../pass-writes';
import type { OpenBinding, RuntimeCtx } from './core';
import type { CommitLocalWork } from './types';

/**
 * The pass's way to commit local work first. It is asked of the person
 * unless commits are automatic on this binding — then the work would
 * have been committed without a word anyway. The commit is the
 * operator's gesture, like one from the Commit window: their identity,
 * their message (the pending draft when they were not asked), those
 * files alone.
 */
export function localWorkFirst(
  ctx: RuntimeCtx,
  binding: OpenBinding,
  identityEnv: Record<string, string>,
  word: CommitLocalWork | undefined,
): LocalWorkDeps {
  // Read now: once the pass applies its own batches the draft describes them too.
  const message = word?.message ?? composeCommitMessage(binding.intents);
  return {
    mayCommitLocalWork: word !== undefined || (binding.record.commitCadence ?? 'off') !== 'off',
    commitLocalWork: async ({ tree, paths }) => {
      const first = await commitWorkspaceTree({
        run: ctx.gitRun,
        rootDir: binding.record.rootDir,
        message,
        identityEnv,
        bypassHooks: binding.record.bypassHooks === true,
        fromTree: tree,
        paths,
      });
      return first.ok ? { ok: true } : { ok: false, detail: first.detail };
    },
  };
}

/** The pending draft as it stood before a pass applied batches of its own. */
export interface HeldDraft {
  intents: CommitIntent[];
  contributors: string[];
}

export function holdDraft(binding: OpenBinding): HeldDraft {
  return { intents: [...binding.intents], contributors: [...binding.contributors] };
}

/**
 * After a pass that recorded its own commit: the draft describes
 * uncommitted work, so it is spent when none is left. While some is,
 * the draft goes back to what was pending before the pass — the pass's
 * own batches are in its commit, not in the work still to commit.
 */
export async function settleDraft(ctx: RuntimeCtx, binding: OpenBinding, held: HeldDraft): Promise<void> {
  if ((await countDirtyFiles(ctx.gitRun, binding.record.rootDir)) === 0) {
    ctx.drainIntents(binding);
    return;
  }
  binding.intents = held.intents;
  binding.contributors = new Set(held.contributors);
}

/**
 * The reconnect-across-checkout notice's copy (the git-sync plan §3.5):
 * a backend answered a workspace's catch-up on a different checked-out
 * HEAD than its previous answer, so the edits the catch-up flushed
 * landed on the branch it is on NOW. One toast names the workspace and
 * where HEAD is — a branch by name, a detached commit by its short sha.
 * A stamp that reads as no HEAD at all has nothing to name and stays
 * silent.
 */

import { readHeadStamp } from '@openheaders/core/workspace-tree';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

const SHORT_SHA_LENGTH = 8;

/** The toast's text for a workspace now on `gitHead`, or null when the stamp names no HEAD. */
export function gitHeadNoticeText(t: Translate, workspaceName: string, gitHead: string): string | null {
  const reading = readHeadStamp(gitHead);
  if (reading.kind === 'none') return null;
  if (reading.kind === 'detached') {
    return t('workbench.shell.toast.gitHeadDetached', {
      workspace: workspaceName,
      sha: reading.sha.slice(0, SHORT_SHA_LENGTH),
    });
  }
  return t('workbench.shell.toast.gitHeadBranch', { workspace: workspaceName, branch: reading.name });
}

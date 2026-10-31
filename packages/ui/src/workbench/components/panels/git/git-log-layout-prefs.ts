/**
 * git-log-layout-prefs — the persisted sash positions of the Git tool
 * window (`git-log-layout.ts`), per workspace, on the shared prefs
 * posture. Written once per drag, on release.
 */

import { GIT_LOG_LAYOUT_DEFAULTS, type GitLogLayoutPrefs, normalizeGitLogLayoutPrefs } from './git-log-layout';
import { createWorkspacePrefsStore } from './workspace-prefs-store';

const store = createWorkspacePrefsStore<GitLogLayoutPrefs>({
  storagePrefix: 'oh:gitLogLayout',
  defaults: GIT_LOG_LAYOUT_DEFAULTS,
  parse: normalizeGitLogLayoutPrefs,
});

export const getGitLogLayoutPrefs = store.get;
export const subscribeGitLogLayoutPrefs = store.subscribe;
export const patchGitLogLayoutPrefs = store.patch;

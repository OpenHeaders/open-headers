/**
 * push-window-layout-prefs — the persisted sash positions of the Push
 * window (`push-window-layout.ts`), per workspace, on the shared prefs
 * posture. Written once per drag, on release.
 */

import { createWorkspacePrefsStore } from '../workspace-prefs-store';
import { normalizePushWindowLayoutPrefs, PUSH_LAYOUT_DEFAULTS, type PushWindowLayoutPrefs } from './push-window-layout';

const store = createWorkspacePrefsStore<PushWindowLayoutPrefs>({
  storagePrefix: 'oh:gitPushLayout',
  defaults: PUSH_LAYOUT_DEFAULTS,
  parse: normalizePushWindowLayoutPrefs,
});

export const getPushWindowLayoutPrefs = store.get;
export const subscribePushWindowLayoutPrefs = store.subscribe;
export const patchPushWindowLayoutPrefs = store.patch;

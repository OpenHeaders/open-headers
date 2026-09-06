/**
 * Factory for persisted split-orientation preferences — the mechanism
 * behind the request editor's request/response split, the rule editor's
 * actions/conditions split and the panel's message-stream grid/preview
 * split.
 *
 *   - `'horizontal'` — panes side-by-side.
 *   - `'vertical'`   — panes stacked.
 *
 * The naming follows the app's splitter vocabulary (a `horizontal`
 * orientation arranges panes along the horizontal axis; `vertical`
 * stacks them) so it lines up with the `split-right` / `split-down`
 * glyphs the toggle reuses.
 *
 * Each preference is global — one value shared by every mounted editor
 * of that kind, browser-local, failure-soft — the stored-preference
 * store's contract (`createStoredPreference`).
 */

import { createStoredPreference } from '@openheaders/ui/shared/hooks/useStoredPreference';

export type SplitLayout = 'horizontal' | 'vertical';

const LAYOUTS: readonly SplitLayout[] = ['horizontal', 'vertical'];

export function createSplitLayoutPreference(
  storageKey: string,
  defaultLayout: SplitLayout,
): () => [SplitLayout, (next: SplitLayout) => void] {
  return createStoredPreference(storageKey, LAYOUTS, defaultLayout);
}

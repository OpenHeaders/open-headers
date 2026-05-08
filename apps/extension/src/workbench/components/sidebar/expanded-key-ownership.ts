/**
 * Per-view ownership of `expandedKeys` entries.
 *
 * The Sidebar's collection/folder expansion is stored as a single
 * flat `Set<string>` lifted at the App level (see
 * `useWorkbenchSidebarState`). The keys are namespaced by prefix so
 * they don't collide, but `expandAll` / `collapseAll` previously
 * REPLACED the whole set — meaning a button click in one rendered
 * Sidebar wiped expansion state owned by every other rendered
 * Sidebar.
 *
 * To keep cross-panel state isolated without lifting `expandedKeys`
 * into a per-view shape (the keys are already namespaced; reshaping
 * the persistence layer would broaden the migration surface for no
 * runtime gain), this module classifies each key by its owning
 * view. `expandAll` / `collapseAll` use the helpers below to mutate
 * only the calling Sidebar's slice of the set, preserving every
 * other panel's expansion state.
 *
 * Adding a new collection-like structure? List its prefix here and
 * the rest of the helpers carry the rule automatically.
 */
import type { SidebarView } from './types';

/**
 * Each prefix maps to the view that renders the corresponding tree.
 * Order matters in `keyOwnedByView` (we test longer prefixes first
 * so `tpl-col-` and `tpl-folder-` aren't shadowed by `col-` /
 * `folder-`).
 */
const KEY_PREFIX_OWNERSHIP: ReadonlyArray<{ prefix: string; view: SidebarView }> = [
  { prefix: 'sys-tpl-', view: 'http-rules' },
  { prefix: 'tpl-col-', view: 'http-rules' },
  { prefix: 'tpl-folder-', view: 'http-rules' },
  { prefix: 'tpl-', view: 'http-rules' },
  { prefix: 'req-col-', view: 'api-requests' },
  { prefix: 'req-folder-', view: 'api-requests' },
  { prefix: 'col-', view: 'http-rules' },
  { prefix: 'folder-', view: 'http-rules' },
];

/** Returns the owning `SidebarView` for an expanded-key, or null if
 *  the key doesn't match any known prefix (treated as ownerless and
 *  preserved across expand/collapse to avoid accidental data loss). */
export function keyOwnerView(key: string): SidebarView | null {
  for (const { prefix, view } of KEY_PREFIX_OWNERSHIP) {
    if (key.startsWith(prefix)) return view;
  }
  return null;
}

/** True iff `key`'s prefix maps to `view`. */
export function keyOwnedByView(key: string, view: SidebarView): boolean {
  return keyOwnerView(key) === view;
}

/**
 * Compute the next `expandedKeys` set when one view runs `expandAll`
 * or `collapseAll`. Keys owned by the calling view are replaced with
 * the caller-supplied `nextOwned` set; keys owned by other views (or
 * keys with no recognized prefix) are preserved verbatim.
 *
 * - `expandAll`  → pass the union of every collection/folder key in
 *                  this view's trees as `nextOwned`.
 * - `collapseAll` → pass `new Set()` as `nextOwned`.
 */
export function replaceOwnedKeys(prev: ReadonlySet<string>, nextOwned: ReadonlySet<string>, view: SidebarView): Set<string> {
  const out = new Set<string>(nextOwned);
  for (const k of prev) {
    if (!keyOwnedByView(k, view)) out.add(k);
  }
  return out;
}

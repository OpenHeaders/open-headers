/**
 * useWorkbenchWorkspaceSlice — no-op.
 *
 * Workbench tabs are URL-pinned (see `useUrlWorkspaceBindingMirror` +
 * the resolver in `useToolLayout`). The tab's editing-scope workspace
 * lives in the URL hash and the slice mirrors it. Runtime-Active
 * changes (popup / sidepanel "Make ACTIVE" gestures) DO NOT auto-
 * rebind workbench tabs — by design, workbench is the flexible
 * surface where you can edit a workspace that isn't ACTIVE.
 *
 * The hook is kept (rather than deleted at the call site) so the lint
 * test's structural expectation — "single slice owner per surface" —
 * stays satisfied without churn. New auto-rebind behaviors land here
 * if we ever need them.
 */

import type { EditingScopeViewStateApi } from '@/shared/editing-scope-view-state';
import type { WorkbenchViewState } from './useToolLayout';

export function useWorkbenchWorkspaceSlice(_perTab: EditingScopeViewStateApi<WorkbenchViewState>): void {
  // Intentional no-op. URL is the source of truth.
}

/**
 * focus-region-store — workspace.html focus store instance.
 *
 * Thin wrapper around the shared createFocusStore() factory.
 * Re-exports all methods so existing imports keep working.
 */

import { createFocusStore } from '@/shared/dock-layout';

const store = createFocusStore();

export const getFocusedRegion = store.getFocusedRegion;
export const getFocusedDock = store.getFocusedDock;
export const setFocusedRegion = store.setFocusedRegion;
export const setFocusedDock = store.setFocusedDock;
export const useFocusedRegion = store.useFocusedRegion;
export const useIsDockFocused = store.useIsDockFocused;

export { store as focusStore };

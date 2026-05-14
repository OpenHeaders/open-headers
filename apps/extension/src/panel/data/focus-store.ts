/**
 * focus-store — DevTools Inspector panel focus store instance.
 *
 * Thin wrapper around the shared createFocusStore() factory.
 */

import type { FocusRegion } from '@openheaders/ui/shared/dock-layout';
import { createFocusStore } from '@openheaders/ui/shared/dock-layout';

const store = createFocusStore();

export type PanelRegion = FocusRegion;

export const getFocusedRegion = store.getFocusedRegion;
export const getFocusedDock = store.getFocusedDock;
export const setFocusedRegion = store.setFocusedRegion;
export const setFocusedDock = store.setFocusedDock;
export const useFocusedRegion = store.useFocusedRegion;
export const useFocusedDock = store.useFocusedDock;
export const useIsDockFocused = store.useIsDockFocused;

export { store as focusStore };

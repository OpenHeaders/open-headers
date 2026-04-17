/**
 * UI surface abstraction. Tells shared components which host they're
 * rendering inside (action popup, side panel) so they can adapt
 * lifecycle and chrome — width is handled by container queries, not
 * this enum.
 */
export type SurfaceMode = 'popup' | 'sidepanel';

/**
 * Aggregated surface info threaded through React via context. `presenceName`
 * matches the port name the background's tab-listeners switch on (`'popup'`
 * vs `'sidepanel'`) so badge refresh can react to either context closing.
 */
export interface SurfaceInfo {
  mode: SurfaceMode;
  presenceName: string;
  /** True for hosts whose blur dismisses them (popup); false for persistent panels. */
  dismissesOnBlur: boolean;
}

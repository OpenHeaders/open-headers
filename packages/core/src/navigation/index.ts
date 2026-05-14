/**
 * Host-navigation seam (`@openheaders/core/navigation`).
 *
 * A single platform seam for surface-level navigation: switching the
 * extension UI between popup and side-panel mode, and resolving the
 * caller's browser window. Defaults to graceful no-ops so an unwired
 * host stays functional — see {@link HostNavigation} for the contract.
 */

export {
  getHostNavigation,
  type HostNavigation,
  hostNavigation,
  setHostNavigation,
} from './host-navigation';

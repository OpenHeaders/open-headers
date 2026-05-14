/**
 * Host-assets seam (`@openheaders/core/assets`).
 *
 * A single platform seam for resolving host-packaged static asset paths
 * to loadable URLs. Defaults to an identity resolver so an unwired host
 * stays functional — see {@link HostAssets} for the contract.
 */

export { getHostAssets, type HostAssets, hostAssets, setHostAssets } from './host-assets';

/**
 * Guarded loader for `@openheaders/windows-package-update` — the addon a
 * Windows package asks Windows for its own update through, hearing the
 * percentage Windows reports on the way.
 *
 * pnpm materializes the addon only on Windows, so a static import would
 * fail module resolution on every other platform. This module owns the
 * guarded require.
 */

import { createRequire } from 'node:module';
import type { PackageUpdateAddon } from './msix-updater-port';

type AddonModule = { load(): PackageUpdateAddon | null };

/** The addon's binding; null where it is not built or will not load. */
export function loadPackageUpdateAddon(): PackageUpdateAddon | null {
  try {
    return (createRequire(__filename)('@openheaders/windows-package-update') as AddonModule).load();
  } catch {
    return null;
  }
}

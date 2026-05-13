/**
 * @openheaders/core — the canonical domain model for the OpenHeaders platform.
 *
 * **Use subpath imports.** The root barrel only re-exports a small set
 * of helpers that historically lived here; the heavy types live under
 * `/types` and are flat (no `V5` namespace):
 *
 *   import type { Rule, Workspace } from '@openheaders/core/types'
 *   import { validateHeaderName } from '@openheaders/core/utils'
 *   import { WS_PORT, PROTOCOL_VERSION } from '@openheaders/core/protocol'
 *   import { VaultSchema } from '@openheaders/core/schemas'
 *
 * Why no `export * from './types/index'` at the root: types/* and
 * vault/* (and utils/*) historically each defined their own `Vault` and
 * `QueryParam`. The old `V5` namespace hid the collision; now that the
 * namespace is gone, the only safe-and-tree-shakeable choice is to keep
 * those names addressable via their own subpath.
 */

export * from './protocol/index';
export * from './schemas/index';
export * from './utils/index';
export * from './vault/index';
export * from './workspace-export/index';
export * from './workspace-intent/index';

/**
 * @openheaders/core — the canonical domain model for the OpenHeaders platform.
 *
 * Prefer subpath imports for tree-shaking:
 *   import type { V5 } from '@openheaders/core/types'
 *   import { validateHeaderName } from '@openheaders/core/utils'
 *   import { WS_PORT } from '@openheaders/core/protocol'
 */

export * from './protocol/index';
export * from './schemas/index';
// Re-export everything for convenience (full barrel)
export * from './types/index';
export * from './utils/index';
export * from './vault/index';
export * from './workspace-export/index';
export * from './workspace-intent/index';

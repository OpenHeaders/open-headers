/**
 * Lock adapter — bridges the SW's `withLock` + `entityLockName`
 * primitives to the {@link LockAcquirer} shape the {@link EntityOracle}
 * expects (Phase A foundation).
 *
 * The oracle's contract is platform-agnostic: it asks for a function
 * that runs `fn` while the per-(workspaceId, type, entityId) lock is
 * held. In the extension that's the existing
 * `withLock(entityLockName(...), fn)` pair, which already records
 * observability entries and enforces a finite timeout. This module is
 * the only place where the two are stitched together — keeping the
 * adapter narrow lets desktop/CLI ship their own LockAcquirers later
 * without bringing in the extension's observability dependencies.
 */

import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import type { LockAcquirer } from './oracle';

/** The stitched `LockAcquirer` the production oracle uses. */
export const ruleOracleLockAcquirer: LockAcquirer = (workspaceId, type, entityId, fn) =>
  withLock(entityLockName(workspaceId, type, entityId), fn, { op: `sync-${type}` });

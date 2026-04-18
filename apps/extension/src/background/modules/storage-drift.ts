/**
 * Shared helper for recording schema-drift events emitted by
 * `extensionStorage.getValidatedArray` on hydrate paths.
 *
 * Each store that hydrates persisted V5 entities on SW wake passes a
 * `logDrift(...)` callback to the validator. When a stored entry fails
 * the schema (older/newer shape, manual DevTools edit, sync conflict),
 * the validator drops it and calls back here; this module stamps the
 * observability log with a `hydrate-drift` event so the failure is
 * triage-visible — instead of silently vanishing into an Array.isArray
 * branch.
 *
 * The dropped entry's raw value is NOT persisted in the log — it may
 * contain secrets. We stamp the storage key + issue count + first
 * issue path so a post-incident review can narrow the offender.
 */

import type * as v from 'valibot';
import type { LogSubsystem } from '@/shared/observability/types';
import { recordLog } from './observability-log';

export interface StorageDriftOptions {
  subsystem: LogSubsystem;
  /** Fully-qualified storage key (e.g. `oh.ws.<id>.rules`). */
  storageKey: string;
  /** Workspace id when the key is workspace-scoped. Optional for global keys. */
  workspaceId?: string;
}

/**
 * Factory — returns an `onError` callback matching
 * `ParseEntityOptions.onError`. Suitable for passing straight to
 * `extensionStorage.getValidatedArray(spec, schema, { onError })`.
 */
export function driftRecorder(
  options: StorageDriftOptions,
): (raw: unknown, issues: readonly v.BaseIssue<unknown>[]) => void {
  return (_raw, issues) => {
    const firstIssue = issues[0];
    const path = firstIssue?.path?.map((segment) => String(segment.key)).join('.') ?? '';
    const message = `Dropped entry at ${options.storageKey}${path ? ` (${path})` : ''}: ${firstIssue?.message ?? 'unknown issue'}`;
    recordLog({
      subsystem: options.subsystem,
      op: 'hydrate-drift',
      level: 'warn',
      message,
      context: {
        workspaceId: options.workspaceId,
      },
    });
  };
}

/**
 * Shared helper for recording schema-drift events emitted by
 * `extensionStorage.getValidatedArray` on hydrate paths.
 *
 * Each store that hydrates persisted entities on SW wake passes a
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
import type { LogSubsystem } from '@openheaders/core/types';
import { getOracleHostHooks } from './host-hooks';

export interface StorageDriftOptions {
  subsystem: LogSubsystem;
  /**
   * Optional host-side status subsystem tag to yellow-pill when drift
   * is detected. When set, a single `Schema drift` entry is reported
   * via the host's `reportStatus` hook per recorder invocation (the
   * store dedupe prevents churn on repeats). Leave unset for subsystems
   * where drift is triage-only.
   */
  statusSubsystem?: string;
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
    const hooks = getOracleHostHooks();
    hooks.recordLog?.({
      subsystem: options.subsystem,
      op: 'hydrate-drift',
      level: 'warn',
      message,
      context: {
        workspaceId: options.workspaceId,
      },
    });
    if (options.statusSubsystem) {
      hooks.reportStatus?.({
        subsystem: options.statusSubsystem,
        state: 'yellow',
        message: `Schema drift: dropped entry from ${options.storageKey}`,
        context: {
          storageKey: options.storageKey,
          issue: firstIssue?.message,
          path: path || undefined,
        },
      });
    }
  };
}

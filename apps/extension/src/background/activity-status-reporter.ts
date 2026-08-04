/**
 * Activity Feed → Status subsystem bridge (Phase C F3).
 *
 * Maps the activity installer's classified-entry stream to the
 * `activity` Status subsystem the UI subscribes to. Same shape as the
 * shared sync-status reporter
 * (`@openheaders/oracle/sync/client/sync-status-reporter`): a pure mapper plus a small wiring
 * function that handles install lifecycle (subscribe to entries,
 * subscribe to workspace switches, report the initial baseline).
 *
 *   - {@link describeActivityStatus} — pure mapping; one
 *     `{ unreadCount, lastEntry }` snapshot in, one StatusEntry-
 *     shaped row out. Always non-null: an empty feed reports green
 *     "Activity up to date" so the pill never sits grey once the
 *     reporter is installed.
 *   - {@link installActivityStatusReporter} — installs the bridge,
 *     re-baselining the per-workspace unread counter on every active-
 *     workspace switch (so opening a different workspace doesn't carry
 *     the previous workspace's badge count).
 *
 * Why per-workspace re-baseline: the activity log is workspace-
 * scoped (the storage layer keyed `(workspaceId, ...)`), and the
 * reporter owns the "what to show in the Status row" question. Two
 * workspaces with their own inbound traffic must not share a counter;
 * switching workspaces flushes the local count and re-reads
 * `countUnread(activeWorkspaceId)` from the installed log. Inbound
 * entries that target a non-active workspace bump the unread count
 * silently (the log still records them); the pill only reflects the
 * active workspace.
 */

import type { ActivityEntry } from '@openheaders/core/sync';

export interface ActivityStatusEntry {
  readonly state: 'green' | 'yellow' | 'red';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface ActivityStatusInput {
  readonly unreadCount: number;
  readonly lastEntry: ActivityEntry | null;
  readonly activeWorkspaceId: string | null;
}

/**
 * Pure mapping: turn the current unread count + most-recent entry
 * into the Status row the pill renders. Always returns an entry —
 * the activity subsystem has no "don't override" state (no other
 * reporter writes the `activity` slot).
 */
export function describeActivityStatus(input: ActivityStatusInput): ActivityStatusEntry {
  const { unreadCount, lastEntry, activeWorkspaceId } = input;
  if (unreadCount <= 0) {
    return {
      state: 'green',
      message: 'Activity up to date',
      context: { unread: 0, workspaceId: activeWorkspaceId },
    };
  }
  const headline = describeLastEntry(lastEntry);
  const message = headline ? `${unreadCount} new · ${headline}` : `${unreadCount} new activity entries`;
  return {
    state: 'yellow',
    message,
    context: {
      unread: unreadCount,
      workspaceId: activeWorkspaceId,
      lastKind: lastEntry?.kind ?? null,
      lastEntityType: lastEntry?.entityType ?? null,
    },
  };
}

function describeLastEntry(entry: ActivityEntry | null): string | null {
  if (!entry) return null;
  switch (entry.kind) {
    case 'create-entity':
      return `new ${entry.entityType}`;
    case 'delete-entity':
      return `${entry.entityType} deleted`;
    case 'edit-entity':
      return `${entry.entityType} edited`;
    case 'supersede-local-edit':
      return `${entry.entityType} overrode local edit`;
    case 'sensitive-field-rotation':
      return `${entry.entityType} sensitive field changed`;
    case 'permission-scope-expansion':
      return `${entry.entityType} scope widened`;
    case 'agent-observe':
      return 'AI agent observed traffic';
  }
}

export interface InstallActivityStatusReporterDeps {
  /** Status-subsystem write hook for the `activity` slot. */
  readonly report: (entry: ActivityStatusEntry) => void;
  /** Subscribe to every classified entry — installer-side wiring. */
  readonly subscribeActivityEntries: (listener: (entry: ActivityEntry) => void) => () => void;
  /**
   * Snapshot the unread count for a workspace. Resolves to 0 when no
   * log is installed yet (boot race). The reporter calls this on
   * install + on every workspace switch.
   */
  readonly countUnread: (workspaceId: string) => Promise<number>;
  /** Active workspace getter — drives "which counter is the badge?". */
  readonly getActiveWorkspaceId: () => string | null;
  /** Subscribe to active-workspace flips. The callback runs after the flip. */
  readonly subscribeActiveWorkspace: (listener: () => void) => () => void;
}

export interface ActivityStatusReporterHandle {
  /** Tear down every subscription. Idempotent. */
  dispose(): void;
}

/**
 * Wire the reporter. Reports an initial baseline synchronously
 * (unread = 0 until the async `countUnread` resolves) so the pill
 * starts in a known state instead of grey. The first `countUnread`
 * read replaces the baseline once it lands.
 */
export function installActivityStatusReporter(deps: InstallActivityStatusReporterDeps): ActivityStatusReporterHandle {
  let activeWorkspaceId = deps.getActiveWorkspaceId();
  let unread = 0;
  let lastEntry: ActivityEntry | null = null;
  let disposed = false;
  let baselineToken = 0;

  const emit = (): void => {
    if (disposed) return;
    deps.report(
      describeActivityStatus({
        unreadCount: unread,
        lastEntry,
        activeWorkspaceId,
      }),
    );
  };

  const rebaseline = (): void => {
    const wsId = activeWorkspaceId;
    const token = ++baselineToken;
    if (!wsId) {
      unread = 0;
      lastEntry = null;
      emit();
      return;
    }
    void deps
      .countUnread(wsId)
      .then((count) => {
        if (disposed || token !== baselineToken) return;
        unread = count;
        lastEntry = null;
        emit();
      })
      .catch(() => {
        // Swallow — the next entry or workspace switch will re-baseline.
      });
  };

  // Emit the green-zero baseline immediately so the pill never sits
  // grey for the unread-resolve window.
  emit();
  rebaseline();

  const unsubscribeEntries = deps.subscribeActivityEntries((entry) => {
    if (disposed) return;
    // Entries for a non-active workspace still land in the per-
    // workspace log, but they don't move the active pill. Switching
    // to that workspace will re-baseline from the log and pick them
    // up.
    if (entry.workspaceId !== activeWorkspaceId) return;
    unread += 1;
    lastEntry = entry;
    emit();
  });

  const unsubscribeActive = deps.subscribeActiveWorkspace(() => {
    if (disposed) return;
    const next = deps.getActiveWorkspaceId();
    if (next === activeWorkspaceId) return;
    activeWorkspaceId = next;
    rebaseline();
  });

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribeEntries();
      unsubscribeActive();
    },
  };
}

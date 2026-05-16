import type { WorkspaceContentSnapshot } from '@openheaders/core/sync';

/**
 * Entity types that count toward "has user content" for the mode-switch
 * gate. Singletons (`workspace-variables`, `vault`, `layout-state`,
 * `pause-markers`, `files`) are excluded because they always materialize
 * even in a fresh workspace and would falsely flag every empty host as
 * populated. The M2 dialog renders per-type counts straight off the
 * collected snapshot, so adding a new user-facing entity type means
 * appending it here (and to the matching dialog copy).
 */
export const USER_CONTENT_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'rule',
  'environment',
  'template',
  'collection',
  'folder',
  'request',
  'request-collection',
  'request-folder',
  'template-collection',
  'template-folder',
  'live-variable',
  'live-workflow',
  'oauth-bundle',
]);

/** Minimal oracle surface the collector needs — keeps the unit test free of the full EntityOracle. */
export interface DataPresenceOracle {
  materializeAll(): ReadonlyArray<{ type: string }>;
}

export interface CollectLocalDataPresenceInput {
  /** Resident workspaces on this host. Order is preserved into the snapshot list. */
  readonly workspaces: ReadonlyArray<{ id: string; name: string }>;
  /** Per-workspace oracle accessor. `null` for a workspace whose service isn't hydrated yet ⇒ zero counts. */
  readonly getOracle: (workspaceId: string) => DataPresenceOracle | null;
}

/**
 * Walk every resident workspace on the local host and tally per-type
 * counts for the user-content entity types. Pure — the host plumbs the
 * accessors so the same helper runs on the extension SW and the desktop
 * main without either branch carrying chrome.* / electron coupling.
 */
export function collectLocalDataPresence(
  input: CollectLocalDataPresenceInput,
): WorkspaceContentSnapshot[] {
  return input.workspaces.map((ws): WorkspaceContentSnapshot => {
    const oracle = input.getOracle(ws.id);
    const entityCounts: Record<string, number> = {};
    if (oracle) {
      for (const ent of oracle.materializeAll()) {
        if (!USER_CONTENT_ENTITY_TYPES.has(ent.type)) continue;
        entityCounts[ent.type] = (entityCounts[ent.type] ?? 0) + 1;
      }
    }
    return {
      workspaceId: ws.id,
      workspaceName: ws.name,
      entityCounts,
    };
  });
}

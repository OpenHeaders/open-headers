/**
 * Mode-switch Coexist (M3) — source-side collector.
 *
 * Walks every resident workspace on the local host, materializes the
 * full post-state of any workspace that carries user content (per the
 * {@link USER_CONTENT_ENTITY_TYPES} allowlist that gates the M1 dialog),
 * and packs the result into a {@link CoexistPayload} ready to ship over
 * the wire. Singleton-only workspaces (a fresh empty workspace
 * materializes `workspace-variables`, `vault`, `layout-state`, etc.) are
 * SKIPPED — exporting them would mint phantom imports on the target.
 *
 * Host plumbing is dependency-injected so the same helper runs in the
 * extension SW and the desktop main without either branch carrying
 * chrome.* / electron coupling, and so unit tests don't need to spin up
 * the per-workspace service registry.
 */

import type { CoexistPayload, CoexistSourceWorkspace } from '@openheaders/core/sync';
import { USER_CONTENT_ENTITY_TYPES, type DataPresenceOracle } from './data-presence-collector';

/** Minimum surface the collector reads off a workspace's oracle. */
export type CoexistSourceOracle = DataPresenceOracle;

export interface CollectCoexistPayloadInput {
  /** Resident workspaces on this host. Order is preserved into the payload. */
  readonly workspaces: ReadonlyArray<{ id: string; name: string }>;
  /** Per-workspace oracle accessor for content-detection. `null` ⇒ workspace skipped. */
  readonly getOracle: (workspaceId: string) => CoexistSourceOracle | null;
  /**
   * Produces a full {@link WorkspaceSnapshot} for a workspace deemed
   * worth shipping. Async because the production builder may need to
   * await per-workspace service hydration. Rejections bubble — the
   * caller treats them as fatal so we never partially-export a host.
   */
  readonly buildSnapshot: (workspaceId: string) => Promise<CoexistSourceWorkspace['snapshot']>;
}

/**
 * Decide whether a workspace carries any user-content entity. Returns
 * `true` on the first allowlisted hit so the scan is short-circuit fast
 * — empty workspaces materialize the singleton set, so the negative
 * case still iterates a handful of entries.
 */
function hasUserContent(oracle: CoexistSourceOracle): boolean {
  for (const ent of oracle.materializeAll()) {
    if (USER_CONTENT_ENTITY_TYPES.has(ent.type)) return true;
  }
  return false;
}

/**
 * Build a {@link CoexistPayload} for every workspace on this host that
 * carries user content. Workspaces whose oracle isn't hydrated, or
 * whose only live entities are singletons, are silently dropped.
 */
export async function collectCoexistPayload(
  input: CollectCoexistPayloadInput,
): Promise<CoexistPayload> {
  const workspaces: CoexistSourceWorkspace[] = [];
  for (const ws of input.workspaces) {
    const oracle = input.getOracle(ws.id);
    if (!oracle) continue;
    if (!hasUserContent(oracle)) continue;
    const snapshot = await input.buildSnapshot(ws.id);
    workspaces.push({
      sourceWorkspaceId: ws.id,
      sourceWorkspaceName: ws.name,
      snapshot,
    });
  }
  return { workspaces };
}

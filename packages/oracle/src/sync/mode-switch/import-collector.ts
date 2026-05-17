/**
 * Mode-switch Import (M4) — source-side collector.
 *
 * Walks every resident workspace on the local host, materializes the
 * full post-state of any workspace that carries user content (per the
 * {@link USER_CONTENT_ENTITY_TYPES} allowlist that gates the M1 dialog),
 * and packs the result into an {@link ImportPayload} ready to ship over
 * the wire. Singleton-only workspaces are SKIPPED — exporting them would
 * queue phantom no-op merges on the target.
 *
 * Structurally identical to {@link collectCoexistPayload}; kept as its
 * own helper so the {@link ImportPayload} / {@link CoexistPayload} types
 * stay independently versionable (a future field added to one shouldn't
 * implicitly land on the other).
 *
 * Host plumbing is dependency-injected so the same helper runs in the
 * extension SW and the desktop main without either branch carrying
 * chrome.* / electron coupling.
 */

import type { ImportPayload, ImportSourceWorkspace } from '@openheaders/core/sync';
import { USER_CONTENT_ENTITY_TYPES, type DataPresenceOracle } from './data-presence-collector';

/** Minimum surface the collector reads off a workspace's oracle. */
export type ImportSourceOracle = DataPresenceOracle;

export interface CollectImportPayloadInput {
  /** Resident workspaces on this host. Order is preserved into the payload. */
  readonly workspaces: ReadonlyArray<{ id: string; name: string }>;
  /** Per-workspace oracle accessor for content-detection. `null` ⇒ workspace skipped. */
  readonly getOracle: (workspaceId: string) => ImportSourceOracle | null;
  /**
   * Produces a full {@link WorkspaceSnapshot} for a workspace deemed
   * worth shipping. Rejections bubble — the caller treats them as fatal
   * so we never partially-export a host.
   */
  readonly buildSnapshot: (workspaceId: string) => Promise<ImportSourceWorkspace['snapshot']>;
}

function hasUserContent(oracle: ImportSourceOracle): boolean {
  for (const ent of oracle.materializeAll()) {
    if (USER_CONTENT_ENTITY_TYPES.has(ent.type)) return true;
  }
  return false;
}

export async function collectImportPayload(
  input: CollectImportPayloadInput,
): Promise<ImportPayload> {
  const workspaces: ImportSourceWorkspace[] = [];
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

/**
 * Mode-switch Discard (M5) — source-side collector.
 *
 * Walks every resident workspace on the local host and packs the full
 * post-state of EACH workspace into a {@link DiscardBackupArchive} —
 * including singleton-only workspaces, unlike M3 Coexist / M4 Import
 * which skip them. Rationale: Discard wipes the host outright, so the
 * archive must capture every workspace shell the user had so M6 restore
 * can reconstitute the host's pre-discard layout.
 *
 * The M1 dialog gate ensures Discard only ever surfaces when at least
 * one workspace carries user content; once the user opts in, the
 * collector still backs up the singleton-only workspaces around the
 * user-content ones so the post-restore layout matches the pre-discard
 * one exactly.
 *
 * Host plumbing is dependency-injected. Tests inject deterministic
 * snapshots; production wires {@link buildSnapshotForWorkspace}.
 */

import type {
  DiscardBackupArchive,
  DiscardBackupWorkspace,
} from '@openheaders/core/sync';
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';

export interface CollectDiscardArchiveInput {
  /** Resident workspaces on this host. Order is preserved into the archive. */
  readonly workspaces: ReadonlyArray<{ id: string; name: string }>;
  /**
   * Produces a full {@link WorkspaceSnapshot} for a workspace. Rejections
   * bubble — the orchestrator treats them as fatal (no partial archive
   * lands on disk) and reports `backup-failed` upstream.
   */
  readonly buildSnapshot: (workspaceId: string) => Promise<WorkspaceSnapshot>;
  /**
   * ISO-8601 timestamp the host minted at backup time. Injected so the
   * orchestrator can pin the same clock used in the writer-resolved
   * path / filename. Tests pass a fixed string.
   */
  readonly generatedAt: string;
}

export async function collectDiscardArchive(
  input: CollectDiscardArchiveInput,
): Promise<DiscardBackupArchive> {
  const workspaces: DiscardBackupWorkspace[] = [];
  for (const ws of input.workspaces) {
    const snapshot = await input.buildSnapshot(ws.id);
    workspaces.push({
      workspaceId: ws.id,
      workspaceName: ws.name,
      snapshot,
    });
  }
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    workspaces,
  };
}

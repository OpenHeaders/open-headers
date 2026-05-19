/**
 * Mode-switch Coexist (M3) — target-side applier.
 *
 * Given a {@link CoexistPayload} shipped from the source host, mint a
 * fresh UUIDv7 workspace per entry under the source's own name, and
 * replay the source's snapshot into the new workspace. Existing target
 * workspaces are NEVER touched.
 *
 * **Naming.** Coexist keeps both copies as separate workspaces, so the
 * imported workspace takes the source name verbatim — an imported
 * workspace is not "lesser", and a decorative suffix on every import is
 * noise the user did not ask for. A numeric suffix (`"<name> (2)"`,
 * `"<name> (3)"`, …) is added ONLY to break a genuine name collision —
 * with a workspace already resident on the target host, or with another
 * workspace imported earlier in the same payload.
 *
 * The seed path reuses the same {@link applyWorkspaceSnapshot} that
 * Phase C's cold-receiver bootstrap uses (C5), so cache + log +
 * broadcast invariants are identical between "received from peer over
 * the handshake stream" and "imported via mode-switch Coexist".
 *
 * Per-workspace error isolation is INTENTIONALLY ABSENT in this slice.
 * If any workspace's apply rejects we surface
 * `{ ok: false, reason: 'apply-failed' }` immediately — partial imports
 * would leave the user with a half-populated target whose state can't
 * be rolled back cleanly (the seed batches have already committed
 * mutations + broadcast). The dialog's recommended fallback is
 * Discard-with-backup; collecting more telemetry on partial failures
 * lands once M5 backups are in place.
 */

import type {
  CoexistImportedWorkspace,
  CoexistPayload,
  CoexistResult,
  CoexistSourceWorkspace,
} from '@openheaders/core/sync';
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';

/** Minimum surface the applier needs to mint a fresh workspace on the target host. */
export interface CoexistTargetMinter {
  /**
   * Mint a new workspace with the given name. The implementation MUST
   * generate a fresh UUIDv7 id; the returned tuple is what the applier
   * stamps into the rewritten snapshot.
   */
  createWorkspace: (input: { name: string }) => Promise<{ id: string; name: string }>;
}

export interface ApplyCoexistPayloadDeps extends CoexistTargetMinter {
  /**
   * Replay a snapshot into the workspace named by `snapshot.workspaceId`.
   * Production wires {@link applyWorkspaceSnapshot}; tests inject a
   * deterministic stub. Throws → applier aborts with `apply-failed`.
   */
  applySnapshot: (snapshot: WorkspaceSnapshot) => Promise<{ entitiesApplied: number }>;
  /**
   * Names of the workspaces already resident on the target host. Used
   * to detect a genuine name collision so the imported workspace can be
   * disambiguated; absent / empty means "no collisions possible".
   */
  existingWorkspaceNames?: () => ReadonlyArray<string>;
}

/**
 * Resolve a non-colliding name for an imported workspace. Returns the
 * trimmed source name when it is free; otherwise appends the lowest
 * `" (n)"` (n ≥ 2) that is not already taken.
 */
function disambiguateName(sourceName: string, taken: ReadonlySet<string>): string {
  // Defensive trim — the source store already normalizes whitespace on
  // create, but a hand-imported workspace could carry trailing spaces.
  const base = sourceName.trim();
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Rewrite a snapshot's `workspaceId` to point at the freshly-minted
 * target workspace. The per-entity post-state arrays don't carry their
 * own `workspaceId` — they key off the snapshot's top-level id which
 * the apply path threads through {@link applySyncRequest}'s ctx (see
 * `snapshot-applier.ts`). A shallow rewrite is sufficient.
 */
function retargetSnapshot(snapshot: WorkspaceSnapshot, newWorkspaceId: string): WorkspaceSnapshot {
  return { ...snapshot, workspaceId: newWorkspaceId };
}

export async function applyCoexistPayload(
  payload: CoexistPayload,
  deps: ApplyCoexistPayloadDeps,
): Promise<CoexistResult> {
  if (payload.workspaces.length === 0) {
    return { ok: false, reason: 'no-source-data' };
  }

  const imported: CoexistImportedWorkspace[] = [];
  let totalEntitiesApplied = 0;

  // Names already in play on the target — resident workspaces plus the
  // ones minted earlier in this same payload. Trimmed to match
  // `disambiguateName`'s comparison basis.
  const taken = new Set<string>((deps.existingWorkspaceNames?.() ?? []).map((n) => n.trim()));

  for (const src of payload.workspaces) {
    const newName = disambiguateName(src.sourceWorkspaceName, taken);
    taken.add(newName);
    try {
      const result = await importOne(src, newName, deps);
      imported.push(result);
      totalEntitiesApplied += result.entitiesApplied;
    } catch (err) {
      return {
        ok: false,
        reason: 'apply-failed',
        detail: errorDetail(err, src.sourceWorkspaceName),
      };
    }
  }

  return { ok: true, imported, totalEntitiesApplied };
}

async function importOne(
  src: CoexistSourceWorkspace,
  newName: string,
  deps: ApplyCoexistPayloadDeps,
): Promise<CoexistImportedWorkspace> {
  const created = await deps.createWorkspace({ name: newName });
  const rewritten = retargetSnapshot(src.snapshot, created.id);
  const { entitiesApplied } = await deps.applySnapshot(rewritten);
  return {
    sourceWorkspaceId: src.sourceWorkspaceId,
    sourceWorkspaceName: src.sourceWorkspaceName,
    newWorkspaceId: created.id,
    newWorkspaceName: created.name,
    entitiesApplied,
  };
}

function errorDetail(err: unknown, sourceName: string): string {
  const base = err instanceof Error ? err.message : String(err);
  return `${sourceName}: ${base}`;
}

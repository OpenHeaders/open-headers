/**
 * Mode-switch Combine (U5.3) — wire + result shapes.
 *
 * Combine is the trust-by-process arm of the Phase U5 mode-switch
 * model (UNIFIED_ORACLE_MODEL.md §6 / `UNIFIED_ORACLE_STATUS.md`
 * Phase U5). After a join (U5.2) folds the target backend's `Org`
 * into this host's authorized set, Combine re-homes this host's own
 * workspaces by flipping each `Workspace.orgId` to the target `Org` —
 * so the joiner's workspaces sync UP and converge with the target's,
 * both directions live.
 *
 * Nothing crosses the wire directly from here: Combine is a sequence
 * of local `orgId` metadata mutations (§6.5). Once each workspace
 * carries the target `Org`, the existing
 * sender-side + receiver-side org filters carry it to the peer with
 * no further plumbing.
 *
 * **Posture.** Combine is offered ONLY on trust-by-process (loopback)
 * backends — re-homing pushes the joiner's data up, which an
 * authenticated LAN/WAN backend must never accept as a join-time side
 * effect (that path is the explicit per-workspace "Publish", U5.6).
 * The posture gate lives in the mode-switch dialog (U5.5); this
 * contract is pure mechanism.
 */

/** One workspace re-homed by a Combine run. */
export interface CombinedWorkspace {
  readonly workspaceId: string;
  readonly workspaceName: string;
  /** The `orgId` the workspace carried before the flip — informational for telemetry / the toast. */
  readonly fromOrgId: string;
}

/**
 * Reasons Combine can refuse.
 *
 * - `no-target-org` — the caller supplied an empty target `orgId`.
 *   Defensive; the dialog only enables Combine once a backend is
 *   joined.
 * - `target-not-authorized` — the target `Org` isn't in this host's
 *   authorized set. A join (U5.2) must land the target `Org` before
 *   Combine can re-home into it; a stale or forged renderer frame
 *   asking to re-home into an unknown Org is refused before any flip.
 * - `no-source-data` — no workspaces resident on this host.
 * - `rehome-failed` — a workspace's `orgId` flip rejected mid-run.
 *   {@link CombineResult.combinedWorkspaces} carries the workspaces
 *   that DID flip before the failure so the user sees the partial
 *   progress and can retry; the remaining workspaces keep their old
 *   binding.
 */
export type CombineFailureReason = 'no-target-org' | 'target-not-authorized' | 'no-source-data' | 'rehome-failed';

export type CombineResult =
  | {
      ok: true;
      /** The `Org` every listed workspace was re-homed into. */
      targetOrgId: string;
      /** Workspaces flipped this run. Empty when every workspace was already on the target. */
      combinedWorkspaces: readonly CombinedWorkspace[];
    }
  | {
      ok: false;
      reason: CombineFailureReason;
      /** Optional human-readable trailer for telemetry; the renderer does not render it verbatim. */
      detail?: string;
      /** On `rehome-failed`, the workspaces that flipped before the failure — partial progress. */
      combinedWorkspaces?: readonly CombinedWorkspace[];
    };

/**
 * Mode-switch Publish (U5.6) — wire + result shapes.
 *
 * Publish is the deliberate, permission-gated per-workspace gesture that
 * re-homes ONE workspace's `orgId` into an authenticated backend's `Org`
 * (UNIFIED_ORACLE_MODEL.md §6.5). It is the ONLY path by which a
 * workspace's data travels UP to a LAN / WAN backend: a join never
 * pushes the joiner's data up (structural — the receiver-side org
 * filter), and Combine (U5.3) is offered solely on trust-by-process
 * backends. Publish is the explicit opt-in for the authenticated case.
 *
 * Mechanically Publish is a single-workspace Combine: one `orgId` flip
 * (§6.5), no wire payload of substance — once the workspace carries the
 * target `Org`, the existing sender-side + receiver-side org filters
 * converge it with the target's data. The distinction from Combine is
 * the gate, not the mechanism: Publish is refused unless the caller
 * holds `workspace.write` on the workspace AND the target `Org` is in
 * the caller's authorized (joined) set.
 */

/** The workspace re-homed by a Publish run. */
export interface PublishedWorkspace {
  readonly workspaceId: string;
  readonly workspaceName: string;
  /**
   * The `orgId` the workspace carried before the flip. Equal to the
   * target `orgId` when the workspace was already published — the run
   * is a no-op and idempotent.
   */
  readonly fromOrgId: string;
}

/**
 * Reasons Publish can refuse.
 *
 * - `no-target-org` — the caller supplied an empty target `orgId`.
 * - `target-not-authorized` — the target `Org` isn't in the caller's
 *   authorized set, or the caller lacks `workspace.write` on the
 *   workspace. The resolver gate (`canPublishWorkspace`) collapses both
 *   permission failures into this one reason — a stale or forged
 *   renderer frame is refused before any flip.
 * - `workspace-not-found` — no workspace on this host carries the
 *   requested id.
 * - `rehome-failed` — the `orgId` flip rejected. The workspace keeps
 *   its old binding; {@link PublishResult.detail} carries the cause.
 */
export type PublishFailureReason = 'no-target-org' | 'target-not-authorized' | 'workspace-not-found' | 'rehome-failed';

export type PublishResult =
  | {
      ok: true;
      /** The `Org` the workspace now lives in. */
      targetOrgId: string;
      /** The workspace published this run; `fromOrgId === targetOrgId` ⇒ already published. */
      published: PublishedWorkspace;
    }
  | {
      ok: false;
      reason: PublishFailureReason;
      /** Optional human-readable trailer for telemetry; not rendered verbatim. */
      detail?: string;
    };

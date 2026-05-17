/**
 * Mode-switch name-collision detector (Phase C M7).
 *
 * When the gate routes to `show-dialog`, both sides already carry user
 * content. Coexist mints a fresh workspace per source entry, which
 * silently duplicates anything the user thinks of as "the same
 * workspace on the other host" — e.g. a user who created "Production"
 * on the extension and "Production" on the desktop offline winds up
 * with `Production` + `Production (imported)` post-Coexist. The dialog
 * needs to surface that risk BEFORE the user picks.
 *
 * This module is the pure detector. It pairs source and target
 * workspaces whose display names match after Unicode normalization
 * (NFC) + trim + locale-insensitive case-fold. Same-id matches are
 * skipped — Import already HLC-merges those without surprise.
 *
 * The "Rename + import" affordance (which retargets the source
 * snapshot at the matching target id rather than minting) is queued
 * for M4b; M7 surfaces the hint so Coexist's recommendation is
 * tempered when a collision is detected.
 */

import type { DataPresenceSummary, WorkspaceContentSnapshot } from './types';

/**
 * One source ↔ target pair whose workspace names collapse to the same
 * normalized form. `normalizedName` is informational; both original
 * casings are preserved so the dialog can quote them verbatim.
 */
export interface NameCollision {
  readonly sourceWorkspaceId: string;
  readonly sourceWorkspaceName: string;
  readonly targetWorkspaceId: string;
  readonly targetWorkspaceName: string;
  readonly normalizedName: string;
}

/**
 * Canonicalize a workspace name for collision comparison. NFC pulls
 * pre-composed vs. decomposed Unicode forms (é vs. e + ◌́) onto a
 * single representation; trim drops accidental leading/trailing
 * whitespace; locale-insensitive lowercase folds case so "Production"
 * and "production" collide. The result is intended for equality
 * comparison only — never use it as a user-facing label.
 */
export function normalizeWorkspaceNameForCollision(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase('en-US');
}

export interface FindNameCollisionsInput {
  readonly source: DataPresenceSummary;
  readonly target: DataPresenceSummary;
}

/**
 * Pair source workspaces with target workspaces whose normalized
 * display name matches. Pairing rules:
 *
 *   - Empty normalized names are dropped (a workspace named " "
 *     normalizes to "" — no useful comparison possible).
 *   - Same-id matches are skipped. Import handles those via HLC merge
 *     keyed on id; there's no collision to surface.
 *   - Each target workspace pairs with at most one source workspace —
 *     the first source entry in input order wins; later sources with
 *     the same normalized name fall through.
 *
 * Output order follows source iteration order so the dialog can render
 * collisions in the same order the user authored them.
 */
export function findNameCollisions(input: FindNameCollisionsInput): NameCollision[] {
  const targetByName = new Map<string, WorkspaceContentSnapshot>();
  for (const t of input.target.workspaces) {
    const key = normalizeWorkspaceNameForCollision(t.workspaceName);
    if (key.length === 0) continue;
    if (!targetByName.has(key)) targetByName.set(key, t);
  }
  if (targetByName.size === 0) return [];

  const out: NameCollision[] = [];
  const claimedTargets = new Set<string>();
  for (const s of input.source.workspaces) {
    const key = normalizeWorkspaceNameForCollision(s.workspaceName);
    if (key.length === 0) continue;
    const t = targetByName.get(key);
    if (!t) continue;
    if (s.workspaceId === t.workspaceId) continue;
    if (claimedTargets.has(t.workspaceId)) continue;
    claimedTargets.add(t.workspaceId);
    out.push({
      sourceWorkspaceId: s.workspaceId,
      sourceWorkspaceName: s.workspaceName,
      targetWorkspaceId: t.workspaceId,
      targetWorkspaceName: t.workspaceName,
      normalizedName: key,
    });
  }
  return out;
}

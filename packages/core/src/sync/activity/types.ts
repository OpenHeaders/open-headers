/**
 * Activity Feed entry — workspace-wide, persistent visibility for
 * inbound mutations. Pairs with the existing conflict chip on the
 * editor-open path; the feed covers the editor-closed (silent-LWW)
 * case so users are passively notified of changes that landed without
 * a foreground prompt.
 *
 * Design source: `docs/DATA_PLANE_TOPOLOGIES.md` §11.6.
 *
 * One entry is produced per (mutationId, kind) pair by the classifier
 * at the receiver. Most envelopes yield a single entry, but a single
 * envelope can fan out to multiple highlight kinds (e.g. a `setField`
 * on a sensitive path emits both `edit-entity` and the
 * `sensitive-field-rotation` highlight in later F2 expansions). That
 * is why `kind` is part of the entry id — `(mutationId, kind)` is the
 * uniqueness invariant the storage layer relies on.
 *
 * Wire-shape-stable: the entry will outlive its first storage backend
 * (IDB on the extension, SQLite on the desktop) and may eventually be
 * sent peer-to-peer for cross-host activity fan-out. Anything added
 * later must be additive.
 */
import type { HLC } from '../hlc';
import { hlcToString } from '../hlc';
import type { EntityType, MutationOrigin } from '../envelope';

/**
 * Classification produced by the receiver-side classifier (F2). The
 * first cut emits only the three structural kinds; the highlight
 * kinds (`supersede-local-edit`, `sensitive-field-rotation`,
 * `permission-scope-expansion`) land in later F2 expansions once the
 * classifier has access to per-entity priors.
 *
 * Open enum on the wire — UI surfaces unknown kinds as a generic
 * "Updated" entry rather than dropping them, so a newer publisher
 * doesn't cause silent gaps in the feed.
 */
export type ActivityEntryKind =
  | 'create-entity'
  | 'edit-entity'
  | 'delete-entity'
  | 'supersede-local-edit'
  | 'sensitive-field-rotation'
  | 'permission-scope-expansion';

export interface ActivityEntry {
  /** `${hlcKey}|${mutationId}|${kind}` — sortable by HLC, unique per row. */
  id: string;
  workspaceId: string;
  mutationId: string;
  hlc: HLC;
  kind: ActivityEntryKind;
  entityType: EntityType;
  entityId: string;
  origin: MutationOrigin;
  /**
   * Wall-clock millis when the receiver classified the entry. Used
   * for "14 min ago" copy and the 7-day auto-decay; HLC remains
   * authoritative for ordering.
   */
  observedAt: number;
  /** Flips on user view / dismiss; drives the badge count (F8). */
  read: boolean;
  /** Optional pre-rendered summary the classifier can attach. */
  summary?: string;
  /** Free-form bag the classifier uses for highlight context. */
  context?: Record<string, unknown>;
}

/** Compose the canonical entry id. Pure; safe to call anywhere. */
export function activityEntryId(input: {
  hlc: HLC;
  mutationId: string;
  kind: ActivityEntryKind;
}): string {
  return `${hlcToString(input.hlc)}|${input.mutationId}|${input.kind}`;
}

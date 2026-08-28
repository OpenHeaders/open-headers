/**
 * Pause-markers projection — `PauseMarkersRecord ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Mirrors `vault-projection.ts` for the singleton entity. The persisted
 * shape is the uid-keyed `markers` map beside the full `entries` (the
 * container ref + marker + write-time path hint). The oracle stores
 * entries as set members at `markers` (member identity = container
 * uid).
 *
 * `seedPauseMarkers` mints one `create` for the empty shell + one
 * `addToSet` per entry; `projectPauseMarkers` is the inverse. Both
 * accept the version-1 shapes still found at rest and on old peers —
 * a path-keyed record, or a post-state whose `markers` is path-keyed —
 * and the fold migrates path-keyed members on READ through the caller's
 * path → ref resolver. Nothing is rewritten in the store: an old client
 * keeps its own entry; when both shapes name one container the higher
 * add-HLC wins, which is the same LWW the set already applies within a
 * shape.
 */

import {
  compareHlc,
  type HLC,
  isLegacyPauseMarkerSlot,
  isPauseMarkerKind,
  isPauseMarkerSlot,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerEntry,
  type PauseMarkerKind,
  type PauseMarkerRef,
} from '@openheaders/core/sync';
import type { PauseMarkersRecord } from '@openheaders/core/utils';

export type PauseMarkersSnapshot = PauseMarkersRecord;

export const EMPTY_PAUSE_MARKERS: PauseMarkersSnapshot = { markers: {}, entries: [] };

/** A version-1 record: container path → marker. */
export type LegacyPauseMarkersRecord = Readonly<Record<string, PauseMarkerKind>>;

/**
 * What a seed may be handed: the current record, a version-1 post-state
 * (`markers` keyed by path), or a bare version-1 record.
 */
export type PauseMarkersSeedSource =
  | PauseMarkersRecord
  | { markers: LegacyPauseMarkersRecord; paths?: string[] }
  | LegacyPauseMarkersRecord;

export function isPauseMarkersRecord(v: unknown): v is PauseMarkersRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return Array.isArray(r.entries) && typeof r.markers === 'object' && r.markers !== null;
}

/** Split a seed source into current entries or the version-1 path map it carries. */
export function normalizePauseMarkersSeed(
  source: PauseMarkersSeedSource,
): { entries: PauseMarkerEntry[] } | { legacy: LegacyPauseMarkersRecord } {
  if (isPauseMarkersRecord(source)) return { entries: source.entries.filter(isPauseMarkerSlot) };
  const r = source as Record<string, unknown>;
  if (typeof r.markers === 'object' && r.markers !== null && !isPauseMarkerKind(r.markers)) {
    return { legacy: r.markers as LegacyPauseMarkersRecord };
  }
  return { legacy: source as LegacyPauseMarkersRecord };
}

/**
 * Convert a persisted record into a `MutationBatch` of one `create`
 * for the empty shell plus one `addToSet` per entry. A version-1
 * source seeds version-1 members (itemId = path) so there is exactly
 * one migration point — the read-side fold. All-or-nothing under the
 * oracle's per-entity lock — boot-time replay through this is
 * idempotent and byte-stable.
 */
export function seedPauseMarkers(source: PauseMarkersSeedSource, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      payload: {},
    },
  ];
  const seed = normalizePauseMarkersSeed(source);
  if ('entries' in seed) {
    for (const entry of seed.entries) {
      const item: PauseMarkerEntry = { type: entry.type, uid: entry.uid, marker: entry.marker };
      if (entry.path !== undefined) item.path = entry.path;
      bodies.push({
        kind: 'addToSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: entry.uid,
        item,
      });
    }
  } else {
    for (const [path, marker] of Object.entries(seed.legacy)) {
      if (!isPauseMarkerKind(marker)) continue;
      bodies.push({
        kind: 'addToSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: path,
        item: { path, marker },
      });
    }
  }
  return mintBatch(ctx, bodies);
}

/** A live set member with the HLC of the add that placed it. */
export interface PauseMarkerLiveItem {
  itemId: string;
  item: unknown;
  addHlc: HLC;
}

/** Resolve a version-1 container path to its ref; `null` drops the member from the projection. */
export type LegacyPauseMarkerResolver = (path: string) => PauseMarkerRef | null;

/**
 * Fold the live set into entries, one per container uid, sorted by
 * uid. Version-2 members are taken as is; version-1 members resolve
 * through `resolveLegacyPath`, keeping the path as the hint. Where two
 * members name one container the higher add-HLC wins.
 */
export function foldPauseMarkerItems(
  liveItems: ReadonlyArray<PauseMarkerLiveItem>,
  resolveLegacyPath: LegacyPauseMarkerResolver,
): PauseMarkerEntry[] {
  const byUid = new Map<string, { entry: PauseMarkerEntry; addHlc: HLC }>();
  for (const live of liveItems) {
    const entry = entryOf(live.item, resolveLegacyPath);
    if (!entry) continue;
    const held = byUid.get(entry.uid);
    if (held && compareHlc(live.addHlc, held.addHlc) <= 0) continue;
    byUid.set(entry.uid, { entry, addHlc: live.addHlc });
  }
  return Array.from(byUid.values(), (held) => held.entry).sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}

function entryOf(item: unknown, resolveLegacyPath: LegacyPauseMarkerResolver): PauseMarkerEntry | null {
  if (isPauseMarkerSlot(item)) {
    const entry: PauseMarkerEntry = { type: item.type, uid: item.uid, marker: item.marker };
    if (item.path !== undefined) entry.path = item.path;
    return entry;
  }
  if (!isLegacyPauseMarkerSlot(item)) return null;
  const ref = resolveLegacyPath(item.path);
  if (!ref) return null;
  return { type: ref.type, uid: ref.uid, marker: item.marker, path: item.path };
}

export function pauseMarkersRecordFromEntries(entries: PauseMarkerEntry[]): PauseMarkersRecord {
  const markers: Record<string, PauseMarkerKind> = {};
  for (const entry of entries) markers[entry.uid] = entry.marker;
  return { markers, entries };
}

/**
 * Recover a `PauseMarkersSnapshot` from the oracle's materialized
 * singleton. The snapshot doesn't carry the marker set — members live
 * one layer down on the live set — so the projector takes the live
 * members as the second argument. Returns `null` only if the entity
 * type doesn't match.
 */
export function projectPauseMarkers(
  materialized: MaterializedEntity,
  liveItems: ReadonlyArray<PauseMarkerLiveItem>,
  resolveLegacyPath: LegacyPauseMarkerResolver,
): PauseMarkersSnapshot | null {
  if (materialized.type !== PAUSE_MARKERS_ENTITY_TYPE) return null;
  return pauseMarkersRecordFromEntries(foldPauseMarkerItems(liveItems, resolveLegacyPath));
}

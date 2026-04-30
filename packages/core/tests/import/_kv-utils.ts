/**
 * Helpers for asserting against `RequestHeader[]` / `QueryParam[]`
 * without coupling tests to the per-row `uid` field. The schema bump
 * that introduced `uid` (sync engine §7.2 — set-modeled rows keyed by
 * itemId) means importers mint random 8-char uids; tests assert on the
 * key/value/description/enabled shape and use {@link stripUid} to drop
 * the uid before comparison. New construction sites that need to
 * supply a deterministic uid can use {@link kv}.
 */

type Strip<T> = Omit<T, 'uid'>;

export function stripUid<T extends { uid?: string }>(item: T): Strip<T> {
  const { uid: _uid, ...rest } = item;
  return rest as Strip<T>;
}

export function stripUids<T extends { uid?: string }>(items: readonly T[]): Strip<T>[] {
  return items.map(stripUid);
}

/**
 * Set-level conflict key encoding.
 *
 * The conflict tracker addresses both leaf-scalar and set-membership /
 * set-reorder conflicts in one path-keyed map. To avoid collision
 * between a leaf path and a set conflict targeting the same parent,
 * set-level keys are prefixed:
 *
 *   - `set:<setPath>.<uid>`     — saved-side add / saved-side remove
 *   - `reorder:<setPath>`       — same membership, different order
 *
 * Encoding/decoding is entity-agnostic — set paths are entity-defined
 * (e.g. `action.requestHeaders` for rules, `formValues.requestHeaders`
 * for templates) but the key shape is universal.
 */

const SET_KEY_PREFIX = 'set:';
const REORDER_KEY_PREFIX = 'reorder:';

export function setConflictKey(setPath: string, uid: string): string {
  return `${SET_KEY_PREFIX}${setPath}.${uid}`;
}

export function reorderConflictKey(setPath: string): string {
  return `${REORDER_KEY_PREFIX}${setPath}`;
}

export function isSetConflictKey(key: string): boolean {
  return key.startsWith(SET_KEY_PREFIX);
}

export function isReorderConflictKey(key: string): boolean {
  return key.startsWith(REORDER_KEY_PREFIX);
}

export function decodeSetConflictKey(key: string): { setPath: string; uid: string } | null {
  if (!isSetConflictKey(key)) return null;
  const rest = key.slice(SET_KEY_PREFIX.length);
  const m = /^(.+)\.([a-z0-9]{8})$/.exec(rest);
  if (!m) return null;
  return { setPath: m[1], uid: m[2] };
}

export function decodeReorderConflictKey(key: string): { setPath: string } | null {
  if (!isReorderConflictKey(key)) return null;
  return { setPath: key.slice(REORDER_KEY_PREFIX.length) };
}

/**
 * Set-level conflict key encoding.
 *
 * The conflict tracker addresses both leaf-scalar and set-membership /
 * set-reorder conflicts in one path-keyed map. To avoid collision
 * between a leaf path and a set conflict targeting the same parent,
 * set-level keys are prefixed:
 *
 *   - `set:<setPath>.<member>`  — saved-side add / saved-side remove
 *   - `reorder:<setPath>`       — same membership, different order
 *
 * `<member>` is either a uid (`[a-z0-9]{8}`), a percent-encoded
 * value-set entry, or an application-controlled key for map-semantics
 * sets. uid-keyed members never collide with the `.` segment separator
 * (uids are alphanumeric); value-keyed members may contain `.`, `:`,
 * `%` etc., so the codec percent-encodes those characters in the
 * suffix and reverses on decode. Map-semantics keys are application-
 * scoped and quoted at the call site.
 */

const SET_KEY_PREFIX = 'set:';
const REORDER_KEY_PREFIX = 'reorder:';

const RESERVED = /[.%:]/g;

function encodeSuffix(s: string): string {
  return s.replace(RESERVED, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

function decodeSuffix(s: string): string {
  return s.replace(/%([0-9A-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function setConflictKey(setPath: string, uid: string): string {
  return `${SET_KEY_PREFIX}${setPath}.${uid}`;
}

/**
 * Value-set conflict key. Percent-encodes `.`, `:`, `%` in the value
 * so the suffix can be unambiguously parsed back out by
 * {@link decodeSetValueConflictKey}.
 */
export function setValueConflictKey(setPath: string, value: string): string {
  return `${SET_KEY_PREFIX}${setPath}.${encodeSuffix(value)}`;
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

/**
 * Decode a value-set conflict key into `{setPath, value}`. Splits on
 * the LAST `.` since paths can contain `.` segments; the suffix is the
 * percent-encoded value.
 */
export function decodeSetValueConflictKey(key: string): { setPath: string; value: string } | null {
  if (!isSetConflictKey(key)) return null;
  const rest = key.slice(SET_KEY_PREFIX.length);
  const lastDot = rest.lastIndexOf('.');
  if (lastDot < 0) return null;
  return { setPath: rest.slice(0, lastDot), value: decodeSuffix(rest.slice(lastDot + 1)) };
}

export function decodeReorderConflictKey(key: string): { setPath: string } | null {
  if (!isReorderConflictKey(key)) return null;
  return { setPath: key.slice(REORDER_KEY_PREFIX.length) };
}

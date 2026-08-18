/**
 * Shared helpers for the canonical changelog tree (the changelog plan §2).
 * The frontmatter parser covers exactly the subset the plan prescribes —
 * scalar `key: value`, one-level string lists, inline maps as raw
 * strings — anything fancier is an error by design; the machine layer
 * stays this simple on purpose.
 */

export const STREAMS = ['desktop', 'extension', 'cli', 'daemon', 'web'];

/**
 * Parse an entry's frontmatter. Returns `{ fields, body, errors }`;
 * on a structural error `fields` is null and `errors` names the first
 * violation (matching the lint's abort-on-first behavior).
 */
export function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { fields: null, body: '', errors: ['missing frontmatter opening ---'] };
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { fields: null, body: '', errors: ['missing frontmatter closing ---'] };
  const fields = {};
  let listKey = null;
  for (const line of text.slice(4, end).split('\n')) {
    if (line.trim() === '') continue;
    const listItem = line.match(/^\s+- (.*)$/);
    if (listItem) {
      if (!listKey) return { fields: null, body: '', errors: [`list item outside a list: ${line.trim()}`] };
      fields[listKey].push(listItem[1].trim());
      continue;
    }
    const pair = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (!pair) return { fields: null, body: '', errors: [`unparseable frontmatter line: ${line.trim()}`] };
    const [, key, value] = pair;
    if (value === '') {
      listKey = key;
      fields[key] = [];
    } else {
      listKey = null;
      fields[key] = value;
    }
  }
  return { fields, body: text.slice(end + 4).replace(/^-*\n?/, ''), errors: [] };
}

/** `{ server: 2026.7.27 }` → object; null when the value is not an inline map. */
export function parseInlineMap(value) {
  const match = /^\{\s*(.*?)\s*\}$/.exec(value);
  if (!match) return null;
  const map = {};
  if (match[1] === '') return map;
  for (const part of match[1].split(',')) {
    const kv = part.split(':');
    if (kv.length !== 2) return null;
    map[kv[0].trim()] = kv[1].trim();
  }
  return map;
}

/** Numeric segment-wise compare for base CalVer strings (no prerelease suffix). */
export function compareCalVer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

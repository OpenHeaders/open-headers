/**
 * Fractional indexing keys for parent-owned ordering (§7.2 / §23.5).
 *
 * Each ordered set member carries an opaque `key` string. Materialized
 * order is the lex sort of those keys. To insert between two existing
 * keys we mint a new key strictly between them; that's the only
 * primitive every consumer needs.
 *
 * Charset is lowercase a–z (base 26). 'a' is the floor, 'z' the
 * ceiling, 'm' the canonical seed for an empty list. Lex compare on
 * these strings matches the desired total order: shorter prefixes
 * sort before longer extensions of themselves, so we never need an
 * "end-of-key" sentinel.
 *
 * This module is convergence-irrelevant on its own — it is pure given
 * its inputs. Convergence at the store layer comes from
 * LWW-by-HLC on the (orderKey, hlc) record per (setPath, itemId).
 */
const FIRST = 0x61; // 'a'
const LAST = 0x7a; // 'z'
const SEED = 'm';

export const seedKey = (): string => SEED;

/**
 * Mint a key strictly between `low` and `high`. `null` on either side
 * means "no bound." Throws if `low >= high` or if no representable key
 * exists (never the case with the unbounded charset we use).
 */
export function keyBetween(low: string | null, high: string | null): string {
  if (low !== null && high !== null && low >= high) {
    throw new Error(`keyBetween: low (${low}) must be < high (${high})`);
  }
  if (low === null && high === null) return SEED;
  if (low === null) return keyBefore(high as string);
  if (high === null) return keyAfter(low);
  return keyMid(low, high);
}

/** Pick a key < `high` with no lower bound. */
function keyBefore(high: string): string {
  for (let i = 0; i < high.length; i += 1) {
    const c = high.charCodeAt(i);
    if (c > FIRST + 1) {
      // Strictly-between midpoint exists at this position.
      const mid = (FIRST + c) >> 1;
      return high.slice(0, i) + String.fromCharCode(mid);
    }
    if (c === FIRST + 1) {
      // No midpoint here, but extending with FIRST + SEED stays < high
      // (position i is FIRST < FIRST+1) and is a non-floor key.
      return `${high.slice(0, i)}${String.fromCharCode(FIRST)}${SEED}`;
    }
    // c === FIRST: keep this position equal and search deeper.
  }
  // `high` is all 'a's — no representable key strictly less. Mint
  // discipline (seeds at 'm', extensions append SEED) prevents reaching
  // an all-floor input.
  throw new Error(`keyBefore: cannot generate key strictly less than "${high}"`);
}

/** Pick a key > `low` with no upper bound. */
function keyAfter(low: string): string {
  for (let i = 0; i < low.length; i += 1) {
    const c = low.charCodeAt(i);
    if (c < LAST) {
      const mid = (c + LAST + 1) >> 1;
      return low.slice(0, i) + String.fromCharCode(mid);
    }
  }
  return low + SEED;
}

/** Pick a key strictly between `low` and `high` (low < high). */
function keyMid(low: string, high: string): string {
  let i = 0;
  while (i < low.length && i < high.length && low[i] === high[i]) i += 1;

  const lc = i < low.length ? low.charCodeAt(i) : FIRST - 1;
  const hc = i < high.length ? high.charCodeAt(i) : LAST + 1;

  if (hc - lc > 1) {
    const mid = (lc + hc) >> 1;
    return low.slice(0, i) + String.fromCharCode(mid);
  }

  // Adjacent codepoints at position i. Extend `low` past `i` until we
  // can fit a midpoint: take low[0..i+1) then `keyAfter` on the rest.
  // Result starts with low's prefix at position i (= lc < hc) so it's
  // strictly less than `high`, and `keyAfter` makes it strictly
  // greater than `low`.
  const tail = i + 1 < low.length ? low.slice(i + 1) : '';
  return low.slice(0, i + 1) + keyAfter(tail);
}

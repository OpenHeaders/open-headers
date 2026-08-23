/**
 * First-boot setup code — the anti-hijack proof a REMOTE browser
 * presents to claim an unclaimed server (the front-door plan §4.3).
 *
 * A claim from loopback needs no proof: being on the box is the proof,
 * and it is the dominant first-run case. A claim from anywhere else —
 * in practice through a TLS proxy, the one deployment where the admin
 * has no browser on the machine — carries this code instead.
 *
 * Minted per BOOT while the directory is still empty (O11), never
 * persisted: the state it guards lasts minutes, and a code on disk
 * would be a long-lived remote-admission secret for a window that is
 * already closed by the claim itself. A restart mints a new one and
 * the boot log says so.
 *
 * Shape is `4KFP-9QW2-XM31` — twelve symbols over a 31-glyph alphabet
 * (~59 bits) with `0/O` and `1/I/L` left out, so a code read off a
 * terminal and typed into a browser survives the trip. Comparison
 * folds case and ignores the dashes, because that is how people
 * retype it.
 */

/** Unambiguous when transcribed: no `0`/`O`, no `1`/`I`/`L`. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GROUP_LENGTH = 4;
const GROUP_COUNT = 3;
const CODE_LENGTH = GROUP_LENGTH * GROUP_COUNT;
/** Largest multiple of the alphabet size under 256 — bytes above it are redrawn, so no glyph is favoured. */
const UNBIASED_CEILING = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;

/**
 * Mint one setup code. Cryptographic randomness with modulo bias
 * rejected, the same discipline the pairing code's digits use — here
 * the entropy IS the whole barrier (there is no short TTL behind it),
 * so it is sized for offline guessing, not just for the limiter.
 */
export function generateSetupCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  let symbols = '';
  while (symbols.length < CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && symbols.length < CODE_LENGTH; i++) {
      if (bytes[i] < UNBIASED_CEILING) symbols += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i += GROUP_LENGTH) groups.push(symbols.slice(i, i + GROUP_LENGTH));
  return groups.join('-');
}

/** Fold a typed code to its comparable form: upper case, no separators or spaces. */
export function normalizeSetupCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Do a presented code and the live one match? Constant-time over the
 * normalized forms so a guess learns nothing from how long the answer
 * took; an absent live code (a claimed server) never matches.
 */
export function setupCodeMatches(presented: string | undefined, live: string | null): boolean {
  if (live === null || presented === undefined) return false;
  const a = normalizeSetupCode(presented);
  const b = normalizeSetupCode(live);
  if (a.length !== b.length || a.length === 0) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

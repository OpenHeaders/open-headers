/**
 * Shared alarm-name codec. Every refresh subsystem (OAuth, Live, future
 * DNR rule-refresh) encodes its per-job identity as
 * `<prefix>:<base64url(JSON)>` so alarm names survive SW eviction +
 * arbitrary identifier contents (colons, spaces, slashes) round-trip
 * unambiguously.
 *
 * Using base64url avoids `btoa` in SW context occasionally being
 * unavailable or mis-handling non-ASCII; UTF-8 → bytes → base64 is
 * portable across every runtime the extension targets (MV3 chrome,
 * Edge, Firefox, plus the tests' node/jsdom environment).
 *
 * Before Phase H, both `oauth-refresh-scheduler.ts` and
 * `live-refresh-scheduler.ts` carried their own private copies of the
 * encode/decode + envelope logic. This module is the single source so
 * a future codec tweak propagates once instead of drifting.
 */

/**
 * Encode a UTF-8 string to base64url (RFC 4648 §5 — URL-safe without
 * padding). The inverse is {@link base64UrlDecode}. Round-trip must be
 * byte-stable across chrome / edge / firefox / node.
 */
export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string produced by {@link base64UrlEncode} back
 * to a UTF-8 string. Pad-free input is expected; we re-pad before
 * decoding so both `btoa`/`atob` and `Buffer` paths behave identically.
 */
export function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Create a typed alarm-name codec for a subsystem. Usage from a
 * scheduler module:
 *
 *   interface OAuthPayload { w: string; r: string }
 *   const { encode, decode, matches } = createAlarmNameCodec<OAuthPayload>(
 *     'oauth-refresh:',
 *     (p) => typeof p.w === 'string' && typeof p.r === 'string',
 *   );
 *
 * `decode` returns `null` for alarms carrying the wrong prefix OR whose
 * payload doesn't satisfy `isValid` — callers treat that as "not mine,
 * ignore" (the same dispatch pattern as `isOAuthRefreshAlarm`).
 */
export function createAlarmNameCodec<TPayload extends object>(
  prefix: string,
  isValid: (payload: unknown) => boolean,
): {
  encode: (payload: TPayload) => string;
  decode: (name: string) => TPayload | null;
  matches: (name: string) => boolean;
} {
  return {
    encode(payload: TPayload): string {
      return `${prefix}${base64UrlEncode(JSON.stringify(payload))}`;
    },
    decode(name: string): TPayload | null {
      if (!name.startsWith(prefix)) return null;
      try {
        const raw = JSON.parse(base64UrlDecode(name.slice(prefix.length))) as unknown;
        if (!isValid(raw)) return null;
        return raw as TPayload;
      } catch {
        return null;
      }
    },
    matches(name: string): boolean {
      return typeof name === 'string' && name.startsWith(prefix);
    },
  };
}

/**
 * Response-body materialization — hold the wire bytes losslessly in the
 * snapshot's string `body` field. Valid UTF-8 stays text verbatim;
 * anything else is stored base64 with `bodyEncoding: 'base64'` so the
 * viewer can reconstruct the exact bytes (hex view, PDF preview, save
 * to file). The bytes decide text-vs-binary — never the Content-Type,
 * which lies in both directions.
 */

export interface MaterializedBody {
  body: string;
  bodyEncoding?: 'base64';
}

/** Strict decoder — throws on any invalid sequence instead of minting
 *  U+FFFD replacement characters, which is what makes text-vs-binary
 *  decidable. Stateless across `decode()` calls (no stream option). */
const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

export function materializeBody(bytes: Uint8Array, truncated: boolean): MaterializedBody {
  try {
    return { body: strictUtf8.decode(bytes) };
  } catch {
    // A byte-capped TEXT body can end mid-codepoint; retry with up to
    // three trailing bytes dropped (the longest partial UTF-8 tail)
    // before concluding the payload is binary.
    if (truncated) {
      for (let trim = 1; trim <= 3 && trim < bytes.byteLength; trim++) {
        try {
          return { body: strictUtf8.decode(bytes.subarray(0, bytes.byteLength - trim)) };
        } catch {
          // Still mid-codepoint — keep trimming.
        }
      }
    }
    return { body: toBase64(bytes), bodyEncoding: 'base64' };
  }
}

/** Chunked base64 — `String.fromCharCode(...bytes)` in one call blows
 *  the argument limit on multi-megabyte bodies. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk));
  }
  return btoa(binary);
}

/**
 * WebSocket close-code vocabulary — the RFC 6455 §7.4.1 status codes
 * and the IANA-registered additions, each with its registry phrase.
 * Spec vocabulary, not localized (the way HTTP reason phrases stay in
 * English); a description in the viewer's language rides the catalog
 * under the code.
 */

const WS_CLOSE_CODE_PHRASES: Readonly<Record<number, string>> = {
  1000: 'Normal Closure',
  1001: 'Going Away',
  1002: 'Protocol Error',
  1003: 'Unsupported Data',
  1005: 'No Status Received',
  1006: 'Abnormal Closure',
  1007: 'Invalid Frame Payload Data',
  1008: 'Policy Violation',
  1009: 'Message Too Big',
  1010: 'Mandatory Extension',
  1011: 'Internal Error',
  1012: 'Service Restart',
  1013: 'Try Again Later',
  1014: 'Bad Gateway',
  1015: 'TLS Handshake',
};

/** The registry phrase for a close code; null for a private or
 *  unregistered code (3000–4999 application codes included). */
export function wsCloseCodePhrase(code: number): string | null {
  return WS_CLOSE_CODE_PHRASES[code] ?? null;
}

/** Every code the registry names — the catalog carries a description
 *  for each. */
export const WS_CLOSE_CODES: readonly number[] = Object.keys(WS_CLOSE_CODE_PHRASES).map(Number);

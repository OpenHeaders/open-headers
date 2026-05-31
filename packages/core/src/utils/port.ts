/**
 * TCP port validation — shared by every surface that lets a user pick a
 * port (the daemon bind-port setting, the client backend-URL port field).
 *
 * Three verdicts, not a boolean, because two of the bad cases are
 * categorically different:
 *
 *   - `reject` — the value can't work. Non-integer, out of the 1–65535
 *     range, or below 1024 (the privileged range needs elevated
 *     permissions to bind, so a user-space daemon listener fails). The
 *     UI blocks the commit and shows the message as an error.
 *   - `warn`  — the value works but is risky. 49152–65535 is the OS
 *     ephemeral range it hands out for outgoing connections, so a
 *     long-lived listener there can intermittently lose the bind to
 *     EADDRINUSE. The UI allows the commit and shows the message as an
 *     inline warning.
 *   - `ok`    — 1024–49151, the registered/user range. No message.
 *
 * Pure and host-neutral: the same helper gates the desktop daemon's
 * bind-port input and the extension client's URL port field, so the two
 * surfaces can never drift on what counts as a usable port.
 */

/** Lowest non-privileged port — binding below this needs elevated permissions. */
export const MIN_UNPRIVILEGED_PORT = 1024;
/** First port in the OS ephemeral range (IANA dynamic/private range). */
export const EPHEMERAL_PORT_START = 49152;
/** Highest valid TCP port. */
export const MAX_PORT = 65535;

export type PortValidation =
  | { level: 'ok' }
  | { level: 'warn'; message: string }
  | { level: 'reject'; message: string };

/**
 * Classify a port number into an {@link PortValidation} verdict. Accepts
 * the parsed number; callers that hold a string parse it first (an empty
 * or non-numeric string is the caller's "not set yet" state, distinct
 * from an out-of-range number).
 */
export function validatePort(port: number): PortValidation {
  if (!Number.isInteger(port)) {
    return { level: 'reject', message: 'Port must be a whole number.' };
  }
  if (port < MIN_UNPRIVILEGED_PORT) {
    return {
      level: 'reject',
      message: `Ports below ${MIN_UNPRIVILEGED_PORT} are privileged and need elevated permissions — pick ${MIN_UNPRIVILEGED_PORT} or higher.`,
    };
  }
  if (port > MAX_PORT) {
    return { level: 'reject', message: `Port must be ${MAX_PORT} or below.` };
  }
  if (port >= EPHEMERAL_PORT_START) {
    return {
      level: 'warn',
      message: `Ports ${EPHEMERAL_PORT_START}–${MAX_PORT} are the range the OS hands out for outgoing connections; a listener here can intermittently fail to bind. A port from ${MIN_UNPRIVILEGED_PORT}–${EPHEMERAL_PORT_START - 1} is more reliable.`,
    };
  }
  return { level: 'ok' };
}

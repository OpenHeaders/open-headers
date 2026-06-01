/**
 * Probe-result → notification copy. Shared by the two surfaces that run
 * a connection probe: the BackendPane "Test connection" button and the
 * Switch gate (`useBackendModeSwitch`). Keeping the mapping here means
 * both speak with one voice — a reachable-but-auth-required back-end
 * reads the same whether the user tested it or tried to switch to it.
 *
 * Pure: maps a {@link ProbeConnectionResult} to a level + title + body.
 * The caller fires it through whatever notification API it holds.
 */

import type { ProbeConnectionResult, ProbeFailure } from './probe-connection';

export type ProbeNoticeLevel = 'success' | 'warning' | 'error';

export interface ProbeNotice {
  readonly level: ProbeNoticeLevel;
  readonly message: string;
  readonly description: string;
}

/** Short notification title for a "reachable, but …" probe outcome. */
export function probeWarningTitle(result: ProbeFailure): string {
  if (result.reason === 'handshake-rejected') {
    if (result.rejectReason === 'auth-required') return 'Reachable, but auth required';
    if (result.rejectReason === 'workspace-unknown') return 'Reachable, but workspace not shared';
    if (result.rejectReason === 'protocol-too-old' || result.rejectReason === 'protocol-too-new') {
      return 'Reachable, but version mismatch';
    }
  }
  if (result.reason === 'protocol-mismatch') return 'Reachable, but version mismatch';
  return 'Reachable, but not ready';
}

export function humanizeProbeFailure(result: ProbeFailure): string {
  switch (result.reason) {
    case 'invalid-url':
      return `Invalid URL. ${result.detail ?? ''}`.trim();
    case 'timeout':
      return 'Timed out waiting for a response — is the back-end running?';
    case 'closed-before-welcome':
      return 'Connection closed before the handshake — back-end likely not running on that port.';
    case 'open-failed':
      return `Could not open WebSocket${result.detail ? `: ${result.detail}` : ''}.`;
    case 'protocol-mismatch':
      return 'Reachable, but protocol versions are incompatible — update both apps.';
    case 'handshake-rejected':
      if (result.rejectReason === 'workspace-unknown') {
        return "Reachable — the back-end is up but doesn't share this workspace yet. Switching will pair the two.";
      }
      if (result.rejectReason === 'protocol-too-old') {
        return 'Reachable — but this app is older than the back-end. Update this side.';
      }
      if (result.rejectReason === 'protocol-too-new') {
        return 'Reachable — but the back-end is older than this app. Update the back-end.';
      }
      if (result.rejectReason === 'auth-required') {
        return "Reachable — but this device isn't authenticated yet. Pair with a code or paste a token above, then Switch.";
      }
      return `Rejected: ${result.rejectReason ?? 'unknown reason'}`;
    case 'malformed-welcome':
      return "Reached a server, but it didn't speak the Open Headers protocol.";
    default:
      return 'Probe failed.';
  }
}

/**
 * Map a probe result to the notification the UI should fire. Success is
 * a plain "reachable"; a back-end that answered but isn't usable yet
 * (incompatible version, not paired, doesn't share the workspace) is a
 * "reachable, but …" warning; everything else is a hard "not reachable"
 * error. `label` names the back-end in the copy.
 */
export function describeProbeResult(result: ProbeConnectionResult, label: string): ProbeNotice {
  if (result.ok) {
    return { level: 'success', message: 'Connection OK', description: `${label} is reachable.` };
  }
  const reachable = result.reason === 'protocol-mismatch' || result.reason === 'handshake-rejected';
  const description = humanizeProbeFailure(result);
  if (reachable) {
    return { level: 'warning', message: probeWarningTitle(result), description };
  }
  return { level: 'error', message: 'Not reachable', description };
}

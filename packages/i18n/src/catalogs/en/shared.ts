/**
 * Shared namespace — strings used by more than one surface (common
 * actions, generic states). Keys land here the first time a second
 * surface needs them; surface-specific strings stay in their own file.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Save',
  'shared.action.cancel': 'Cancel',
  'shared.action.close': 'Close',
  'shared.action.copy': 'Copy',
  'shared.action.remove': 'Remove',
  'shared.toast.copiedToClipboard': 'Copied to clipboard',
  'shared.toast.copyFailed': 'Clipboard access denied — copy the value manually',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} rule', other: '{count} rules' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': 'Something went wrong',
  'shared.errorBoundary.subtitle': 'There was an error loading the popup. Please try closing and reopening it.',
  'shared.errorBoundary.reload': 'Reload',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Open Headers was updated or reloaded',
  'shared.contextInvalidated.body': 'Close and reopen DevTools to continue.',

  // ── Connection-probe notices ─────────────────────────────────────────
  // Fired by every surface that verifies a back-end wire (Test
  // connection, the probe-gated enable switch).
  'shared.probe.connectionOk': 'Connection OK',
  'shared.probe.reachableDescription': '{label} is reachable.',
  'shared.probe.notReachable': 'Not reachable',
  'shared.probe.title.authRequired': 'Reachable, but auth required',
  'shared.probe.title.workspaceUnknown': 'Reachable, but workspace not shared',
  'shared.probe.title.versionMismatch': 'Reachable, but version mismatch',
  'shared.probe.title.notReady': 'Reachable, but not ready',
  'shared.probe.fail.invalidUrl': 'Invalid URL.',
  'shared.probe.fail.invalidUrlDetail': 'Invalid URL. {detail}',
  'shared.probe.fail.timeout': 'Timed out waiting for a response — is the back-end running?',
  'shared.probe.fail.closedBeforeWelcome':
    'Connection closed before the handshake — back-end likely not running on that port.',
  'shared.probe.fail.openFailed': 'Could not open WebSocket.',
  'shared.probe.fail.openFailedDetail': 'Could not open WebSocket: {detail}.',
  'shared.probe.fail.protocolMismatch': 'Reachable, but protocol versions are incompatible — update both apps.',
  'shared.probe.fail.workspaceUnknown':
    "Reachable — the back-end is up but doesn't share this workspace yet. Switching will pair the two.",
  'shared.probe.fail.protocolTooOld': 'Reachable — but this app is older than the back-end. Update this side.',
  'shared.probe.fail.protocolTooNew': 'Reachable — but the back-end is older than this app. Update the back-end.',
  'shared.probe.fail.authRequired':
    "Reachable — but this device isn't authenticated yet. Pair with a code or paste a token above, then Switch.",
  'shared.probe.fail.rejected': 'Rejected: {reason}',
  'shared.probe.fail.rejectedUnknown': 'Rejected: unknown reason',
  'shared.probe.fail.malformedWelcome': "Reached a server, but it didn't speak the Open Headers protocol.",
  'shared.probe.fail.generic': 'Probe failed.',
} as const satisfies Catalog;

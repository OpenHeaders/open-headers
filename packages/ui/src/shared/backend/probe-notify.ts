/**
 * Probe-result → notification copy. Shared by every surface that runs
 * a connection probe (the enable gate, `useBackendEnableSwitch`, today).
 * Keeping the mapping here means they all speak with one voice — a
 * reachable-but-auth-required back-end reads the same everywhere.
 *
 * Pure: maps a {@link ProbeConnectionResult} to a level + title + body.
 * The caller fires it through whatever notification API it holds, and
 * passes its active-locale translator — shared modules never reach for
 * a locale themselves.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { ProbeConnectionResult, ProbeFailure } from './probe-connection';

export type ProbeNoticeLevel = 'success' | 'warning' | 'error';

export interface ProbeNotice {
  readonly level: ProbeNoticeLevel;
  readonly message: string;
  readonly description: string;
}

/** Short notification title for a "reachable, but …" probe outcome. */
export function probeWarningTitle(result: ProbeFailure, t: Translate): string {
  if (result.reason === 'handshake-rejected') {
    if (result.rejectReason === 'auth-required') return t('shared.probe.title.authRequired');
    if (result.rejectReason === 'workspace-unknown') return t('shared.probe.title.workspaceUnknown');
    if (result.rejectReason === 'protocol-too-old' || result.rejectReason === 'protocol-too-new') {
      return t('shared.probe.title.versionMismatch');
    }
  }
  if (result.reason === 'protocol-mismatch') return t('shared.probe.title.versionMismatch');
  return t('shared.probe.title.notReady');
}

export function humanizeProbeFailure(result: ProbeFailure, t: Translate): string {
  switch (result.reason) {
    case 'invalid-url':
      return result.detail
        ? t('shared.probe.fail.invalidUrlDetail', { detail: result.detail })
        : t('shared.probe.fail.invalidUrl');
    case 'timeout':
      return t('shared.probe.fail.timeout');
    case 'closed-before-welcome':
      return t('shared.probe.fail.closedBeforeWelcome');
    case 'open-failed':
      return result.detail
        ? t('shared.probe.fail.openFailedDetail', { detail: result.detail })
        : t('shared.probe.fail.openFailed');
    case 'protocol-mismatch':
      return t('shared.probe.fail.protocolMismatch');
    case 'handshake-rejected':
      if (result.rejectReason === 'workspace-unknown') return t('shared.probe.fail.workspaceUnknown');
      if (result.rejectReason === 'protocol-too-old') return t('shared.probe.fail.protocolTooOld');
      if (result.rejectReason === 'protocol-too-new') return t('shared.probe.fail.protocolTooNew');
      if (result.rejectReason === 'auth-required') return t('shared.probe.fail.authRequired');
      return result.rejectReason
        ? t('shared.probe.fail.rejected', { reason: result.rejectReason })
        : t('shared.probe.fail.rejectedUnknown');
    case 'malformed-welcome':
      return t('shared.probe.fail.malformedWelcome');
    default:
      return t('shared.probe.fail.generic');
  }
}

/**
 * Map a probe result to the notification the UI should fire. Success is
 * a plain "reachable"; a back-end that answered but isn't usable yet
 * (incompatible version, not paired, doesn't share the workspace) is a
 * "reachable, but …" warning; everything else is a hard "not reachable"
 * error. `label` names the back-end in the copy.
 */
export function describeProbeResult(result: ProbeConnectionResult, label: string, t: Translate): ProbeNotice {
  if (result.ok) {
    return {
      level: 'success',
      message: t('shared.probe.connectionOk'),
      description: t('shared.probe.reachableDescription', { label }),
    };
  }
  const reachable = result.reason === 'protocol-mismatch' || result.reason === 'handshake-rejected';
  const description = humanizeProbeFailure(result, t);
  if (reachable) {
    return { level: 'warning', message: probeWarningTitle(result, t), description };
  }
  return { level: 'error', message: t('shared.probe.notReachable'), description };
}

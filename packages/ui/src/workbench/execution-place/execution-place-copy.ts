/**
 * The reader's resolution, worded: the hover line (the place button's
 * accessible name — the standard "Runs locally: in …" / "Runs
 * remotely: on …", or the honest state), the reason sentence and the
 * page-realm knob notice. One place for the copy so the five editors'
 * disabled tooltips and the control's popover say the same thing (the
 * five per-editor host strings retired here at S1). The roster's row
 * labels and reasons live here too.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type {
  ExecutionPlaceResolution,
  ExecutionPlaceRole,
  ExecutionPlaceRosterReason,
  PageSessionKnob,
} from './resolve-execution-place';

export interface ExecutionPlaceCopy {
  /** The hover line — the button's accessible name. */
  chip: string;
  reason: string;
  /** The knobs the resolved place cannot apply (a page-realm session's
   *  node-only knobs, a delegated send's cookie jar), as one sentence;
   *  null when none. */
  knobs: string | null;
}

/** A roster row's label — the place as the product names it: the
 *  browser extension where this surface is one, the desktop app, the
 *  server. */
export function executionPlaceRosterLabel(role: ExecutionPlaceRole, t: Translate): string {
  switch (role) {
    case 'here':
      return getCurrentHost() === 'extension'
        ? t('shared.executionPlace.roster.browser')
        : t('shared.executionPlace.roster.desktopApp');
    case 'desktop-app':
      return t('shared.executionPlace.roster.desktopApp');
    case 'workspace-server':
      return t('shared.executionPlace.roster.server');
  }
}

/** Why a roster row is disabled, in one short line. */
export function executionPlaceRosterReason(reason: ExecutionPlaceRosterReason, t: Translate): string {
  switch (reason) {
    case 'kind-not-here':
      return t('shared.executionPlace.roster.reason.kindNotHere');
    case 'desktop-not-running':
      return t('shared.executionPlace.roster.reason.desktopNotRunning');
    case 'desktop-not-paired':
      return t('shared.executionPlace.roster.reason.desktopNotPaired');
    case 'desktop-not-installed':
      return t('shared.executionPlace.roster.reason.desktopNotInstalled');
    case 'desktop-connecting':
      return t('shared.executionPlace.roster.reason.desktopConnecting');
    case 'desktop-unavailable':
      return t('shared.executionPlace.roster.reason.desktopUnavailable');
    case 'no-server':
      return t('shared.executionPlace.roster.reason.noServer');
    case 'server-not-connected':
      return t('shared.executionPlace.roster.reason.serverNotConnected');
    case 'not-forwarded':
      return t('shared.executionPlace.roster.reason.notForwarded');
  }
}

/** The knob names the page-realm planes, the HTTP editor and the control share. */
export const PAGE_KNOB_KEY = {
  headers: 'workbench.editors.websocket.session.knobHeaders',
  sslVerify: 'workbench.editors.websocket.session.knobSslVerify',
  auth: 'workbench.editors.websocket.session.knobAuth',
  cookieJar: 'shared.executionPlace.knob.cookieJar',
} as const satisfies Record<PageSessionKnob, string>;

function roleName(role: ExecutionPlaceResolution['place'], placeName: string | null, t: Translate): string {
  switch (role) {
    case 'here':
      return t('shared.executionPlace.role.here');
    case 'desktop-app':
      return t('shared.executionPlace.role.desktopApp');
    case 'workspace-server':
      return placeName ?? t('shared.executionPlace.role.server');
  }
}

/** The hover standard: a local place names where on this machine, a
 *  remote one names the server. */
function localHere(t: Translate): string {
  return getCurrentHost() === 'extension'
    ? t('shared.executionPlace.tip.localBrowser')
    : t('shared.executionPlace.tip.localDesktop');
}

export function executionPlaceCopy(resolution: ExecutionPlaceResolution, t: Translate): ExecutionPlaceCopy {
  const { reason } = resolution;
  const place = roleName(resolution.place, resolution.placeName, t);
  switch (reason.kind) {
    case 'runs-here':
      return { chip: localHere(t), reason: t('shared.executionPlace.reason.runsHere'), knobs: null };
    case 'runs-here-browser':
      return { chip: localHere(t), reason: t('shared.executionPlace.reason.runsHereBrowser'), knobs: null };
    case 'runs-here-page-realm':
      return {
        chip: localHere(t),
        reason: t('shared.executionPlace.reason.runsHerePageRealm'),
        knobs:
          reason.knobs.length > 0
            ? t('workbench.editors.websocket.session.hostNotice', {
                knobs: reason.knobs.map((knob) => t(PAGE_KNOB_KEY[knob])).join(', '),
              })
            : null,
      };
    case 'context-send':
      return {
        chip: t('shared.executionPlace.tip.remoteServer', { place }),
        reason: t('shared.executionPlace.reason.contextSend', { place }),
        knobs: null,
      };
    case 'companion-invoke':
      return {
        chip: t('shared.executionPlace.tip.localDesktop'),
        reason: t('shared.executionPlace.reason.companionInvoke'),
        knobs: null,
      };
    case 'server-invoke':
      return {
        chip: t('shared.executionPlace.tip.remoteServer', { place }),
        reason: t('shared.executionPlace.reason.serverInvoke', { place }),
        knobs: null,
      };
    case 'companion-required':
      return {
        chip: t('shared.executionPlace.tip.needsPlace'),
        reason: t('shared.executionPlace.reason.companionRequired'),
        knobs: null,
      };
    case 'tcp-scheme':
      return {
        chip: t('shared.executionPlace.tip.needsPlace'),
        reason: t('shared.executionPlace.reason.tcpScheme'),
        knobs: null,
      };
    case 'session-not-forwarded':
      return {
        chip: t('shared.executionPlace.tip.notForwarded', { place }),
        reason: t('shared.executionPlace.reason.sessionNotForwarded', { place }),
        knobs: null,
      };
    case 'no-runtime':
      return {
        chip: t('shared.executionPlace.tip.unavailable'),
        reason: t('shared.executionPlace.reason.noRuntime'),
        knobs: null,
      };
    case 'delegated': {
      // Off-device transit is NAMED: a server receives the resolved
      // values; the desktop app on this device receives nothing the
      // vault does not already sync there. The context's knobs the
      // delegated socket cannot honour (the cookie jar) are named too.
      const knobs =
        reason.knobs.length > 0
          ? t('shared.executionPlace.knobsNotApplied', {
              place,
              knobs: reason.knobs.map((knob) => t(PAGE_KNOB_KEY[knob])).join(', '),
            })
          : null;
      return reason.role === 'desktop-app'
        ? {
            chip: t('shared.executionPlace.tip.localDesktop'),
            reason: t('shared.executionPlace.reason.delegatedDesktopApp'),
            knobs,
          }
        : {
            chip: t('shared.executionPlace.tip.remoteServer', { place }),
            reason: t('shared.executionPlace.reason.delegatedServer', { place }),
            knobs,
          };
    }
    case 'preference-unavailable': {
      const preferred = roleName(reason.preferred, null, t);
      return {
        chip: t('shared.executionPlace.tip.cannotRunOn', { place: preferred }),
        reason: t('shared.executionPlace.reason.preferenceUnavailable', { place: preferred }),
        knobs: null,
      };
    }
  }
}

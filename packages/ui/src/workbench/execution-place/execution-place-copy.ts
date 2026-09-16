/**
 * The reader's resolution, worded: the chip, the reason sentence and
 * the page-realm knob notice. One place for the copy so the five
 * editors' disabled tooltips and the control's popover say the same
 * thing (the five per-editor host strings retired here at S1).
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { ExecutionPlaceResolution, ExecutionPlaceRole, PageSessionKnob } from './resolve-execution-place';

export interface ExecutionPlaceCopy {
  chip: string;
  reason: string;
  /** The knobs the resolved place cannot apply (a page-realm session's
   *  node-only knobs, a delegated send's cookie jar), as one sentence;
   *  null when none. */
  knobs: string | null;
}

/** A picker row's label — the place as a thing to choose, never the
 *  word "Auto" (the resolved place is what the user sees). */
export function executionPlaceOptionLabel(role: ExecutionPlaceRole, placeName: string | null, t: Translate): string {
  switch (role) {
    case 'here':
      return t('shared.executionPlace.option.here');
    case 'desktop-app':
      return t('shared.executionPlace.option.desktopApp');
    case 'workspace-server':
      return placeName ?? t('shared.executionPlace.option.server');
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

export function executionPlaceCopy(resolution: ExecutionPlaceResolution, t: Translate): ExecutionPlaceCopy {
  const { reason } = resolution;
  const place = roleName(resolution.place, resolution.placeName, t);
  switch (reason.kind) {
    case 'runs-here':
      return {
        chip: t('shared.executionPlace.chip.here'),
        reason: t('shared.executionPlace.reason.runsHere'),
        knobs: null,
      };
    case 'runs-here-browser':
      return {
        chip: t('shared.executionPlace.chip.here'),
        reason: t('shared.executionPlace.reason.runsHereBrowser'),
        knobs: null,
      };
    case 'runs-here-page-realm':
      return {
        chip: t('shared.executionPlace.chip.here'),
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
        chip: t('shared.executionPlace.chip.server', { place }),
        reason: t('shared.executionPlace.reason.contextSend', { place }),
        knobs: null,
      };
    case 'companion-invoke':
      return {
        chip: t('shared.executionPlace.chip.desktopApp'),
        reason: t('shared.executionPlace.reason.companionInvoke'),
        knobs: null,
      };
    case 'companion-required':
      return {
        chip: t('shared.executionPlace.chip.needsDesktopApp'),
        reason: t('shared.executionPlace.reason.companionRequired'),
        knobs: null,
      };
    case 'tcp-scheme':
      return {
        chip: t('shared.executionPlace.chip.needsDesktopApp'),
        reason: t('shared.executionPlace.reason.tcpScheme'),
        knobs: null,
      };
    case 'session-not-forwarded':
      return {
        chip: t('shared.executionPlace.chip.notForwarded', { place }),
        reason: t('shared.executionPlace.reason.sessionNotForwarded', { place }),
        knobs: null,
      };
    case 'no-runtime':
      return {
        chip: t('shared.executionPlace.chip.unavailable'),
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
            chip: t('shared.executionPlace.chip.desktopApp'),
            reason: t('shared.executionPlace.reason.delegatedDesktopApp'),
            knobs,
          }
        : {
            chip: t('shared.executionPlace.chip.server', { place }),
            reason: t('shared.executionPlace.reason.delegatedServer', { place }),
            knobs,
          };
    }
    case 'preference-unavailable': {
      const preferred = roleName(reason.preferred, null, t);
      return {
        chip: t('shared.executionPlace.chip.cannotRunOn', { place: preferred }),
        reason: t('shared.executionPlace.reason.preferenceUnavailable', { place: preferred }),
        knobs: null,
      };
    }
  }
}

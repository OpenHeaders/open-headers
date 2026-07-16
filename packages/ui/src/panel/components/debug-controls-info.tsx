/**
 * `(i)` info-popover content for the toolbar's debug controls — the cache
 * toggle, the throttle dropdown, and the system overrides. Built as
 * functions (not static data) so
 * the copy can switch on the inspected tab's mode and so the "Enable Debug
 * mode" call-to-action can carry a live handler. Section item labels are
 * wire/CDP vocabulary (`Cache-Control: no-cache`, `Network.setCacheDisabled`,
 * preset tier names) and stay raw.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

interface DebugInfoParams {
  /** The inspected tab is CDP-controlled (Debug mode active on it). */
  cdpOwned: boolean;
  /** When set, render an "Enable Debug mode" action that runs this. */
  onEnableDebug?: () => void;
}

function enableDebugAction(t: Translate, onEnableDebug?: () => void): InfoPopoverContent['actions'] {
  return onEnableDebug ? [{ label: t('panel.debug.enableDebugMode'), onClick: onEnableDebug, primary: true }] : undefined;
}

export function buildCacheInfo(t: Translate, { cdpOwned, onEnableDebug }: DebugInfoParams): InfoPopoverContent {
  return {
    title: t('panel.cache.label'),
    summary: t('panel.info.cache.summary'),
    description: cdpOwned ? t('panel.info.cache.debugDesc') : t('panel.info.cache.standardDesc'),
    sections: [
      {
        heading: t('panel.info.cache.standardHeading'),
        items: [
          {
            label: 'Cache-Control: no-cache',
            desc: t('panel.info.cache.revalidateDesc'),
          },
        ],
      },
      {
        heading: t('panel.info.cache.debugHeading'),
        items: [
          {
            label: 'Network.setCacheDisabled',
            desc: t('panel.info.cache.cdpDesc'),
          },
        ],
      },
    ],
    actions: cdpOwned ? undefined : enableDebugAction(t, onEnableDebug),
  };
}

export function buildOverridesInfo(t: Translate, { cdpOwned, onEnableDebug }: DebugInfoParams): InfoPopoverContent {
  return {
    title: t('panel.info.overrides.title'),
    summary: t('panel.info.overrides.summary'),
    description: cdpOwned ? t('panel.info.overrides.debugDesc') : t('panel.info.overrides.standardDesc'),
    sections: [
      {
        heading: t('panel.info.overrides.wireHeading'),
        items: [
          {
            label: 'Network.setUserAgentOverride',
            desc: t('panel.info.overrides.uaDesc'),
          },
        ],
      },
      {
        heading: t('panel.info.overrides.pageHeading'),
        items: [
          { label: 'Emulation.setLocaleOverride', desc: t('panel.info.overrides.localeDesc') },
          { label: 'Emulation.setTimezoneOverride', desc: t('panel.info.overrides.timezoneDesc') },
          { label: 'Emulation.setEmulatedMedia', desc: t('panel.info.overrides.mediaDesc') },
        ],
      },
    ],
    actions: cdpOwned ? undefined : enableDebugAction(t, onEnableDebug),
  };
}

export function buildThrottleInfo(t: Translate, { cdpOwned, onEnableDebug }: DebugInfoParams): InfoPopoverContent {
  return {
    title: t('panel.info.throttle.title'),
    summary: t('panel.info.throttle.summary'),
    description: cdpOwned ? t('panel.info.throttle.debugDesc') : t('panel.info.throttle.standardDesc'),
    sections: [
      {
        heading: t('panel.info.throttle.presetsHeading'),
        items: [
          { label: 'Fast 4G', desc: t('panel.info.throttle.fast4gDesc') },
          { label: 'Slow 4G', desc: t('panel.info.throttle.slow4gDesc') },
          { label: '3G', desc: t('panel.info.throttle.3gDesc') },
          { label: 'Offline', desc: t('panel.info.throttle.offlineDesc') },
        ],
      },
      {
        heading: t('panel.info.throttle.wiredHeading'),
        items: [
          { label: 'Fiber', desc: t('panel.info.throttle.fiberDesc') },
          { label: 'Cable', desc: t('panel.info.throttle.cableDesc') },
          { label: 'DSL', desc: t('panel.info.throttle.dslDesc') },
        ],
      },
      {
        heading: t('panel.info.throttle.mobileHeading'),
        items: [
          { label: 'Fast 5G', desc: t('panel.info.throttle.fast5gDesc') },
          { label: 'Slow 5G', desc: t('panel.info.throttle.slow5gDesc') },
          { label: 'Fast 2G', desc: t('panel.info.throttle.fast2gDesc') },
          { label: 'Slow 2G', desc: t('panel.info.throttle.slow2gDesc') },
        ],
      },
    ],
    actions: cdpOwned ? undefined : enableDebugAction(t, onEnableDebug),
  };
}

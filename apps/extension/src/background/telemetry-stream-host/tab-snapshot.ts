/**
 * Tab-inventory snapshot assembly — shared by the request/response
 * inventory read (`oh.telemetry.tabs.list`) and the push-based
 * inventory watch (`tab-inventory.ts`). One assembly path so both
 * planes report byte-identical snapshots.
 *
 * Each tab's favicon rides the snapshot the way its asker reads it
 * (`tab-favicons.ts`): as a key, the bytes pulled apart, or — for an
 * asker that says nothing — as the small `data:` URI itself.
 */

import type {
  BrowserTabWire,
  TelemetryBrowserIdentity,
  TelemetryDebugState,
  TelemetryTabsFavicons,
} from '@openheaders/core/protocol';
import { browserName, platformName } from '../../utils/self-host-label';
import { resolveTabFavicon } from './tab-favicons';

/** How the asker of an inventory frame reads favicons; `undefined` = inline. */
export function faviconsAskedBy(frame: object): TelemetryTabsFavicons | undefined {
  return 'favicons' in frame && frame.favicons === 'by-key' ? 'by-key' : undefined;
}

export async function queryBrowserTabs(favicons?: TelemetryTabsFavicons): Promise<BrowserTabWire[]> {
  const raw = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    try {
      chrome.tabs.query({}, (tabList: chrome.tabs.Tab[]) => resolve(tabList ?? []));
    } catch {
      resolve([]);
    }
  });
  return Promise.all(
    raw
      .filter((tab) => typeof tab.id === 'number' && tab.id >= 0)
      .map(async (tab) => {
        const favicon = await resolveTabFavicon(tab.url ?? '', tab.favIconUrl);
        return {
          tabId: tab.id as number,
          windowId: tab.windowId ?? -1,
          title: tab.title ?? '',
          url: tab.url ?? '',
          active: tab.active === true,
          ...(favicon === undefined
            ? {}
            : favicons === 'by-key'
              ? { favIconKey: favicon.key }
              : { favIconUrl: favicon.dataUri }),
        };
      }),
  );
}

/** This browser's display identity for the inventory snapshot. */
export function browserIdentity(): TelemetryBrowserIdentity {
  return { name: browserName(), platform: platformName() };
}

/** The reported posture where the browser cannot drive CDP at all. */
export const DEBUG_UNAVAILABLE: TelemetryDebugState = {
  available: false,
  enabled: false,
  attachedTabs: [],
  pinnedTabs: [],
};

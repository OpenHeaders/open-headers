/**
 * `(i)` info-popover content for the toolbar's debug controls — the cache
 * toggle and the throttle dropdown. Built as functions (not static data) so
 * the copy can switch on the inspected tab's mode and so the "Enable Debug
 * mode" call-to-action can carry a live handler.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

interface DebugInfoParams {
  /** The inspected tab is CDP-controlled (Debug mode active on it). */
  cdpOwned: boolean;
  /** When set, render an "Enable Debug mode" action that runs this. */
  onEnableDebug?: () => void;
}

function enableDebugAction(onEnableDebug?: () => void): InfoPopoverContent['actions'] {
  return onEnableDebug ? [{ label: 'Enable Debug mode', onClick: onEnableDebug, primary: true }] : undefined;
}

export function buildCacheInfo({ cdpOwned, onEnableDebug }: DebugInfoParams): InfoPopoverContent {
  return {
    title: 'Disable cache',
    summary: 'Stops this tab from serving responses out of the cache.',
    description: cdpOwned
      ? 'This tab is in Debug mode: the cache is disabled at the network-stack level — the in-memory cache too — matching the browser’s native Disable cache.'
      : 'This tab is in standard mode: only the HTTP cache is bypassed, by asking the server to revalidate. Enable Debug mode for a full network-stack disable that also clears the in-memory cache.',
    sections: [
      {
        heading: 'Standard mode',
        items: [
          {
            label: 'Cache-Control: no-cache',
            desc: 'Added to every request so the server re-checks freshness. Bypasses the HTTP cache only.',
          },
        ],
      },
      {
        heading: 'Debug mode',
        items: [
          {
            label: 'Network.setCacheDisabled',
            desc: 'Disables the cache for the whole tab at the network-stack level, including the in-memory cache.',
          },
        ],
      },
    ],
    actions: cdpOwned ? undefined : enableDebugAction(onEnableDebug),
  };
}

export function buildUserAgentInfo({ cdpOwned, onEnableDebug }: DebugInfoParams): InfoPopoverContent {
  return {
    title: 'User-Agent override',
    summary: 'Sends a custom User-Agent for this tab so you can see how a server responds to a different client.',
    description: cdpOwned
      ? 'Active on this tab through Debug mode. The override applies to requests and to page scripts; clearing it restores the real User-Agent.'
      : 'Overriding the User-Agent needs Debug mode — there is no standard-mode fallback. Enable Debug mode and keep this tab in scope to override it.',
    sections: [
      {
        heading: 'Debug mode',
        items: [
          {
            label: 'Network.setUserAgentOverride',
            desc: 'Sets the User-Agent header and navigator.userAgent for the whole tab.',
          },
        ],
      },
    ],
    actions: cdpOwned ? undefined : enableDebugAction(onEnableDebug),
  };
}

export function buildThrottleInfo({ cdpOwned, onEnableDebug }: DebugInfoParams): InfoPopoverContent {
  return {
    title: 'Network throttling',
    summary: 'Simulates slower connections by capping this tab’s bandwidth and adding latency.',
    description: cdpOwned
      ? 'Active on this tab through Debug mode. Pick a preset, go Offline, or set a custom download / upload / latency.'
      : 'Throttling needs Debug mode — there is no standard-mode fallback. Enable Debug mode and keep this tab in scope to throttle it.',
    sections: [
      {
        heading: 'Presets',
        items: [
          { label: 'Slow 3G', desc: '≈400 kbit/s, 2000 ms latency.' },
          { label: 'Fast 3G', desc: '≈1.44 Mbit/s down, 562.5 ms latency.' },
          { label: 'Offline', desc: 'Blocks all network traffic for the tab.' },
        ],
      },
    ],
    actions: cdpOwned ? undefined : enableDebugAction(onEnableDebug),
  };
}

import type { TabTelemetrySnapshot as TelemetrySnapshot } from '@openheaders/core/types';
import type { TrackedResourceType } from '@openheaders/ui/workbench/settings/schema/rules-engine';
import type React from 'react';

export const RULE_TYPE_LABEL: Record<string, string> = {
  header: 'Header',
  block: 'Block',
  redirect: 'Redirect',
  'query-param': 'Query Param',
  inject: 'Inject',
  'request-body': 'API Request',
  delay: 'Delay',
  response: 'API Response',
};

export const RULE_TYPE_DESCRIPTION: Record<string, string> = {
  header: 'Modify HTTP headers',
  block: 'Block requests',
  redirect: 'Redirect requests',
  'query-param': 'Modify query parameters',
  inject: 'Inject scripts or CSS',
  'request-body': 'Modify API request body (fetch/XHR)',
  delay: 'Delay response',
  response: 'Mock or modify API response (fetch/XHR)',
};

export const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  counters: {},
  fires: [],
  byRule: {},
  uniqueRequestCount: 0,
};

/** Human-readable labels for resource types shown in the Match column. */
export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  main_frame: 'Page',
  sub_frame: 'Frame',
  xmlhttprequest: 'Fetch/XHR',
  script: 'Script',
  stylesheet: 'CSS',
  image: 'Image',
  font: 'Font',
  media: 'Media',
  websocket: 'WebSocket',
  ping: 'Ping',
  other: 'Other',
};

export const RESOURCE_TYPE_TOOLTIP: Record<string, string> = {
  main_frame: 'Matches the page URL directly',
  sub_frame: 'Applied to an iframe loaded by this page',
  xmlhttprequest: 'Applied to fetch() and XMLHttpRequest calls',
  script: 'Applied to script resources',
  stylesheet: 'Applied to stylesheets',
  image: 'Applied to images',
  font: 'Applied to font files',
  media: 'Applied to audio/video resources',
  websocket: 'Applied to WebSocket connections',
  ping: 'Applied to ping/beacon requests',
  other: 'Applied to other resources',
};

/**
 * Render order for the inline resource-type filter row at the top of
 * the This Page view. Kept in sync with the `rulesEngine.visibleResourceTypes`
 * schema's enum order so the Settings multi-select and the popup row
 * always show types in the same sequence.
 */
export const ALL_RESOURCE_TYPES: readonly TrackedResourceType[] = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'ping',
  'other',
];

export function formatTimestampShort(timestamp: number): React.ReactNode {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {h}:{m}:{s}
      <span style={{ fontSize: '9px', opacity: 0.6 }}>.{ms}</span>
    </>
  );
}

export function formatTimestampFull(timestamp: number): React.ReactNode {
  const d = new Date(timestamp);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {day} {month} {year} {h}:{m}:{s}
      <span style={{ fontSize: '9px', opacity: 0.6 }}>.{ms}</span>
    </>
  );
}

/**
 * Renders a URL with the portion matching the pattern highlighted.
 * Strips wildcards from the pattern to find the core string in the URL.
 */
export function renderHighlightedUrl(url: string, pattern: string): React.ReactNode {
  // Strip wildcard prefixes to get the matchable core: "*.example.com" → "example.com"
  const core = pattern.replace(/^\*\.?/, '').toLowerCase();
  if (!core || core === '*') {
    return <span style={{ wordBreak: 'break-all' }}>{url}</span>;
  }

  const lowerUrl = url.toLowerCase();
  const matchIndex = lowerUrl.indexOf(core);
  if (matchIndex === -1) {
    return <span style={{ wordBreak: 'break-all' }}>{url}</span>;
  }

  const before = url.substring(0, matchIndex);
  const matched = url.substring(matchIndex, matchIndex + core.length);
  const after = url.substring(matchIndex + core.length);

  return (
    <span style={{ wordBreak: 'break-all' }}>
      <span style={{ opacity: 0.6 }}>{before}</span>
      <span style={{ color: '#69b1ff', fontWeight: 600 }}>{matched}</span>
      <span style={{ opacity: 0.6 }}>{after}</span>
    </span>
  );
}

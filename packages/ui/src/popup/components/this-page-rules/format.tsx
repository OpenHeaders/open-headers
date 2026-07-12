import type { TabTelemetrySnapshot as TelemetrySnapshot } from '@openheaders/core/types';
import { getDateTimeFormat, type MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { TrackedResourceType } from '@openheaders/ui/workbench/settings/schema/rules-engine';
import type React from 'react';

const RULE_TYPE_LABEL_KEY: Record<string, MessageKey> = {
  header: 'popup.ruleType.header',
  block: 'popup.ruleType.block',
  redirect: 'popup.ruleType.redirect',
  'query-param': 'popup.ruleType.queryParam',
  inject: 'popup.ruleType.inject',
  'request-body': 'popup.ruleType.requestBody',
  delay: 'popup.ruleType.delay',
  response: 'popup.ruleType.response',
};

const RULE_TYPE_DESCRIPTION_KEY: Record<string, MessageKey> = {
  header: 'popup.ruleType.headerDesc',
  block: 'popup.ruleType.blockDesc',
  redirect: 'popup.ruleType.redirectDesc',
  'query-param': 'popup.ruleType.queryParamDesc',
  inject: 'popup.ruleType.injectDesc',
  'request-body': 'popup.ruleType.requestBodyDesc',
  delay: 'popup.ruleType.delayDesc',
  response: 'popup.ruleType.responseDesc',
};

/** Display label for a rule type, falling back to the raw type. */
export function ruleTypeLabel(type: string, t: Translate): string {
  const key = RULE_TYPE_LABEL_KEY[type];
  return key ? t(key) : type;
}

/** One-line description for a rule type, falling back to the raw type. */
export function ruleTypeDescription(type: string, t: Translate): string {
  const key = RULE_TYPE_DESCRIPTION_KEY[type];
  return key ? t(key) : type;
}

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

const RESOURCE_TYPE_TOOLTIP_KEY: Record<string, MessageKey> = {
  main_frame: 'popup.resourceType.mainFrameTip',
  sub_frame: 'popup.resourceType.subFrameTip',
  xmlhttprequest: 'popup.resourceType.xhrTip',
  script: 'popup.resourceType.scriptTip',
  stylesheet: 'popup.resourceType.stylesheetTip',
  image: 'popup.resourceType.imageTip',
  font: 'popup.resourceType.fontTip',
  media: 'popup.resourceType.mediaTip',
  websocket: 'popup.resourceType.websocketTip',
  ping: 'popup.resourceType.pingTip',
  other: 'popup.resourceType.otherTip',
};

/** Explanation tooltip for a resource type, falling back to the raw type. */
export function resourceTypeTooltip(type: string, t: Translate): string {
  const key = RESOURCE_TYPE_TOOLTIP_KEY[type];
  return key ? t(key) : type;
}

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

export function formatTimestampFull(timestamp: number, locale: string): React.ReactNode {
  const d = new Date(timestamp);
  const date = getDateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return (
    <>
      {date} {h}:{m}:{s}
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

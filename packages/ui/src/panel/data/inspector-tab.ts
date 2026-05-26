import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

export type DetailSection =
  | 'headers'
  | 'payload'
  | 'preview'
  | 'response'
  | 'initiator'
  | 'timing'
  | 'cookies'
  | 'messages'
  | 'eventstream'
  | 'rawdata';

export type TabSource = 'network' | 'rules';

export interface InspectorTab {
  id: string;
  label: string;
  method: string;
  statusCode?: number;
  url: string;
  activeSection: DetailSection;
  requestId: string;
  timestamp: number;
  source: TabSource;
  displayId: number;
}

export interface ClosedTab {
  tab: InspectorTab;
  closedAt: number;
}

export interface BuildInspectorTabInput {
  lifecycle: RequestLifecycle;
  displayId: number;
}

export function buildInspectorTab(input: BuildInspectorTabInput, source: TabSource = 'network'): InspectorTab {
  const lc = input.lifecycle;
  let hostname: string;
  let path: string;
  try {
    const parsed = new URL(lc.url);
    hostname = parsed.hostname;
    // Don't show trailing "/" for root URLs — matches the native Network tab.
    path = parsed.pathname === '/' ? '' : parsed.pathname;
  } catch {
    hostname = '';
    path = lc.url;
  }

  const domainPart = hostname.length > 20 ? `…${hostname.slice(-17)}` : hostname;
  const pathPart = path.length > 24 ? `…${path.slice(-21)}` : path;
  const label = `#${input.displayId} ${domainPart}${pathPart}`;

  return {
    id: lc.requestId,
    label,
    method: lc.method,
    ...(lc.statusCode != null ? { statusCode: lc.statusCode } : {}),
    url: lc.url,
    activeSection: 'headers',
    requestId: lc.requestId,
    timestamp: lc.startedAtMs,
    source,
    displayId: input.displayId,
  };
}

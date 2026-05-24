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

export function buildInspectorTab(
  req: { id: string; method: string; url: string; statusCode?: number; timestamp: number; displayId: number },
  source: TabSource = 'network',
): InspectorTab {
  let hostname: string;
  let path: string;
  try {
    const parsed = new URL(req.url);
    hostname = parsed.hostname;
    // Don't show trailing "/" for root URLs — matches Chrome's Network tab
    path = parsed.pathname === '/' ? '' : parsed.pathname;
  } catch {
    hostname = '';
    path = req.url;
  }

  const domainPart = hostname.length > 20 ? `\u2026${hostname.slice(-17)}` : hostname;
  const pathPart = path.length > 24 ? `\u2026${path.slice(-21)}` : path;
  const label = `#${req.displayId} ${domainPart}${pathPart}`;

  return {
    id: req.id,
    label,
    method: req.method,
    statusCode: req.statusCode,
    url: req.url,
    activeSection: 'headers',
    requestId: req.id,
    timestamp: req.timestamp,
    source,
    displayId: req.displayId,
  };
}

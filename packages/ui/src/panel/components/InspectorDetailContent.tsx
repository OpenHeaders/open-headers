/**
 * InspectorDetailContent — detail view rendered inside an editor tab.
 * Owns the section tab bar, header attribution, and rule-draft handoff.
 * Each section's body lives in its own component under `./detail/`.
 */

import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type AnnotatedHeader, attributeHeaders } from '../data/header-attribution';
import type { DetailSection } from '../data/inspector-tab';
import { findRuleCollectionId } from '../data/rule-collection';
import {
  buildBlockDraftFromRequest,
  buildDelayDraftFromRequest,
  buildHeaderDraftFromRequest,
  buildRedirectDraftFromRequest,
  buildReplaceHostDraftFromRequest,
  buildReplaceUrlPartDraftFromRequest,
  handOffRuleDraft,
} from '../data/rule-draft-bridge';
import type { InspectorRequest } from '../data/types';
import type { RulesByUid } from '../data/use-rules-lookup';
import CookiesView from './detail/CookiesView';
import EventStreamView, { isEventStream } from './detail/EventStreamView';
import { HeadersView } from './detail/HeadersView';
import InitiatorView from './detail/InitiatorView';
import MessagesView, { hasWebSocketMessages } from './detail/MessagesView';
import PayloadView from './detail/PayloadView';
import PreviewView from './detail/PreviewView';
import TimingView from './detail/TimingView';
import { JsonTree } from './JsonTree';
import { ResponseBodyView } from './ResponseBodyView';

interface InspectorDetailContentProps {
  request: InspectorRequest;
  rulesByUid: RulesByUid;
  getInitiatorChildren: (url: string) => readonly InspectorRequest[];
  getConnectionReuse: (request: InspectorRequest) => import('../data/connection-reuse').ConnectionReuseInfo;
  getRepeatStats: (request: InspectorRequest) => import('../data/timing-repeats').RepeatStats | null;
  baselineMs: number | null;
  pageOrigin: string | null;
  onOpenRequest?: (entryId: string) => void;
  getRequestByUrl: (url: string) => InspectorRequest | null;
  cacheBypassEnabled: boolean;
  liveRulesMode: boolean;
  activeSection: DetailSection;
  onSectionChange: (section: DetailSection) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
  searchMatchIndex?: number;
}

const PAYLOAD_SECTION: { key: DetailSection; label: string } = { key: 'payload', label: 'Payload' };
const COOKIES_SECTION: { key: DetailSection; label: string } = { key: 'cookies', label: 'Cookies' };
const MESSAGES_SECTION: { key: DetailSection; label: string } = { key: 'messages', label: 'Messages' };
const EVENTSTREAM_SECTION: { key: DetailSection; label: string } = { key: 'eventstream', label: 'EventStream' };
const HAR_SECTION: { key: DetailSection; label: string } = { key: 'har', label: 'HAR' };

function hasPayload(har: InspectorDetailContentProps['request']['harEntry']): boolean {
  if (har.request?.queryString && har.request.queryString.length > 0) return true;
  return !!har.request?.postData?.text;
}

function hasCookies(har: InspectorDetailContentProps['request']['harEntry']): boolean {
  if (har.request?.cookies && har.request.cookies.length > 0) return true;
  return (har.response?.headers ?? []).some((h) => h.name.toLowerCase() === 'set-cookie');
}

export function InspectorDetailContent({
  request,
  rulesByUid,
  getInitiatorChildren,
  getConnectionReuse,
  getRepeatStats,
  baselineMs,
  pageOrigin,
  onOpenRequest,
  getRequestByUrl,
  cacheBypassEnabled,
  liveRulesMode,
  activeSection,
  onSectionChange,
  searchHighlight,
  searchSection,
  searchLineNumber,
  searchMatchIndex,
}: InspectorDetailContentProps) {
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBodyRef = useRef<HTMLDivElement>(null);
  const { localCollections } = useRules();

  const ruleCollectionByUid = useMemo<Map<string, string | undefined>>(() => {
    const m = new Map<string, string | undefined>();
    for (const rule of rulesByUid.values()) {
      m.set(rule.uid, findRuleCollectionId(rule, localCollections));
    }
    return m;
  }, [rulesByUid, localCollections]);
  const collectionIdFor = (h: AnnotatedHeader): string | undefined => {
    const a = h.attribution;
    if (a.kind === 'added' || a.kind === 'modified' || a.kind === 'removed') {
      return ruleCollectionByUid.get(a.ctx.ruleUid);
    }
    return undefined;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: searchLineNumber triggers re-scroll when clicking different results for the same query
  useEffect(() => {
    if (!searchHighlight || !rootRef.current) return;
    requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector('.dt-kv--highlighted') ?? rootRef.current?.querySelector('mark');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [searchHighlight, searchLineNumber]);

  const har = request.harEntry;
  // Live Rules Mode system-attribution gate: yellow the cache-bypass
  // request headers when a user header rule fired and didn't itself
  // touch Cache-Control. Mirrors the DNR-side gate in header-builder.
  const liveRulesFired = useMemo<boolean>(() => {
    if (!liveRulesMode) return false;
    const seen = new Set<string>();
    for (const fire of request.fires) {
      if (seen.has(fire.ruleUid)) continue;
      seen.add(fire.ruleUid);
      const rule = rulesByUid.get(fire.ruleUid);
      if (!rule || rule.type !== 'header') continue;
      const mods = [...(rule.action.requestHeaders ?? []), ...(rule.action.responseHeaders ?? [])];
      if (mods.length === 0) continue;
      const userTouchesCacheControl = (rule.action.requestHeaders ?? []).some(
        (m) => m.headerName.toLowerCase() === 'cache-control',
      );
      if (!userTouchesCacheControl) return true;
    }
    return false;
  }, [liveRulesMode, request.fires, rulesByUid]);

  const requestHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(har.request?.headers ?? [], request.fires, 'request', rulesByUid, {
        cacheBypassEnabled,
        liveRulesFired,
      }),
    [har.request?.headers, request.fires, rulesByUid, cacheBypassEnabled, liveRulesFired],
  );
  const responseHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(har.response?.headers ?? [], request.fires, 'response', rulesByUid, {
        cacheBypassEnabled,
        liveRulesFired,
      }),
    [har.response?.headers, request.fires, rulesByUid, cacheBypassEnabled, liveRulesFired],
  );

  const handOff = async (build: () => ReturnType<typeof buildHeaderDraftFromRequest> | unknown): Promise<void> => {
    try {
      setError(null);
      const draft = build() as Parameters<typeof handOffRuleDraft>[0];
      await handOffRuleDraft(draft);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createHeaderRule = (direction: 'request' | 'response', headerName: string, value?: string): void => {
    void handOff(() => buildHeaderDraftFromRequest(request, { direction, headerName, value }));
  };
  const createRedirect = (): void => void handOff(() => buildRedirectDraftFromRequest(request));
  const createReplaceHost = (): void => void handOff(() => buildReplaceHostDraftFromRequest(request));
  const createReplaceUrlPart = (): void => void handOff(() => buildReplaceUrlPartDraftFromRequest(request));
  const createDelay = (): void => void handOff(() => buildDelayDraftFromRequest(request));
  const createCancel = (): void => void handOff(() => buildBlockDraftFromRequest(request));

  const section = activeSection;
  const showMessages = hasWebSocketMessages(har);
  const showEventStream = isEventStream(request.mimeType);
  const sections: Array<{ key: DetailSection; label: string }> = [
    { key: 'headers', label: 'Headers' },
    ...(showMessages ? [MESSAGES_SECTION] : []),
    ...(showEventStream ? [EVENTSTREAM_SECTION] : []),
    ...(hasPayload(har) ? [PAYLOAD_SECTION] : []),
    { key: 'preview', label: 'Preview' },
    { key: 'response', label: 'Response' },
    { key: 'initiator', label: 'Initiator' },
    { key: 'timing', label: 'Timing' },
    ...(hasCookies(har) ? [COOKIES_SECTION] : []),
    HAR_SECTION,
  ];

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="dt-detail-sections" role="tablist">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            className="dt-detail-section-tab"
            aria-selected={section === s.key}
            onClick={() => onSectionChange(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="dt-body-info" style={{ margin: '4px 8px', color: 'var(--dt-status-red)' }}>
          {error}
        </div>
      )}

      <div
        className="dt-tab-body"
        ref={tabBodyRef}
        style={section === 'preview' || section === 'response' ? { display: 'none' } : undefined}
      >
        {section === 'headers' && (
          <HeadersView
            request={request}
            requestHeaders={requestHeaders}
            responseHeaders={responseHeaders}
            rulesByUid={rulesByUid}
            collectionIdFor={collectionIdFor}
            onCreateHeaderRule={createHeaderRule}
            onCreateRedirect={createRedirect}
            onCreateReplaceHost={createReplaceHost}
            onCreateReplaceUrlPart={createReplaceUrlPart}
            onCreateDelay={createDelay}
            onCreateCancel={createCancel}
            searchHighlight={searchHighlight}
            searchSection={searchSection}
            searchLineNumber={searchLineNumber}
          />
        )}

        {section === 'payload' && (
          <PayloadView har={har} searchHighlight={searchHighlight} searchSection={searchSection} />
        )}

        {section === 'messages' && showMessages && <MessagesView har={har} />}

        {section === 'eventstream' && showEventStream && <EventStreamView request={request} />}

        {section === 'initiator' && (
          <InitiatorView
            request={request}
            getInitiatorChildren={getInitiatorChildren}
            getRequestByUrl={getRequestByUrl}
            pageOrigin={pageOrigin}
            onOpenRequest={onOpenRequest}
          />
        )}

        {section === 'timing' && (
          <TimingView
            request={request}
            connectionReuse={getConnectionReuse(request)}
            repeatStats={getRepeatStats(request)}
            baselineMs={baselineMs}
          />
        )}

        {section === 'cookies' && <CookiesView har={har} />}

        {section === 'har' && (
          <div className="dt-panel-mono" style={{ fontSize: 12, lineHeight: 1.6 }}>
            <JsonTree value={har} defaultExpandedDepth={2} />
          </div>
        )}
      </div>

      {section === 'preview' && <PreviewView request={request} />}

      {section === 'response' && (
        <ResponseBodyView
          request={request}
          searchHighlight={searchSection === 'Response' ? searchHighlight : undefined}
          searchLineNumber={searchSection === 'Response' ? searchLineNumber : undefined}
          searchMatchIndex={searchSection === 'Response' ? searchMatchIndex : undefined}
        />
      )}
    </div>
  );
}

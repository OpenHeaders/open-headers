/**
 * InspectorDetailContent — detail view rendered inside an editor tab.
 * Owns the section tab bar, header attribution, and rule-draft handoff.
 * Each section's body lives in its own component under `./detail/`.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectionReuseInfo } from '../data/connection-reuse';
import { type AnnotatedHeader, attributeHeaders } from '../data/header-attribution';
import type { DetailSection } from '../data/inspector-tab';
import {
  currentHarEntry,
  currentResponseBody,
  type InspectorRowWithFires,
  lifecycleMimeType,
} from '../data/inspector-row-projection';
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
import type { RepeatStats } from '../data/timing-repeats';
import type { RulesByUid } from '../data/use-rules-lookup';
import CookiesView from './detail/CookiesView';
import EventStreamView, { isEventStream } from './detail/EventStreamView';
import { HeadersView } from './detail/HeadersView';
import InitiatorView from './detail/InitiatorView';
import MessagesView, { hasWebSocketMessages } from './detail/MessagesView';
import PayloadView from './detail/PayloadView';
import PreviewView from './detail/PreviewView';
import RawDataView from './detail/RawDataView';
import TimingView from './detail/TimingView';
import { ResponseBodyView } from './ResponseBodyView';

interface InspectorDetailContentProps {
  row: InspectorRowWithFires;
  rulesByUid: RulesByUid;
  pages: readonly Page[];
  getInitiatorChildren: (url: string) => readonly InspectorRowWithFires[];
  getConnectionReuse: (lifecycle: RequestLifecycle) => ConnectionReuseInfo;
  getRepeatStats: (lifecycle: RequestLifecycle) => RepeatStats | null;
  baselineMs: number | null;
  pageOrigin: string | null;
  onOpenRequest?: (requestId: string) => void;
  getRowByUrl: (url: string) => InspectorRowWithFires | null;
  cacheBypassEnabled: boolean;
  liveRulesMode: boolean;
  activeSection: DetailSection;
  onSectionChange: (section: DetailSection) => void;
  /** Which correlator feeds the inspected tab; gates the lazy body fetch. */
  source: LifecycleSource;
  /** Ask the engine to fetch this hop's response body (CDP rows, on demand). */
  requestResponseBody: (requestId: string, hopIndex: number) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
  searchMatchIndex?: number;
}

const PAYLOAD_SECTION: { key: DetailSection; label: string } = { key: 'payload', label: 'Payload' };
const COOKIES_SECTION: { key: DetailSection; label: string } = { key: 'cookies', label: 'Cookies' };
const MESSAGES_SECTION: { key: DetailSection; label: string } = { key: 'messages', label: 'Messages' };
const EVENTSTREAM_SECTION: { key: DetailSection; label: string } = { key: 'eventstream', label: 'EventStream' };
const RAWDATA_SECTION: { key: DetailSection; label: string } = { key: 'rawdata', label: 'Raw Data' };

function hasPayload(har: ReturnType<typeof currentHarEntry>): boolean {
  if (!har) return false;
  if (har.request?.queryString && har.request.queryString.length > 0) return true;
  return !!har.request?.postData?.text;
}

function hasCookies(har: ReturnType<typeof currentHarEntry>): boolean {
  if (!har) return false;
  if (har.request?.cookies && har.request.cookies.length > 0) return true;
  return (har.response?.headers ?? []).some((h) => h.name.toLowerCase() === 'set-cookie');
}

export function InspectorDetailContent({
  row,
  rulesByUid,
  pages,
  getInitiatorChildren,
  getConnectionReuse,
  getRepeatStats,
  baselineMs,
  pageOrigin,
  onOpenRequest,
  getRowByUrl,
  cacheBypassEnabled,
  liveRulesMode,
  activeSection,
  onSectionChange,
  source,
  requestResponseBody,
  searchHighlight,
  searchSection,
  searchLineNumber,
  searchMatchIndex,
}: InspectorDetailContentProps) {
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBodyRef = useRef<HTMLDivElement>(null);
  const { localCollections } = useRules();
  const lc = row.lifecycle;

  // A failed lifecycle (canceled / blocked / network error) is just another
  // request state — it renders the same full tab set as every other row, with
  // each tab honestly degrading to its own empty/partial state. The failure is
  // surfaced through the shared status machinery (the General → Status Code row
  // and the list status cell), never by collapsing the panel to a single pane.
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

  const har = currentHarEntry(lc);
  // Live Rules Mode system-attribution gate: yellow the cache-bypass
  // request headers when a user header rule fired and didn't itself
  // touch Cache-Control. Mirrors the DNR-side gate in header-builder.
  const liveRulesFired = useMemo<boolean>(() => {
    if (!liveRulesMode) return false;
    const seen = new Set<string>();
    for (const fire of row.fires) {
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
  }, [liveRulesMode, row.fires, rulesByUid]);

  // Before the response-gated HAR lands, the lifecycle carries the request
  // headers on their own (cooked/provisional, see `lc.requestHeaders`) so an
  // in-flight or never-completed row still shows what the browser assembled.
  // Once the HAR arrives both sets agree; preferring the HAR keeps the finished
  // row on its single authoritative source.
  const requestHeaderSource = har?.request?.headers ?? lc.requestHeaders ?? [];
  const requestHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(requestHeaderSource, row.fires, 'request', rulesByUid, {
        cacheBypassEnabled,
        liveRulesFired,
      }),
    [requestHeaderSource, row.fires, rulesByUid, cacheBypassEnabled, liveRulesFired],
  );
  const responseHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(har?.response?.headers ?? [], row.fires, 'response', rulesByUid, {
        cacheBypassEnabled,
        liveRulesFired,
      }),
    [har?.response?.headers, row.fires, rulesByUid, cacheBypassEnabled, liveRulesFired],
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
    void handOff(() => buildHeaderDraftFromRequest(lc, { direction, headerName, value }));
  };
  const createRedirect = (): void => void handOff(() => buildRedirectDraftFromRequest(lc));
  const createReplaceHost = (): void => void handOff(() => buildReplaceHostDraftFromRequest(lc));
  const createReplaceUrlPart = (): void => void handOff(() => buildReplaceUrlPartDraftFromRequest(lc));
  const createDelay = (): void => void handOff(() => buildDelayDraftFromRequest(lc));
  const createCancel = (): void => void handOff(() => buildBlockDraftFromRequest(lc));

  const section = activeSection;

  // Lazy response-body fetch for CDP rows. The heuristic path attaches
  // bodies eagerly, but CDP fetches on demand to spare the attached
  // session per-request round-trips — so when the user opens
  // Response/Preview and the body slot is still empty, ask for it. The
  // request is de-duped per hop in the client; the body lands as a
  // `body-attached` update and the classifier's `loading` covers the gap.
  useEffect(() => {
    if (source !== 'cdp') return;
    if (section !== 'response' && section !== 'preview') return;
    if (currentResponseBody(lc) !== null) return;
    requestResponseBody(lc.requestId, lc.redirectHopCount);
  }, [source, section, lc, requestResponseBody]);

  const showMessages = har != null && hasWebSocketMessages(har);
  const mime = lifecycleMimeType(lc);
  const showEventStream = isEventStream(mime);
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
    RAWDATA_SECTION,
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
        // Payload's raw-text body fills the pane (Monaco owns the scroll,
        // toolbar pinned at the bottom — like Response), which needs the
        // tab body to be a flex column so `.dt-payload-view` can `flex: 1`.
        // Other sections stay block-flow scroll containers.
        className={section === 'payload' ? 'dt-tab-body dt-tab-body--fill' : 'dt-tab-body'}
        ref={tabBodyRef}
        style={section === 'preview' || section === 'response' ? { display: 'none' } : undefined}
      >
        {section === 'headers' && (
          <HeadersView
            row={row}
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

        {section === 'payload' && har && (
          <PayloadView har={har} searchHighlight={searchHighlight} searchSection={searchSection} />
        )}

        {section === 'messages' && showMessages && har && <MessagesView har={har} />}

        {section === 'eventstream' && showEventStream && <EventStreamView row={row} />}

        {section === 'initiator' && (
          <InitiatorView
            row={row}
            getInitiatorChildren={getInitiatorChildren}
            getRowByUrl={getRowByUrl}
            pageOrigin={pageOrigin}
            onOpenRequest={onOpenRequest}
          />
        )}

        {section === 'timing' && (
          <TimingView
            row={row}
            connectionReuse={getConnectionReuse(lc)}
            repeatStats={getRepeatStats(lc)}
            baselineMs={baselineMs}
          />
        )}

        {section === 'cookies' && (
          <CookiesView row={row} pageOrigin={pageOrigin} onCreateHeaderRule={createHeaderRule} />
        )}

        {section === 'rawdata' && (
          <RawDataView row={row} requestHeaders={requestHeaders} pages={pages} />
        )}
      </div>

      {section === 'preview' && <PreviewView row={row} />}

      {section === 'response' && (
        <ResponseBodyView
          row={row}
          searchHighlight={searchSection === 'Response' ? searchHighlight : undefined}
          searchLineNumber={searchSection === 'Response' ? searchLineNumber : undefined}
          searchMatchIndex={searchSection === 'Response' ? searchMatchIndex : undefined}
        />
      )}
    </div>
  );
}

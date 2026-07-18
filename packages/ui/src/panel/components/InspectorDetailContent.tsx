/**
 * InspectorDetailContent — detail view rendered inside an editor tab.
 * Owns the section tab bar, header attribution, and the create-popover
 * seeding for every rule CTA (drafts built via `rule-draft-bridge`).
 * Each section's body lives in its own component under `./detail/`.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { BlockRuleDraft, DelayRuleDraft, RedirectRuleDraft, Rule } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useEffect, useMemo, useRef } from 'react';
import { handOffApiRequestSeed } from '../data/api-request-handoff';
import { detectApiResourceType } from '../data/api-resource-type';
import type { ConnectionReuseInfo } from '../data/connection-reuse';
import type { JarCookieKey } from '../data/cookies/cookie-jar-cache';
import { deriveFireEvidenceByRule } from '../data/fire-evidence';
import { type AnnotatedHeader, attributeHeaders } from '../data/headers/header-attribution';
import type { DetailSection } from '../data/inspector-tab';
import {
  currentHarEntry,
  currentResponseBody,
  type InspectorRowWithFires,
  lifecycleMimeType,
} from '../data/inspector-row-projection';
import { base64ToBytes } from '../data/base64';
import { isTextMime } from '../data/mime';
import { hasObservedResponseData, isPreservedUnknown, supersessionAnchorFromPages } from '../data/request-state';
import { classifyBodyState } from '../data/response-body-state';
import { classifyRowAnnotations, type RowAnnotation } from '../data/row-annotations';
import { findRuleCollectionId } from '../data/rule-create/rule-collection';
import {
  buildBlockDraftFromRequest,
  buildDelayDraftFromRequest,
  buildHeaderDraftFromRequest,
  buildRedirectDraftFromRequest,
  buildQueryParamDraftFromRequest,
  buildRequestBodyDraftFromRequest,
  buildResponseDraftFromRequest,
} from '../data/rule-create/rule-draft-bridge';
import type { RepeatStats } from '../data/timing/timing-repeats';
import type { RulesByUid } from '../data/rule-create/use-rules-lookup';
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
import { type UrlCreateVariant, useRulePopover } from './RulePopoverHost';

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
  /** Open (or switch to) the Matched Rules tool window. */
  onShowMatchedRules: () => void;
  /** Open a jar cookie as an editor-tab document (the Cookies tab's
   *  edit popover escalation). */
  onOpenCookieDocument?: (cookieKey: JarCookieKey, scopeUrl: string) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
  searchMatchIndex?: number;
}

interface SectionTab {
  key: DetailSection;
  labelKey: MessageKey;
}

const PAYLOAD_SECTION: SectionTab = { key: 'payload', labelKey: 'panel.inspector.sections.payload' };
const COOKIES_SECTION: SectionTab = { key: 'cookies', labelKey: 'panel.inspector.sections.cookies' };
const MESSAGES_SECTION: SectionTab = { key: 'messages', labelKey: 'panel.inspector.sections.messages' };
const EVENTSTREAM_SECTION: SectionTab = { key: 'eventstream', labelKey: 'panel.inspector.sections.eventStream' };
const RAWDATA_SECTION: SectionTab = { key: 'rawdata', labelKey: 'panel.inspector.sections.rawData' };

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

/**
 * Pull the captured response into the fields the "Override Response"
 * draft needs. The body is carried only when it's meaningfully text
 * (the same gate the Response tab uses to offer a binary body as text) —
 * a binary body pre-filled as garbled UTF-8 would help no one, so those
 * seed just the content-type and leave the body for the user.
 */
function capturedResponseDraftInput(
  lc: RequestLifecycle,
  har: ReturnType<typeof currentHarEntry>,
): { responseBody: string; contentType: string; resourceType: 'rest' | 'graphql' } {
  const contentType = lifecycleMimeType(lc) ?? har?.response?.content?.mimeType ?? '';
  const state = classifyBodyState(lc);
  let responseBody = '';
  if (state.kind === 'text') {
    responseBody = state.content;
  } else if (state.kind === 'binary' && isTextMime(contentType)) {
    try {
      responseBody = new TextDecoder('utf-8', { fatal: false }).decode(base64ToBytes(state.base64));
    } catch {
      responseBody = '';
    }
  }
  return { responseBody, contentType, resourceType: detectApiResourceType(lc, har) };
}

/**
 * Pull the captured outgoing body into the field the "Override request
 * body" draft needs. Prefers the raw wire text; for form bodies captured
 * as parsed params only, reconstructs the `name=value&…` source string.
 */
function capturedRequestBodyDraftInput(
  lc: RequestLifecycle,
  har: ReturnType<typeof currentHarEntry>,
): { requestBody: string; resourceType: 'rest' | 'graphql' } {
  const resourceType = detectApiResourceType(lc, har);
  const postData = har?.request?.postData;
  if (!postData) return { requestBody: '', resourceType };
  if (postData.text) return { requestBody: postData.text, resourceType };
  if (postData.params && postData.params.length > 0) {
    return { requestBody: postData.params.map((p) => `${p.name}=${p.value ?? ''}`).join('&'), resourceType };
  }
  return { requestBody: '', resourceType };
}

/**
 * Pull the captured query string into the params the "Override query
 * params" draft needs. HAR queryString entries arrive DECODED (the
 * correlators' har synth iterates `URLSearchParams`), which is exactly
 * the plain shape the rule wants — DNR re-encodes on apply. A second
 * decode here would corrupt values whose decoded text still looks
 * encoded (wire `%2541` must seed as `%41`, not `A`).
 */
function capturedQueryParamsDraftInput(
  har: ReturnType<typeof currentHarEntry>,
): { params: Array<{ param: string; value?: string }> } {
  const qs = har?.request?.queryString ?? [];
  return { params: qs.map((q) => ({ param: q.name, value: q.value })) };
}

/** First still-existing rule of the given type among this row's fires. */
function firedRuleOfType(
  fires: InspectorRowWithFires['fires'],
  rulesByUid: RulesByUid,
  type: Rule['type'],
): Rule | null {
  for (const fire of fires) {
    const rule = rulesByUid.get(fire.ruleUid);
    if (rule?.type === type) return rule;
  }
  return null;
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
  onShowMatchedRules,
  onOpenCookieDocument,
  searchHighlight,
  searchSection,
  searchLineNumber,
  searchMatchIndex,
}: InspectorDetailContentProps) {
  const t = useT();
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
  // A navigation-abandoned request — superseded by a navigation with no streamed
  // response data — presents like the browser's renderer-coupled panel: its
  // request headers read provisional, because the net-process status we captured
  // was never confirmed to the page. Same gate as the list cells' "(unknown)".
  const provisionalRequestHeaders =
    lc.requestHeadersProvisional === true ||
    (isPreservedUnknown(lc, supersessionAnchorFromPages(pages)) && !hasObservedResponseData(lc));
  // The row's OH annotations — the SAME classifier output the grid's
  // annotation rail glyph reads; the Headers tab renders them as insight
  // cards so glyph and explanation can never diverge.
  const rowAnnotations = useMemo<readonly RowAnnotation[]>(
    () => classifyRowAnnotations(lc, { anchor: supersessionAnchorFromPages(pages), source }, row.redirectRewrite),
    [lc, pages, source, row.redirectRewrite],
  );
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

  // Corroboration verdicts for this row's fires — the single derivation
  // the dot, the Matched Rules badge, and the header attribution below
  // all read (see `fire-evidence.ts`).
  const fireEvidenceByRule = useMemo(() => deriveFireEvidenceByRule(lc, row.fires), [lc, row.fires]);

  // Live rules that fired on this request, by type — flip the Response /
  // Preview / Payload tabs' CTA from create ("Override …") to edit
  // ("Edit … override" quick-edit popover targeting that rule). Requires
  // the rule to still exist; a deleted rule falls back to the create CTA.
  const firedResponseRule = useMemo<Rule | null>(
    () => firedRuleOfType(row.fires, rulesByUid, 'response'),
    [row.fires, rulesByUid],
  );
  const firedRequestBodyRule = useMemo<Rule | null>(
    () => firedRuleOfType(row.fires, rulesByUid, 'request-body'),
    [row.fires, rulesByUid],
  );
  const firedQueryParamRule = useMemo<Rule | null>(
    () => firedRuleOfType(row.fires, rulesByUid, 'query-param'),
    [row.fires, rulesByUid],
  );

  // Before the response-gated HAR lands, the lifecycle carries the request
  // headers on their own (cooked/provisional, see `lc.requestHeaders`) so an
  // in-flight or never-completed row still shows what the browser assembled.
  // Once the HAR arrives both sets agree; preferring the HAR keeps the finished
  // row on its single authoritative source.
  const requestHeaderSource = har?.request?.headers ?? lc.requestHeaders ?? [];
  const requestHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(
        requestHeaderSource,
        row.fires,
        'request',
        rulesByUid,
        { cacheBypassEnabled, liveRulesFired },
        fireEvidenceByRule,
      ),
    [requestHeaderSource, row.fires, rulesByUid, cacheBypassEnabled, liveRulesFired, fireEvidenceByRule],
  );
  const responseHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(
        har?.response?.headers ?? [],
        row.fires,
        'response',
        rulesByUid,
        { cacheBypassEnabled, liveRulesFired },
        fireEvidenceByRule,
      ),
    [har?.response?.headers, row.fires, rulesByUid, cacheBypassEnabled, liveRulesFired, fireEvidenceByRule],
  );

  // Every header CTA (server rows, insight cards, cookies, "+ Add
  // Header") opens the in-panel create popover seeded with that
  // gesture's header, anchored to the clicked control.
  const rulePopover = useRulePopover();
  const overrideHeader = (
    direction: 'request' | 'response',
    headerName: string,
    value: string | undefined,
    anchorEl: HTMLElement,
  ): void => {
    rulePopover.open(
      {
        mode: 'create-header',
        anchorEl,
        draft: buildHeaderDraftFromRequest(lc, { direction, headerName, value }),
        direction,
        requestId: lc.requestId,
      },
      { pinned: true },
    );
  };
  // Headers-tab CTA row — each gesture opens the URL-action create
  // popover pinned to its button, seeded like the workbench handoff was.
  const openUrlCreate = (
    draft: RedirectRuleDraft | DelayRuleDraft | BlockRuleDraft,
    variant: UrlCreateVariant,
    anchorEl: HTMLElement,
  ): void => {
    rulePopover.open({ mode: 'create-url', anchorEl, draft, variant, requestId: lc.requestId }, { pinned: true });
  };
  const createRedirect = (anchorEl: HTMLElement): void =>
    openUrlCreate(buildRedirectDraftFromRequest(lc), 'redirect', anchorEl);
  const createReplaceHost = (anchorEl: HTMLElement): void =>
    openUrlCreate(buildRedirectDraftFromRequest(lc), 'replace-host', anchorEl);
  const createLocalhost = (anchorEl: HTMLElement): void =>
    openUrlCreate(buildRedirectDraftFromRequest(lc), 'localhost', anchorEl);
  const createDelay = (anchorEl: HTMLElement): void => openUrlCreate(buildDelayDraftFromRequest(lc), 'delay', anchorEl);
  const createCancel = (anchorEl: HTMLElement): void =>
    openUrlCreate(buildBlockDraftFromRequest(lc), 'block', anchorEl);
  // Payload-tab CTAs — the request-body / query-param create popovers,
  // seeded from the captured payload.
  const createOverrideRequestBody = (anchorEl: HTMLElement): void => {
    rulePopover.open(
      {
        mode: 'create-request-body',
        anchorEl,
        draft: buildRequestBodyDraftFromRequest(lc, capturedRequestBodyDraftInput(lc, har)),
        requestId: lc.requestId,
      },
      { pinned: true },
    );
  };
  const createOverrideQueryParams = (anchorEl: HTMLElement): void => {
    rulePopover.open(
      {
        mode: 'create-query-param',
        anchorEl,
        draft: buildQueryParamDraftFromRequest(lc, capturedQueryParamsDraftInput(har)),
        requestId: lc.requestId,
      },
      { pinned: true },
    );
  };

  // A WebSocket row always carries its Messages tab (the host does the
  // same), even when no frame data is reachable on this capture path —
  // the view explains the empty state honestly. The HAR-extension gate
  // covers entries that arrived with frames already attached.
  const showMessages =
    lc.resourceType === 'websocket' ||
    (har != null && hasWebSocketMessages(har)) ||
    (lc.messages ?? []).some((m) => m.kind === 'ws');
  const mime = lifecycleMimeType(lc);
  const showEventStream =
    isEventStream(mime) || lc.resourceType === 'eventsource' || (lc.messages ?? []).some((m) => m.kind === 'sse');
  const sections: SectionTab[] = [
    { key: 'headers', labelKey: 'panel.inspector.sections.headers' },
    ...(showMessages ? [MESSAGES_SECTION] : []),
    ...(showEventStream ? [EVENTSTREAM_SECTION] : []),
    ...(hasPayload(har) ? [PAYLOAD_SECTION] : []),
    { key: 'preview', labelKey: 'panel.inspector.sections.preview' },
    { key: 'response', labelKey: 'panel.inspector.sections.response' },
    { key: 'initiator', labelKey: 'panel.inspector.sections.initiator' },
    { key: 'timing', labelKey: 'panel.inspector.sections.timing' },
    ...(hasCookies(har) ? [COOKIES_SECTION] : []),
    RAWDATA_SECTION,
  ];

  // The remembered section is sticky across row switches, but the tab set
  // is per-row (Messages on WS, EventStream on SSE, …). When this row
  // doesn't carry the remembered tab, render Headers instead of an empty
  // pane — without clobbering the stored choice, so switching back to a
  // row that has the tab restores it.
  const section: DetailSection = sections.some((s) => s.key === activeSection) ? activeSection : 'headers';

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
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <div
        // Payload's raw-text body fills the pane (Monaco owns the scroll,
        // toolbar pinned at the bottom — like Response), which needs the
        // tab body to be a flex column so `.dt-payload-view` can `flex: 1`.
        // Messages / EventStream own their full surface edge-to-edge —
        // toolbar, grid and split all span the pane, and the views manage
        // their own scrolling — so they drop the wrapper's gutter too.
        // Other sections stay block-flow scroll containers.
        className={
          section === 'payload'
            ? 'dt-tab-body dt-tab-body--fill'
            : section === 'messages' || section === 'eventstream'
              ? 'dt-tab-body dt-tab-body--fill dt-tab-body--flush'
              : 'dt-tab-body'
        }
        ref={tabBodyRef}
        style={section === 'preview' || section === 'response' ? { display: 'none' } : undefined}
      >
        {section === 'headers' && (
          <HeadersView
            row={row}
            requestHeaders={requestHeaders}
            responseHeaders={responseHeaders}
            rowAnnotations={rowAnnotations}
            provisionalRequestHeaders={provisionalRequestHeaders}
            rulesByUid={rulesByUid}
            collectionIdFor={collectionIdFor}
            onOverrideHeader={overrideHeader}
            onCreateRedirect={createRedirect}
            onCreateReplaceHost={createReplaceHost}
            onCreateLocalhost={createLocalhost}
            onOverrideQueryParams={createOverrideQueryParams}
            onCreateDelay={createDelay}
            onCreateCancel={createCancel}
            onCreateApiRequest={() => void handOffApiRequestSeed(lc)}
            onShowMatchedRules={onShowMatchedRules}
            searchHighlight={searchHighlight}
            searchSection={searchSection}
            searchLineNumber={searchLineNumber}
          />
        )}

        {section === 'payload' && har && (
          <PayloadView
            har={har}
            searchHighlight={searchHighlight}
            searchSection={searchSection}
            onOverrideRequestBody={createOverrideRequestBody}
            onOverrideQueryParams={createOverrideQueryParams}
            firedRequestBodyRule={firedRequestBodyRule}
            firedQueryParamRule={firedQueryParamRule}
            requestOverride={lc.requestOverride}
          />
        )}

        {section === 'messages' && showMessages && (
          <MessagesView lifecycle={lc} har={har} source={source} fires={row.fires} rulesByUid={rulesByUid} />
        )}

        {section === 'eventstream' && showEventStream && (
          <EventStreamView lifecycle={lc} source={source} fires={row.fires} rulesByUid={rulesByUid} />
        )}

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
          <CookiesView
            row={row}
            pageOrigin={pageOrigin}
            onOverrideHeader={overrideHeader}
            onOpenCookieDocument={onOpenCookieDocument}
          />
        )}

        {section === 'rawdata' && (
          <RawDataView row={row} requestHeaders={requestHeaders} pages={pages} />
        )}
      </div>

      {section === 'preview' && (
        <PreviewView
          row={row}
          buildOverrideDraft={() => buildResponseDraftFromRequest(lc, capturedResponseDraftInput(lc, har))}
          firedResponseRule={firedResponseRule}
        />
      )}

      {section === 'response' && (
        <ResponseBodyView
          row={row}
          searchHighlight={searchSection === 'Response' ? searchHighlight : undefined}
          searchLineNumber={searchSection === 'Response' ? searchLineNumber : undefined}
          searchMatchIndex={searchSection === 'Response' ? searchMatchIndex : undefined}
          buildOverrideDraft={() => buildResponseDraftFromRequest(lc, capturedResponseDraftInput(lc, har))}
          firedResponseRule={firedResponseRule}
        />
      )}
    </div>
  );
}

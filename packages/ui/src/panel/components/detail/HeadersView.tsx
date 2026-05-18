/**
 * HeadersView — the Headers section of the inspector. Composes the
 * filter toolbar, General/Response/Request sections, insight cards,
 * and the rule-creation CTAs. The view is intentionally rule-creation-
 * shaped, not just an inspection list — every row is a candidate for
 * "make a rule for this".
 *
 * Section / row machinery lives in:
 *   - headers/HeaderSection       (per-direction list, filtering, sort, group)
 *   - headers/HeaderRow           (a single attributed row + drift detection)
 *   - headers/HeadersMenus        (More filters / View dropdowns)
 *   - headers/GeneralRow          (URL/Method/Status/… rows + info popovers)
 *   - headers/InsightCard         (actionable callout above the lists)
 *   - headers/value-chips         (Set-Cookie/Cache-Control/HSTS/JWT chips)
 *   - panel/data/                 (attribution, filter grammar, footprint)
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';
import {
  type AnnotatedHeader,
  isAttributionEdited,
} from '../../data/header-attribution';
import { type HeaderFilterToken, parseHeaderQuery } from '../../data/header-filter';
import { computeHeaderFootprint, formatHeaderFootprint } from '../../data/header-footprint';
import { computeHeaderInsights, type HeaderInsight, type HeaderInsightAction } from '../../data/header-insights';
import { formatHttpVersion } from '../../data/http-version';
import type { InspectorRequest } from '../../data/types';
import type { RulesByUid } from '../../data/use-rules-lookup';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { GeneralRow } from './headers/GeneralRow';
import { HeaderSection } from './headers/HeaderSection';
import { HeaderMoreFiltersMenu, HeaderViewMenu } from './headers/HeadersMenus';
import { InsightCard } from './headers/InsightCard';
import { formatBytes } from './headers/utils';

export type { HeaderLayoutMode, HeaderSortMode } from './headers/types';

export interface HeadersViewProps {
  request: InspectorRequest;
  requestHeaders: readonly AnnotatedHeader[];
  responseHeaders: readonly AnnotatedHeader[];
  rulesByUid: RulesByUid;
  /** Resolves the collection that owns a rule, for `{{collection.X}}` scopes. */
  collectionIdFor: (h: AnnotatedHeader) => string | undefined;
  /** Open the Create Rule editor pre-filled with this header. */
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
  /** Open the Create Rule editor pre-filled with a URL/block/delay action
   *  for this request. The view never builds the draft itself — that
   *  lives in `rule-draft-bridge.ts` — but it does need a callback per
   *  CTA so the parent can surface errors uniformly. */
  onCreateRedirect: () => void;
  onCreateReplaceHost: () => void;
  onCreateReplaceUrlPart: () => void;
  onCreateDelay: () => void;
  onCreateCancel: () => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
}

export function HeadersView({
  request,
  requestHeaders,
  responseHeaders,
  rulesByUid,
  collectionIdFor,
  onCreateHeaderRule,
  onCreateRedirect,
  onCreateReplaceHost,
  onCreateReplaceUrlPart,
  onCreateDelay,
  onCreateCancel,
  searchHighlight,
  searchSection,
  searchLineNumber,
}: HeadersViewProps) {
  // Filter text stays per-tab — it's request-specific scratch state.
  const [filter, setFilter] = useState('');
  // Everything below is panel-wide and persisted via the shared
  // settings store so the user sets defaults once and they carry across
  // requests, tabs, and panel reopens.
  const [ruleOnly, setRuleOnly] = useSetting('devpanelHeaders.ruleOnly');
  const [securityOnly, setSecurityOnly] = useSetting('devpanelHeaders.securityOnly');
  const [overridableOnly, setOverridableOnly] = useSetting('devpanelHeaders.overridableOnly');
  const [hideNoise, setHideNoise] = useSetting('devpanelHeaders.hideNoise');
  const [layout, setLayout] = useSetting('devpanelHeaders.layout');
  const [sortMode, setSortMode] = useSetting('devpanelHeaders.sortMode');
  const [nameCase, setNameCase] = useSetting('devpanelHeaders.nameCase');
  const [showInsights, setShowInsights] = useSetting('devpanelHeaders.showInsights');
  const toggleRuleOnly = useCallback(() => setRuleOnly(!ruleOnly), [ruleOnly, setRuleOnly]);
  const toggleSecurityOnly = useCallback(() => setSecurityOnly(!securityOnly), [securityOnly, setSecurityOnly]);
  const toggleOverridableOnly = useCallback(
    () => setOverridableOnly(!overridableOnly),
    [overridableOnly, setOverridableOnly],
  );
  const toggleHideNoise = useCallback(() => setHideNoise(!hideNoise), [hideNoise, setHideNoise]);
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);

  const compiledQuery = useMemo<readonly HeaderFilterToken[]>(() => {
    const parts: string[] = [];
    if (filter.trim()) parts.push(filter.trim());
    if (ruleOnly) parts.push('is:rule');
    if (securityOnly) parts.push('is:security');
    if (overridableOnly) parts.push('is:overridable');
    return parseHeaderQuery(parts.join(' '));
  }, [filter, ruleOnly, securityOnly, overridableOnly]);

  // Drift detection (rule-edit only — value/var drift is computed in the
  // row so we can read the resolver there). Powers `is:drifted` filter
  // and footprint counts.
  const driftedRows = useMemo<ReadonlySet<AnnotatedHeader>>(() => {
    const out = new Set<AnnotatedHeader>();
    const consider = (rows: readonly AnnotatedHeader[]): void => {
      for (const row of rows) {
        const a = row.attribution;
        if (a.kind === 'server' || a.kind === 'system') continue;
        const liveRule = rulesByUid.get(a.ctx.ruleUid) ?? null;
        if (isAttributionEdited(liveRule, a.ctx)) out.add(row);
      }
    };
    consider(requestHeaders);
    consider(responseHeaders);
    return out;
  }, [requestHeaders, responseHeaders, rulesByUid]);

  const insights = useMemo<readonly HeaderInsight[]>(
    () =>
      computeHeaderInsights({
        url: request.url,
        mimeType: request.mimeType ?? null,
        statusCode: request.statusCode ?? null,
        requestHeaders: request.harEntry.request?.headers ?? [],
        responseHeaders: request.harEntry.response?.headers ?? [],
      }),
    [request.url, request.mimeType, request.statusCode, request.harEntry],
  );

  const footprint = useMemo(
    () =>
      computeHeaderFootprint({
        requestRows: requestHeaders,
        responseRows: responseHeaders,
        driftedRows,
      }),
    [requestHeaders, responseHeaders, driftedRows],
  );
  const footprintText = formatHeaderFootprint(footprint);

  const handleInsightAction = (action: HeaderInsightAction): void => {
    if (action.kind === 'add-header' || action.kind === 'override-header') {
      onCreateHeaderRule(action.direction, action.headerName, action.value ?? '');
    }
  };

  // Measured sticky offsets — see `.dt-headers-pane` in panel-detail.css.
  // `--oh-headers-toolbar-h` feeds the section summaries' `top:` value
  // and `--oh-headers-sticky-offset` (the composed scroll-margin-top
  // base, also consumed by search-result `scrollIntoView`).
  const paneRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const firstSummaryRef = useRef<HTMLElement | null>(null);
  useMeasuredCssHeights(paneRef, [
    { ref: toolbarRef, cssVar: '--oh-headers-toolbar-h' },
    { ref: firstSummaryRef, cssVar: '--oh-headers-summary-h' },
  ]);

  const statusOk = request.statusCode != null && request.statusCode < 400;
  const httpVersion = request.harEntry.response?.httpVersion ?? request.harEntry.request?.httpVersion;
  const referrerPolicy = responseHeaders.find((h) => h.name.toLowerCase() === 'referrer-policy')?.value;
  const contentEncoding = responseHeaders.find((h) => h.name.toLowerCase() === 'content-encoding')?.value;
  const bytesIn = request.harEntry.response?.bodySize;
  const decodedSize = request.harEntry.response?.content?.size;
  const remoteAddr = request.harEntry.serverIPAddress;

  return (
    <div className="dt-headers-pane" ref={paneRef}>
      {/* Rule-creation CTA row — Headers tab is the primary surface for
        * "I see something I want to change → make a rule for it". */}
      <div className="dt-cta-row dt-header-cta-row">
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateRedirect} title="Redirect this URL elsewhere">
          Redirect URL
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateReplaceHost} title="Redirect, keeping path and query but swapping the host">
          Replace host
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateReplaceUrlPart} title="Redirect with the URL pre-filled — edit any segment">
          Replace URL part
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateDelay} title="Delay this request">
          Delay request
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateCancel} title="Block / cancel this request">
          Cancel request
        </button>
      </div>

      {footprintText && (
        <div className="dt-header-footprint" title={footprint.ruleNames.join(', ')}>
          <span className="dt-header-footprint-dot" aria-hidden="true" />
          <span className="dt-header-footprint-text">{footprintText}</span>
        </div>
      )}

      {showInsights && insights.length > 0 && (
        <div className="dt-header-insights">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} onAction={handleInsightAction} />
          ))}
        </div>
      )}

      <div className="dt-header-filter" ref={toolbarRef}>
        <input
          type="search"
          placeholder="Filter — text, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-header-filter-input"
          aria-label="Filter headers"
        />
        <HeaderMoreFiltersMenu
          ruleOnly={ruleOnly}
          securityOnly={securityOnly}
          overridableOnly={overridableOnly}
          hideNoise={hideNoise}
          onToggleRuleOnly={toggleRuleOnly}
          onToggleSecurityOnly={toggleSecurityOnly}
          onToggleOverridableOnly={toggleOverridableOnly}
          onToggleHideNoise={toggleHideNoise}
        />
        <HeaderViewMenu
          layout={layout}
          sortMode={sortMode}
          nameCase={nameCase}
          showInsights={showInsights}
          onLayoutChange={setLayout}
          onSortChange={setSortMode}
          onNameCaseChange={setNameCase}
          onToggleShowInsights={toggleShowInsights}
        />
      </div>

      <details className="dt-section" open>
        <summary ref={firstSummaryRef}>General</summary>
        <GeneralRow label="Request URL" infoKey="request-url">
          <span className="dt-kv-val" style={{ wordBreak: 'break-all' }}>{request.url}</span>
        </GeneralRow>
        <GeneralRow label="Request Method" infoKey="request-method">
          <span className="dt-kv-val">{request.method}</span>
        </GeneralRow>
        {request.statusCode != null && (
          <GeneralRow label="Status Code" infoKey="status-code">
            <span className={`dt-kv-val ${statusOk ? 'dt-kv-val--status-ok' : 'dt-kv-val--status-err'}`}>
              {request.statusCode} {request.statusText ?? ''}
            </span>
          </GeneralRow>
        )}
        {remoteAddr && (
          <GeneralRow label="Remote Address" infoKey="remote-address">
            <span className="dt-kv-val">{remoteAddr}</span>
          </GeneralRow>
        )}
        {httpVersion && (
          <GeneralRow label="HTTP Version" infoKey="http-version">
            <span className="dt-kv-val" title={`ALPN: ${httpVersion}`}>{formatHttpVersion(httpVersion)}</span>
          </GeneralRow>
        )}
        {contentEncoding && (
          <GeneralRow label="Compression" infoKey="compression">
            <span className="dt-kv-val">{contentEncoding}</span>
          </GeneralRow>
        )}
        {bytesIn != null && bytesIn > 0 && (
          <GeneralRow label="Transferred" infoKey="transferred">
            <span className="dt-kv-val">
              {formatBytes(bytesIn)}
              {decodedSize != null && decodedSize > 0 && decodedSize !== bytesIn ? ` (decoded ${formatBytes(decodedSize)})` : ''}
            </span>
          </GeneralRow>
        )}
        {referrerPolicy && (
          <GeneralRow label="Referrer Policy" infoKey="referrer-policy">
            <span className="dt-kv-val">{referrerPolicy}</span>
          </GeneralRow>
        )}
      </details>

      <HeaderSection
        label="Response Headers"
        direction="response"
        rows={responseHeaders}
        request={request}
        rulesByUid={rulesByUid}
        collectionIdFor={collectionIdFor}
        compiledQuery={compiledQuery}
        hideNoise={hideNoise}
        layout={layout}
        sortMode={sortMode}
        nameCase={nameCase}
        driftedRows={driftedRows}
        onCreateHeaderRule={onCreateHeaderRule}
        searchHighlight={searchHighlight}
        searchSection={searchSection}
        searchLineNumber={searchLineNumber}
      />

      <HeaderSection
        label="Request Headers"
        direction="request"
        rows={requestHeaders}
        request={request}
        rulesByUid={rulesByUid}
        collectionIdFor={collectionIdFor}
        compiledQuery={compiledQuery}
        hideNoise={hideNoise}
        layout={layout}
        sortMode={sortMode}
        nameCase={nameCase}
        driftedRows={driftedRows}
        onCreateHeaderRule={onCreateHeaderRule}
        searchHighlight={searchHighlight}
        searchSection={searchSection}
        searchLineNumber={searchLineNumber}
      />
    </div>
  );
}

export default HeadersView;

/**
 * CookiesView — the Cookies section of the inspector. Composes the
 * filter toolbar, request / response cookie sections, insight cards,
 * and the rule-creation CTAs. The view is rule-creation-shaped — every
 * row is a candidate for "override this cookie" / "strip this cookie",
 * matching the Headers tab affordances.
 *
 * Section / row machinery lives in:
 *   - cookies/CookieSection      (per-direction table, filter, sort)
 *   - cookies/CookieRow          (single row + action buttons)
 *   - cookies/CookieChips        (semantic chips: Secure / HttpOnly / SameSite / __Host- / Partitioned / …)
 *   - cookies/CookieMenus        (More filters / View dropdowns)
 *   - cookies/CookieInsightCard  (actionable callout above the lists)
 *   - panel/data/cookie-enrich   (HAR × jar join + Set-Cookie parser)
 *   - panel/data/cookie-filter   (query grammar)
 *   - panel/data/cookie-insights (rule engine for warnings)
 *
 * Request cookie attributes that aren't in HAR — Domain, Path, Expires,
 * HttpOnly, Secure, SameSite, Partition — come from the browser jar
 * via the host-installed CookieJarFetcher seam. Hosts that don't wire
 * one get the HAR-only view (name + value).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { enrichCookies } from '../../data/cookie-enrich';
import { parseCookieQuery, type CookieFilterToken } from '../../data/cookie-filter';
import { computeCookieInsights, problemCookieNames, type CookieInsight, type CookieInsightAction } from '../../data/cookie-insights';
import type { CookieRow as CookieRowModel } from '../../data/cookie-model';
import type { InspectorRequest } from '../../data/types';
import { useCookieJar } from '../../data/use-cookie-jar';
import { CookieInsightCard } from './cookies/CookieInsightCard';
import { CookieMoreFiltersMenu, CookieViewMenu } from './cookies/CookieMenus';
import { CookieSection } from './cookies/CookieSection';
import type { CookieRowColumns } from './cookies/CookieRow';

export interface CookiesViewProps {
  request: InspectorRequest;
  pageOrigin: string | null;
  /** Pre-fills the rule editor with a single-cookie request- or
   *  response-header rule. Reuses the existing Headers-tab handoff so
   *  one rule-builder code path serves both surfaces. */
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
}

export default function CookiesView({ request, pageOrigin, onCreateHeaderRule }: CookiesViewProps) {
  const har = request.harEntry;

  // ── Settings (persisted across requests / panel reopens) ────────
  const [filter, setFilter] = useState('');
  const [sortMode, setSortMode] = useSetting('devpanelCookies.sortMode');
  const [expiresFormat, setExpiresFormat] = useSetting('devpanelCookies.expiresFormat');
  const [showInsights, setShowInsights] = useSetting('devpanelCookies.showInsights');
  const [showFilteredOut, setShowFilteredOut] = useSetting('devpanelCookies.showFilteredOut');
  const [decodeValues, setDecodeValues] = useSetting('devpanelCookies.decodeValues');
  const [problemsOnly, setProblemsOnly] = useSetting('devpanelCookies.problemsOnly');
  const [thirdPartyOnly, setThirdPartyOnly] = useSetting('devpanelCookies.thirdPartyOnly');
  const [ruleOnly, setRuleOnly] = useSetting('devpanelCookies.ruleOnly');

  const [colDomain, setColDomain] = useSetting('devpanelCookies.col.domain');
  const [colPath, setColPath] = useSetting('devpanelCookies.col.path');
  const [colExpires, setColExpires] = useSetting('devpanelCookies.col.expires');
  const [colSize, setColSize] = useSetting('devpanelCookies.col.size');
  const [colHttpOnly, setColHttpOnly] = useSetting('devpanelCookies.col.httpOnly');
  const [colSecure, setColSecure] = useSetting('devpanelCookies.col.secure');
  const [colSameSite, setColSameSite] = useSetting('devpanelCookies.col.sameSite');
  const [colPartition, setColPartition] = useSetting('devpanelCookies.col.partition');
  const [colPriority, setColPriority] = useSetting('devpanelCookies.col.priority');

  const columns = useMemo<CookieRowColumns>(
    () => ({
      domain: colDomain,
      path: colPath,
      expires: colExpires,
      size: colSize,
      httpOnly: colHttpOnly,
      secure: colSecure,
      sameSite: colSameSite,
      partition: colPartition,
      priority: colPriority,
    }),
    [colDomain, colPath, colExpires, colSize, colHttpOnly, colSecure, colSameSite, colPartition, colPriority],
  );

  const toggleCol = useCallback(
    (key: keyof CookieRowColumns): void => {
      switch (key) {
        case 'domain': setColDomain(!colDomain); break;
        case 'path': setColPath(!colPath); break;
        case 'expires': setColExpires(!colExpires); break;
        case 'size': setColSize(!colSize); break;
        case 'httpOnly': setColHttpOnly(!colHttpOnly); break;
        case 'secure': setColSecure(!colSecure); break;
        case 'sameSite': setColSameSite(!colSameSite); break;
        case 'partition': setColPartition(!colPartition); break;
        case 'priority': setColPriority(!colPriority); break;
      }
    },
    [
      colDomain, colPath, colExpires, colSize, colHttpOnly, colSecure, colSameSite, colPartition, colPriority,
      setColDomain, setColPath, setColExpires, setColSize, setColHttpOnly, setColSecure, setColSameSite, setColPartition, setColPriority,
    ],
  );

  const toggleProblemsOnly = useCallback(() => setProblemsOnly(!problemsOnly), [problemsOnly, setProblemsOnly]);
  const toggleThirdPartyOnly = useCallback(() => setThirdPartyOnly(!thirdPartyOnly), [thirdPartyOnly, setThirdPartyOnly]);
  const toggleRuleOnly = useCallback(() => setRuleOnly(!ruleOnly), [ruleOnly, setRuleOnly]);
  const toggleShowFilteredOut = useCallback(() => setShowFilteredOut(!showFilteredOut), [showFilteredOut, setShowFilteredOut]);
  const toggleDecodeValues = useCallback(() => setDecodeValues(!decodeValues), [decodeValues, setDecodeValues]);
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);

  // ── Jar lookup (async, returns null until cache fills) ──────────
  const jar = useCookieJar(request.url);

  // ── Enrichment ─────────────────────────────────────────────────
  const { request: requestRows, response: responseRows, requestBytes, responseBytes } = useMemo(
    () => enrichCookies({ url: request.url, har, jar, showFilteredOut }),
    [request.url, har, jar, showFilteredOut],
  );

  // ── Insights ──────────────────────────────────────────────────
  const insights = useMemo<readonly CookieInsight[]>(
    () =>
      computeCookieInsights({
        url: request.url,
        request: requestRows,
        response: responseRows,
        pageOrigin,
      }),
    [request.url, requestRows, responseRows, pageOrigin],
  );
  const problemNames = useMemo(() => problemCookieNames(insights), [insights]);

  // ── Compiled filter ────────────────────────────────────────────
  const compiledQuery = useMemo<readonly CookieFilterToken[]>(() => {
    const parts: string[] = [];
    if (filter.trim()) parts.push(filter.trim());
    if (problemsOnly) parts.push('is:problem');
    if (thirdPartyOnly) parts.push('is:third-party');
    if (ruleOnly) parts.push('is:rule');
    return parseCookieQuery(parts.join(' '));
  }, [filter, problemsOnly, thirdPartyOnly, ruleOnly]);

  // ── Footprint line ─────────────────────────────────────────────
  const sentCount = requestRows.filter((r) => r.attribution !== 'filtered-out').length;
  const setCount = responseRows.length;
  const filteredOutCount = requestRows.filter((r) => r.attribution === 'filtered-out').length;
  const problemsCount = problemNames.size;
  const footprintBits: string[] = [];
  if (sentCount > 0) footprintBits.push(`${sentCount} sent · ${requestBytes} B`);
  if (setCount > 0) footprintBits.push(`${setCount} set · ${responseBytes} B`);
  if (filteredOutCount > 0) footprintBits.push(`${filteredOutCount} filtered out`);
  if (problemsCount > 0) footprintBits.push(`${problemsCount} flagged`);
  const footprintText = footprintBits.join(' · ');

  // ── CTAs ───────────────────────────────────────────────────────
  const onCreateCookieOverride = (): void => onCreateHeaderRule('request', 'Cookie');
  const onCreateSetCookieOverride = (): void => onCreateHeaderRule('response', 'Set-Cookie');
  const onCreateStripAllCookies = (): void => onCreateHeaderRule('request', 'Cookie', '');

  const handleInsightAction = (action: CookieInsightAction): void => {
    if (action.kind === 'override-set-cookie') onCreateHeaderRule('response', 'Set-Cookie');
    else if (action.kind === 'strip-cookie') onCreateHeaderRule('request', 'Cookie', '');
    else if (action.kind === 'override-cookie-header') onCreateHeaderRule('request', 'Cookie');
  };

  const onMakeRule = (row: CookieRowModel): void => {
    if (row.direction === 'request') onCreateHeaderRule('request', 'Cookie');
    else onCreateHeaderRule('response', 'Set-Cookie');
  };
  const onStripCookie = (row: CookieRowModel): void => {
    if (row.direction === 'request') onCreateHeaderRule('request', 'Cookie', '');
    else onCreateHeaderRule('response', 'Set-Cookie', '');
  };

  // ── Measured sticky offsets (matches Headers tab) ──────────────
  const paneRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const firstSummaryRef = useRef<HTMLElement | null>(null);
  useMeasuredCssHeights(paneRef, [
    { ref: toolbarRef, cssVar: '--oh-cookies-toolbar-h' },
    { ref: firstSummaryRef, cssVar: '--oh-cookies-summary-h' },
  ]);

  const now = Date.now();
  const hasAny = requestRows.length > 0 || responseRows.length > 0;

  if (!hasAny) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No cookies sent or received.
      </span>
    );
  }

  return (
    <div className="dt-cookies-pane" ref={paneRef}>
      <div className="dt-cta-row dt-header-cta-row">
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateCookieOverride} title="Replace the Cookie request header for this URL">
          Override Cookie
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateSetCookieOverride} title="Replace a Set-Cookie response header for this URL">
          Override Set-Cookie
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateStripAllCookies} title="Block the Cookie request header entirely for this URL">
          Strip all cookies
        </button>
      </div>

      {footprintText && (
        <div className="dt-header-footprint">
          <span className="dt-header-footprint-dot" aria-hidden="true" />
          <span className="dt-header-footprint-text">{footprintText}</span>
        </div>
      )}

      {showInsights && insights.length > 0 && (
        <div className="dt-header-insights">
          {insights.map((ins) => (
            <CookieInsightCard key={ins.id} insight={ins} onAction={handleInsightAction} />
          ))}
        </div>
      )}

      <div className="dt-header-filter" ref={toolbarRef}>
        <input
          type="search"
          placeholder="Filter — text, name:gh, value:Madrid, is:secure, is:samesite-none, is:problem, …"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-header-filter-input"
          aria-label="Filter cookies"
        />
        <CookieMoreFiltersMenu
          problemsOnly={problemsOnly}
          thirdPartyOnly={thirdPartyOnly}
          ruleOnly={ruleOnly}
          showFilteredOut={showFilteredOut}
          onToggleProblemsOnly={toggleProblemsOnly}
          onToggleThirdPartyOnly={toggleThirdPartyOnly}
          onToggleRuleOnly={toggleRuleOnly}
          onToggleShowFilteredOut={toggleShowFilteredOut}
        />
        <CookieViewMenu
          sortMode={sortMode}
          expiresFormat={expiresFormat}
          decodeValues={decodeValues}
          showInsights={showInsights}
          columns={columns}
          onSortChange={setSortMode}
          onExpiresFormatChange={setExpiresFormat}
          onToggleDecodeValues={toggleDecodeValues}
          onToggleShowInsights={toggleShowInsights}
          onToggleColumn={toggleCol}
        />
      </div>

      <CookieSection
        label="Response Cookies"
        direction="response"
        rows={responseRows}
        columns={columns}
        problemNames={problemNames}
        pageOrigin={pageOrigin}
        compiledQuery={compiledQuery}
        sortMode={sortMode}
        expiresFormat={expiresFormat}
        decodeValues={decodeValues}
        now={now}
        summaryRef={firstSummaryRef}
        onMakeRule={onMakeRule}
        onStripCookie={onStripCookie}
      />

      <CookieSection
        label="Request Cookies"
        direction="request"
        rows={requestRows}
        columns={columns}
        problemNames={problemNames}
        pageOrigin={pageOrigin}
        compiledQuery={compiledQuery}
        sortMode={sortMode}
        expiresFormat={expiresFormat}
        decodeValues={decodeValues}
        now={now}
        onMakeRule={onMakeRule}
        onStripCookie={onStripCookie}
      />
    </div>
  );
}

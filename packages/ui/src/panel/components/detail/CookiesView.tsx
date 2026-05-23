/**
 * CookiesView — the Cookies section of the inspector. Composes the
 * filter toolbar, request / response cookie sections, insight cards,
 * and the rule-creation CTAs.
 *
 * Design principle: columns encode the raw facts; chips encode facts
 * NOT in any column (semantic role / lifecycle / cross-cell warnings);
 * insights surface actionable problems above the table. No data is
 * duplicated between the three layers.
 *
 * Section / row machinery lives in:
 *   - cookies/CookieSection      (per-direction table, filter, sort, optional grouping)
 *   - cookies/CookieRow          (single row + value expander)
 *   - cookies/SecurityGlyphs     (S/H/L 3-glyph cell replacing 3 columns)
 *   - cookies/CookieChips        (semantic + lifecycle chips only)
 *   - cookies/CookieMenus        (More filters / View dropdowns)
 *   - cookies/CookieInsightCard  (actionable callout above the lists)
 *   - cookies/CookieValueExpander (JWT / JSON / base64 / URL-decoded panel)
 *   - panel/data/cookie-enrich   (HAR × jar join + Set-Cookie parser)
 *   - panel/data/cookie-filter   (query grammar)
 *   - panel/data/cookie-insights (rule engine for warnings + dropped detection)
 *   - panel/data/cookie-role     (auth / tracking / pref classifier)
 *   - panel/data/cookie-value-introspect (JWT / JSON / base64 detector)
 *
 * Request cookie attributes that aren't in HAR — Domain, Path, Expires,
 * HttpOnly, Secure, SameSite, Partition — come from the browser jar
 * via the host-installed CookieJarFetcher seam.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { enrichCookies } from '../../data/cookie-enrich';
import { parseCookieQuery, type CookieFilterToken } from '../../data/cookie-filter';
import {
  computeCookieInsights,
  droppedCookieNames,
  problemCookieNames,
  type CookieInsight,
  type CookieInsightAction,
} from '../../data/cookie-insights';
import type { CookieRow as CookieRowModel } from '../../data/cookie-model';
import type { InspectorRequest } from '../../data/types';
import { useCookieJar } from '../../data/use-cookie-jar';
import { CookieInsightCard } from './cookies/CookieInsightCard';
import { CookieMoreFiltersMenu, CookieViewMenu } from './cookies/CookieMenus';
import { CookieSection } from './cookies/CookieSection';

export interface CookiesViewProps {
  request: InspectorRequest;
  pageOrigin: string | null;
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
}

export default function CookiesView({ request, pageOrigin, onCreateHeaderRule }: CookiesViewProps) {
  const har = request.harEntry;

  // ── Settings ────────────────────────────────────────────────────
  const [filter, setFilter] = useState('');
  const [sortMode, setSortMode] = useSetting('devpanelCookies.sortMode');
  const [expiresFormat, setExpiresFormat] = useSetting('devpanelCookies.expiresFormat');
  const [showInsights, setShowInsights] = useSetting('devpanelCookies.showInsights');
  const [showChips, setShowChips] = useSetting('devpanelCookies.showChips');
  const [showFilteredOut, setShowFilteredOut] = useSetting('devpanelCookies.showFilteredOut');
  const [decodeValues, setDecodeValues] = useSetting('devpanelCookies.decodeValues');
  const [groupByRole, setGroupByRole] = useSetting('devpanelCookies.groupByRole');
  const [problemsOnly, setProblemsOnly] = useSetting('devpanelCookies.problemsOnly');
  const [thirdPartyOnly, setThirdPartyOnly] = useSetting('devpanelCookies.thirdPartyOnly');
  const [ruleOnly, setRuleOnly] = useSetting('devpanelCookies.ruleOnly');

  const toggleProblemsOnly = useCallback(() => setProblemsOnly(!problemsOnly), [problemsOnly, setProblemsOnly]);
  const toggleThirdPartyOnly = useCallback(() => setThirdPartyOnly(!thirdPartyOnly), [thirdPartyOnly, setThirdPartyOnly]);
  const toggleRuleOnly = useCallback(() => setRuleOnly(!ruleOnly), [ruleOnly, setRuleOnly]);
  const toggleShowFilteredOut = useCallback(() => setShowFilteredOut(!showFilteredOut), [showFilteredOut, setShowFilteredOut]);
  const toggleDecodeValues = useCallback(() => setDecodeValues(!decodeValues), [decodeValues, setDecodeValues]);
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);
  const toggleShowChips = useCallback(() => setShowChips(!showChips), [showChips, setShowChips]);
  const toggleGroupByRole = useCallback(() => setGroupByRole(!groupByRole), [groupByRole, setGroupByRole]);

  // ── Jar lookup ─────────────────────────────────────────────────
  const jar = useCookieJar(request.url);

  // ── Enrichment ─────────────────────────────────────────────────
  const { request: requestRows, response: responseRows, requestBytes, responseBytes } = useMemo(
    () => enrichCookies({ url: request.url, har, jar, showFilteredOut }),
    [request.url, har, jar, showFilteredOut],
  );

  // ── Insights + derived problem / dropped sets ──────────────────
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
  const droppedNames = useMemo(() => droppedCookieNames(insights), [insights]);

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
  const droppedCount = droppedNames.size;
  const problemsCount = problemNames.size;
  const footprintBits: string[] = [];
  if (sentCount > 0) footprintBits.push(`${sentCount} sent · ${requestBytes} B`);
  if (setCount > 0) footprintBits.push(`${setCount} set · ${responseBytes} B`);
  if (droppedCount > 0) footprintBits.push(`${droppedCount} will be dropped`);
  if (filteredOutCount > 0) footprintBits.push(`${filteredOutCount} filtered out`);
  if (problemsCount > 0) footprintBits.push(`${problemsCount} flagged`);
  const footprintText = footprintBits.join(' · ');

  // ── CTAs ───────────────────────────────────────────────────────
  const onCreateCookieOverride = (): void => onCreateHeaderRule('request', 'Cookie');
  const onCreateSetCookieOverride = (): void => onCreateHeaderRule('response', 'Set-Cookie');
  const onCreateRemoveAllCookies = (): void => onCreateHeaderRule('request', 'Cookie', '');

  const handleInsightAction = (action: CookieInsightAction): void => {
    if (action.kind === 'override-set-cookie') onCreateHeaderRule('response', 'Set-Cookie');
    else if (action.kind === 'remove-cookie') onCreateHeaderRule('request', 'Cookie', '');
    else if (action.kind === 'override-cookie-header') onCreateHeaderRule('request', 'Cookie');
  };

  const onMakeRule = (row: CookieRowModel): void => {
    if (row.direction === 'request') onCreateHeaderRule('request', 'Cookie');
    else onCreateHeaderRule('response', 'Set-Cookie');
  };

  // ── Measured sticky offsets ────────────────────────────────────
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
      <div className="dt-header-filter" ref={toolbarRef}>
        <input
          type="search"
          placeholder="Filter — text, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …"
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
          showChips={showChips}
          groupByRole={groupByRole}
          onSortChange={setSortMode}
          onExpiresFormatChange={setExpiresFormat}
          onToggleDecodeValues={toggleDecodeValues}
          onToggleShowInsights={toggleShowInsights}
          onToggleShowChips={toggleShowChips}
          onToggleGroupByRole={toggleGroupByRole}
        />
      </div>

      <div className="dt-cta-row dt-header-cta-row">
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateCookieOverride} title="Replace the Cookie header sent on this request">
          Override Request Cookies
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateSetCookieOverride} title="Replace a Set-Cookie header coming back from the server">
          Override Response Cookies
        </button>
        <button type="button" className="dt-btn dt-btn-primary" onClick={onCreateRemoveAllCookies} title="Drop the Cookie header entirely, so the server sees no cookies">
          Don’t send any cookies
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

      <CookieSection
        label="Response Cookies"
        direction="response"
        rows={responseRows}
        problemNames={problemNames}
        droppedNames={droppedNames}
        pageOrigin={pageOrigin}
        compiledQuery={compiledQuery}
        sortMode={sortMode}
        expiresFormat={expiresFormat}
        decodeValues={decodeValues}
        showChips={showChips}
        groupByRole={groupByRole}
        now={now}
        summaryRef={firstSummaryRef}
        onMakeRule={onMakeRule}
      />

      <CookieSection
        label="Request Cookies"
        direction="request"
        rows={requestRows}
        problemNames={problemNames}
        droppedNames={droppedNames}
        pageOrigin={pageOrigin}
        compiledQuery={compiledQuery}
        sortMode={sortMode}
        expiresFormat={expiresFormat}
        decodeValues={decodeValues}
        showChips={showChips}
        groupByRole={groupByRole}
        now={now}
        onMakeRule={onMakeRule}
      />
    </div>
  );
}

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

import type { InspectorHarEntry } from '@openheaders/core/types';
import { App } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/useMeasuredStickyOffset';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { emptyEditForm, rowToKey } from '../../data/cookie-edit';
import { enrichCookies } from '../../data/cookie-enrich';
import { parseCookieQuery, type CookieFilterToken } from '../../data/cookie-filter';
import { cookieHeaderRuleTouched } from '../../data/cookie-indicators';
import {
  getEditedCookieKeys,
  isCookieJarWritable,
  type JarCookieEdit,
  removeJarCookie,
  writeJarCookie,
} from '../../data/cookie-jar-cache';
import {
  computeCookieInsights,
  droppedCookieNames,
  problemCookieNames,
  type CookieInsight,
  type CookieInsightAction,
} from '../../data/cookie-insights';
import type { CookieRow as CookieRowModel } from '../../data/cookie-model';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { useCookieJar } from '../../data/use-cookie-jar';
import { CookieEditPopover } from './cookies/CookieEditPopover';
import { CookieInsightCard } from './cookies/CookieInsightCard';
import { CookieMoreFiltersMenu, CookieViewMenu } from './cookies/CookieMenus';
import { CookieSection } from './cookies/CookieSection';

export interface CookiesViewProps {
  row: InspectorRowWithFires;
  pageOrigin: string | null;
  onCreateHeaderRule: (direction: 'request' | 'response', headerName: string, value?: string) => void;
}

// Empty HAR placeholder for lifecycles that haven't landed a HAR shell yet —
// the cookie enrichment helpers expect a defined shape with optional fields.
const EMPTY_HAR = { request: undefined, response: undefined } as unknown as InspectorHarEntry;

export default function CookiesView({ row, pageOrigin, onCreateHeaderRule }: CookiesViewProps) {
  const lc = row.lifecycle;
  const har = currentHarEntry(lc) ?? EMPTY_HAR;

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
  const jar = useCookieJar(lc.url);

  // ── Cookie write handlers ──────────────────────────────────────
  const { modal, message } = App.useApp();
  const writable = isCookieJarWritable();

  const seedDomain = useMemo(() => {
    try {
      return new URL(lc.url).hostname;
    } catch {
      return '';
    }
  }, [lc.url]);
  const seedSecure = lc.url.startsWith('https:');

  const addCanonical = useMemo(
    () => emptyEditForm({ domain: seedDomain, secure: seedSecure }),
    [seedDomain, seedSecure],
  );

  const onApplyEdit = useCallback(
    async (edit: JarCookieEdit): Promise<boolean> => {
      const result = await writeJarCookie(edit);
      if (result) message.success(`Cookie “${edit.name}” saved`);
      else message.error(`Couldn’t save cookie “${edit.name}”`);
      return result != null;
    },
    [message],
  );

  const onDeleteCookie = useCallback(
    (cookie: CookieRowModel) => {
      modal.confirm({
        title: `Delete cookie “${cookie.name}”?`,
        content: 'This removes it from the browser cookie jar. The page will stop sending it.',
        okText: 'Delete',
        okButtonProps: { danger: true },
        onOk: () =>
          removeJarCookie(rowToKey(cookie)).then((ok) => {
            if (ok) message.success(`Cookie “${cookie.name}” deleted`);
            else message.error(`Couldn’t delete cookie “${cookie.name}”`);
          }),
      });
    },
    [modal, message],
  );

  // ── Enrichment ─────────────────────────────────────────────────
  // `jar` changes identity on every (re-)fetch — including the one a
  // panel cookie write triggers — so reading the live edited-keys set
  // here recomputes with the edit applied.
  const { request: requestRows, response: responseRows, requestBytes, responseBytes } = useMemo(
    () => enrichCookies({ url: lc.url, har, jar, showFilteredOut, editedKeys: getEditedCookieKeys() }),
    [lc.url, har, jar, showFilteredOut],
  );

  // ── Rule-interaction (blue square) — per direction, from this
  //    request's fires. The Cookie header is a bundle, so a fired
  //    Cookie / Set-Cookie rule marks every row in that direction. ──
  const requestRuleTouched = useMemo(() => cookieHeaderRuleTouched(row.fires, 'request'), [row.fires]);
  const responseRuleTouched = useMemo(() => cookieHeaderRuleTouched(row.fires, 'response'), [row.fires]);

  // ── Insights + derived problem / dropped sets ──────────────────
  const insights = useMemo<readonly CookieInsight[]>(
    () =>
      computeCookieInsights({
        url: lc.url,
        request: requestRows,
        response: responseRows,
        pageOrigin,
      }),
    [lc.url, requestRows, responseRows, pageOrigin],
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

  const onMakeRule = (cookie: CookieRowModel): void => {
    if (cookie.direction === 'request') onCreateHeaderRule('request', 'Cookie');
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
        {writable && (
          <CookieEditPopover mode="add" canonical={addCanonical} onSubmit={onApplyEdit} placement="bottomLeft">
            <button type="button" className="dt-btn" title="Add a cookie to the browser jar (including HttpOnly)">
              Add cookie
            </button>
          </CookieEditPopover>
        )}
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
        writable={writable}
        ruleTouched={responseRuleTouched}
        onApplyEdit={onApplyEdit}
        onDelete={onDeleteCookie}
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
        writable={writable}
        ruleTouched={requestRuleTouched}
        onApplyEdit={onApplyEdit}
        onDelete={onDeleteCookie}
      />
    </div>
  );
}

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
 *   - panel/data/cookies/cookie-enrich   (HAR × jar join + Set-Cookie parser)
 *   - panel/data/cookies/cookie-filter   (query grammar)
 *   - panel/data/cookies/cookie-insights (rule engine for warnings + dropped detection)
 *   - panel/data/cookies/cookie-role     (auth / tracking / pref classifier)
 *   - panel/data/value-introspect (JWT / JSON / base64 detector)
 *
 * Request cookie attributes that aren't in HAR — Domain, Path, Expires,
 * HttpOnly, Secure, SameSite, Partition — come from the browser jar
 * via the host-installed CookieJarFetcher seam.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { App } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/dom/useMeasuredStickyOffset';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { deleteKeyForRow, emptyEditForm } from '../../data/cookies/cookie-edit';
import { enrichCookies } from '../../data/cookies/cookie-enrich';
import { parseCookieQuery, type CookieFilterToken } from '../../data/cookies/cookie-filter';
import { cookieHeaderRuleTouched } from '../../data/cookies/cookie-indicators';
import {
  getEditedCookieKeys,
  isCookieJarWritable,
  type JarCookieEdit,
  removeJarCookie,
  writeJarCookie,
} from '../../data/cookies/cookie-jar-cache';
import {
  computeCookieInsights,
  droppedCookieNames,
  problemCookieNames,
  type CookieInsight,
  type CookieInsightAction,
} from '../../data/cookies/cookie-insights';
import type { CookieRow as CookieRowModel } from '../../data/cookies/cookie-model';
import { seedRequestCookieOverride, seedResponseCookieOverride } from '../../data/cookies/cookie-override-seed';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { useCookieJar } from '../../data/cookies/use-cookie-jar';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CookieCtaMenu } from './cookies/CookieCtaMenu';
import { CookieEditPopover } from './cookies/CookieEditPopover';
import { CookieInsightCard } from './cookies/CookieInsightCard';
import { CookieMoreFiltersMenu, CookieViewMenu } from './cookies/CookieMenus';
import { CookieSection } from './cookies/CookieSection';

export interface CookiesViewProps {
  row: InspectorRowWithFires;
  pageOrigin: string | null;
  /** Open the in-panel create popover pre-filled with a Cookie /
   *  Set-Cookie header rule, anchored to the clicked control. Override
   *  gestures seed `value` from the capture (`cookie-override-seed`);
   *  `''` is the explicit empty override ("don't send any cookies"). */
  onOverrideHeader: (
    direction: 'request' | 'response',
    headerName: string,
    value: string | undefined,
    anchorEl: HTMLElement,
  ) => void;
}

// Empty HAR placeholder for lifecycles that haven't landed a HAR shell yet —
// the cookie enrichment helpers expect a defined shape with optional fields.
const EMPTY_HAR = { request: undefined, response: undefined } as unknown as InspectorHarEntry;

// (i) content for the two CTA worlds — the override menu creates RULES
// (virtual, rewrite matching requests in flight); Add cookie writes the
// BROWSER JAR (a real cookie, same store as the browser's own cookie UI).
const OVERRIDE_CTA_INFO: InfoPopoverContent = {
  title: 'Override Cookies',
  kicker: 'Rule',
  summary:
    'Creates a rule that rewrites the Cookie / Set-Cookie headers on matching requests while it fires. The browser cookie jar is untouched.',
  sections: [
    {
      heading: 'Choices',
      items: [
        { label: 'Request cookies', desc: 'Replace the Cookie header the browser sends.' },
        { label: 'Response cookies', desc: 'Replace a Set-Cookie header coming back from the server.' },
        { label: 'Don’t send any cookies', desc: 'Drop the Cookie header entirely — the server sees a cookie-less request.' },
      ],
    },
  ],
};

const ADD_COOKIE_INFO: InfoPopoverContent = {
  title: 'Add Cookie',
  kicker: 'Browser jar',
  summary:
    'Writes a real cookie into the browser jar — the same store the browser shows under Application → Cookies.',
  description:
    'It persists beyond this request and the browser attaches it wherever its domain, path and flags match — no rule involved. This is also the way to create HttpOnly cookies, which page scripts can’t set. The value accepts {{variable}} references, resolved once when you save — the jar keeps that snapshot even if the variable changes later; use Override Cookies when the value should track the variable.',
};

export default function CookiesView({ row, pageOrigin, onOverrideHeader }: CookiesViewProps) {
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
          removeJarCookie(deleteKeyForRow(cookie)).then((ok) => {
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

  // ── CTAs — all open the in-panel create popover anchored to the
  //    clicked control. Override gestures seed the value from the
  //    capture (real cookies, auth values as {{var}} references);
  //    `''` = explicit empty override (send no cookies). ──────────────
  const requestSeed = useMemo(() => seedRequestCookieOverride(requestRows, lc.url), [requestRows, lc.url]);
  const responseSeed = useMemo(() => seedResponseCookieOverride(responseRows, lc.url), [responseRows, lc.url]);
  const onCreateCookieOverride = (anchorEl: HTMLElement): void =>
    onOverrideHeader('request', 'Cookie', requestSeed, anchorEl);
  const onCreateSetCookieOverride = (anchorEl: HTMLElement): void =>
    onOverrideHeader('response', 'Set-Cookie', responseSeed, anchorEl);
  const onCreateRemoveAllCookies = (anchorEl: HTMLElement): void =>
    onOverrideHeader('request', 'Cookie', '', anchorEl);

  const handleInsightAction = (action: CookieInsightAction, anchorEl: HTMLElement): void => {
    if (action.kind === 'override-set-cookie') onOverrideHeader('response', 'Set-Cookie', responseSeed, anchorEl);
    else if (action.kind === 'remove-cookie') onOverrideHeader('request', 'Cookie', '', anchorEl);
    else if (action.kind === 'override-cookie-header') onOverrideHeader('request', 'Cookie', requestSeed, anchorEl);
  };

  const onMakeRule = (cookie: CookieRowModel, anchorEl: HTMLElement): void => {
    // Request direction seeds the whole Cookie bundle; a response row
    // seeds ITS OWN Set-Cookie line (one header per cookie).
    if (cookie.direction === 'request') onOverrideHeader('request', 'Cookie', requestSeed, anchorEl);
    else onOverrideHeader('response', 'Set-Cookie', seedResponseCookieOverride([cookie], lc.url), anchorEl);
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
        <CookieCtaMenu
          onOverrideRequest={onCreateCookieOverride}
          onOverrideResponse={onCreateSetCookieOverride}
          onRemoveAll={onCreateRemoveAllCookies}
        />
        <InfoTrigger content={OVERRIDE_CTA_INFO} className="dt-header-info-trigger" />
        {writable && (
          <>
            <CookieEditPopover mode="add" canonical={addCanonical} onSubmit={onApplyEdit}>
              <button type="button" className="dt-btn" title="Add a cookie to the browser jar (including HttpOnly)">
                Add cookie
              </button>
            </CookieEditPopover>
            <InfoTrigger content={ADD_COOKIE_INFO} className="dt-header-info-trigger" />
          </>
        )}
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
